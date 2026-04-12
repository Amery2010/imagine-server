/**
 * Provider 通用工具函数
 */
import { S3Service } from "../services/s3";
import type { Bindings } from "../types";
import { fetchWithTimeout, TIMEOUT } from "../utils/fetch-with-timeout";

// System prompt for optimization
export const FIXED_SYSTEM_PROMPT_SUFFIX =
  "\nEnsure the output language matches the language of user's prompt that needs to be optimized.";

export const DEFAULT_SYSTEM_PROMPT_CONTENT = `I am a master AI image prompt engineering advisor, specializing in crafting prompts that yield cinematic, hyper-realistic, and deeply evocative visual narratives, optimized for advanced generative models.
My core purpose is to meticulously rewrite, expand, and enhance user's image prompts.
I transform prompts to create visually stunning images by rigorously optimizing elements such as dramatic lighting, intricate textures, compelling composition, and a distinctive artistic style.
My generated prompt output will be strictly under 300 words. Prior to outputting, I will internally validate that the refined prompt strictly adheres to the word count limit and effectively incorporates the intended stylistic and technical enhancements.
My output will consist exclusively of the refined image prompt text. It will commence immediately, with no leading whitespace.
The text will strictly avoid markdown, quotation marks, conversational preambles, explanations, or concluding remarks. Please describe the content using prose-style sentences.
**The character's face is clearly visible and unobstructed.**`;

export const VIDEO_NEGATIVE_PROMPT =
  "Vivid colors, overexposed, static, blurry details, subtitles, style, artwork, painting, image, still, overall grayish tone, worst quality, low quality, JPEG compression artifacts, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn face, deformed, disfigured, malformed limbs, fused fingers, still image, cluttered background, three legs, many people in the background, walking backward, Screen shaking";

/**
 * 从 SSE 流中提取完整的事件数据
 */
export function extractCompleteEventData(sseStream: string): any | null {
  const lines = sseStream.split("\n");
  let isCompleteEvent = false;

  for (const line of lines) {
    console.info(line);
    if (line.startsWith("event:")) {
      if (line.substring(6).trim() === "complete") {
        isCompleteEvent = true;
      } else if (line.substring(6).trim() === "error") {
        throw new Error("SSE stream error event received");
      } else {
        isCompleteEvent = false;
      }
    } else if (line.startsWith("data:") && isCompleteEvent) {
      const jsonData = line.substring(5).trim();
      try {
        return JSON.parse(jsonData);
      } catch (e) {
        console.error("Error parsing JSON data:", e);
        return null;
      }
    }
  }
  return null;
}

/**
 * 根据宽高比获取基础尺寸
 */
export function getBaseDimensions(ratio: string) {
  switch (ratio) {
    case "16:9":
      return { width: 1024, height: 576 };
    case "4:3":
      return { width: 1024, height: 768 };
    case "3:2":
      return { width: 960, height: 640 };
    case "9:16":
      return { width: 576, height: 1024 };
    case "3:4":
      return { width: 768, height: 1024 };
    case "2:3":
      return { width: 640, height: 960 };
    case "1:1":
    default:
      return { width: 1024, height: 1024 };
  }
}

/**
 * 获取图片尺寸（支持 HD）
 */
export function getDimensions(
  ratio: string,
  enableHD: boolean,
  model?: string,
): { width: number; height: number } {
  const base = getBaseDimensions(ratio);

  if (!enableHD) return base;

  let multiplier = 2;
  if (
    model &&
    ["flux-1-schnell", "FLUX_1-Krea-dev", "FLUX.1-dev", "FLUX.2-dev"].includes(
      model,
    )
  ) {
    multiplier = 1.5;
  } else if (model && ["z-image"].includes(model)) {
    multiplier = 1;
  }

  return {
    width: Math.round(base.width * multiplier),
    height: Math.round(base.height * multiplier),
  };
}

/**
 * 上传图片到 Gradio
 */
