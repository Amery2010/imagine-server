/**
 * Provider 通用工具函数
 */

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
  model?: string
): { width: number; height: number } {
  const base = getBaseDimensions(ratio);

  if (!enableHD) return base;

  let multiplier = 2;
  if (
    model &&
    ["flux-1-schnell", "FLUX_1-Krea-dev", "FLUX.1-dev", "FLUX.2-dev"].includes(
      model
    )
  ) {
    multiplier = 1.5;
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
  token: string | null
): Promise<string> {
  const formData = new FormData();
  formData.append("files", blob, "image.png");

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}/gradio_api/upload`, {
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