export async function uploadToGradio(
  baseUrl: string,
  blob: Blob,
  token: string | null,
): Promise<string> {
  const formData = new FormData();
  formData.append("files", blob, "image.png");

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetchWithTimeout(`${baseUrl}/gradio_api/upload`, {
    timeout: TIMEOUT.SHORT,
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload image to Gradio: ${response.statusText}`);
  }

  const result: any = await response.json();
  if (!result || !result[0]) {
    throw new Error("Invalid upload response from Gradio");
  }

  return result[0];
}

/**
 * 统一处理文件上传，优先使用 S3 (若配置)，否则退回 Gradio 上传
 */
export async function processFileUpload(
  file: Blob | string,
  env: Bindings,
  gradioBaseUrl: string,
  token: string | null,
  buildFallbackUrl: (path: string) => string
): Promise<string> {
  // 已经是字符串(例如URL)的话直接返回
  if (typeof file === "string") return file;

  const s3 = new S3Service(env);
  if (s3.isActive) {
    // 获取 Content-Type，由于不同的环境 file 有可能不同，优先取 file.type
    const contentType = file instanceof Blob ? file.type : "image/png";
    const extension = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "bin";
    
    // 如果是 Blob 的话直接传给 S3
    const { url } = await s3.uploadFile(file, extension, contentType);
    return url;
  }

  // 退回默认 Gradio 逻辑
  const path = await uploadToGradio(gradioBaseUrl, file, token);
  return buildFallbackUrl(path);
}

/**
 * 拦截生成结果，将 Base64 或外部 URL 缓冲区上传至 S3，替换为自有的 S3 (CDN / Presigned) URL
 */
export async function processGeneratedResult(result: any, env: Bindings): Promise<any> {
  if (!result || typeof result !== "object") return result;

  const s3 = new S3Service(env);
  if (!s3.isActive) return result;

  const processUrl = async (url: string) => {
    if (!url || typeof url !== "string") return url;
    
    // 如果已经是我们的 S3 链接，直接跳过
    if (url.startsWith(s3["endpoint"]) || (s3["cdnUrl"] && url.startsWith(s3["cdnUrl"]))) {
       return url;
    }

    try {
      let buffer: ArrayBuffer | Buffer;
      let contentType = "image/png";
      let extension = "png";

      if (url.startsWith("data:")) {
        // Base64 URI (e.g. data:image/png;base64,.....)
        const parts = url.split(",");
        const meta = parts[0];
        const base64Data = parts[1];
        buffer = Buffer.from(base64Data, "base64");
        
        const mimeMatch = meta.match(/data:(.*?);/);
        if (mimeMatch) {
          contentType = mimeMatch[1];
        }
      } else if (url.startsWith("http")) {
        // HTTP URL (Download from third-party)
        // 先用 HEAD 请求检查文件大小，防止在 Serverless 环境中下载超大文件导致 OOM
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
        try {
          const headRes = await fetchWithTimeout(url, { method: "HEAD", timeout: TIMEOUT.QUICK });
          const contentLength = headRes.headers.get("content-length");
          if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
            console.warn(`[S3] File too large (${contentLength} bytes), skipping S3 upload`);
            return url;
          }
        } catch {
          // HEAD 请求失败时继续尝试下载
        }
        const fetchRes = await fetchWithTimeout(url, { timeout: TIMEOUT.DEFAULT });
        if (!fetchRes.ok) throw new Error(`Failed to download from temp url: ${fetchRes.status}`);
        buffer = await fetchRes.arrayBuffer();
        contentType = fetchRes.headers.get("content-type") || "image/png";
      } else {
        return url;
      }

      if (contentType.includes("jpeg") || contentType.includes("jpg")) extension = "jpg";
      else if (contentType.includes("webp")) extension = "webp";
      else if (contentType.includes("mp4") || contentType.includes("video")) {
        extension = "mp4";
        contentType = "video/mp4";
      }

      const uploadRes = await s3.uploadFile(buffer, extension, contentType);
      return uploadRes.url;
    } catch (e) {
      console.warn("Failed to process generated result via S3, skipping:", e);
      return url;
    }
  };

  if (result.url) {
    result.url = await processUrl(result.url);
  }

  if (Array.isArray(result.images)) {
    for (const image of result.images) {
      if (image.url) {
        image.url = await processUrl(image.url);
      }
    }
  }

  return result;
}
