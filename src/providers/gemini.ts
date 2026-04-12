import type { Context } from "hono";
import { BaseProvider, type ModelConfig } from "./base";
import { runWithTokenRetry, encryptTokenForStorage } from "../api/token-manager";
import { fetchWithTimeout, TIMEOUT } from "../utils/fetch-with-timeout";

const DEFAULT_GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta";

/**
 * Google Gemini Provider
 *
 * 支持三大类模型：
 * - 图片生成/编辑（Nano Banana 系列）：text2image + image2image
 * - 文本生成（Gemini 系列）：text2text
 * - 视频生成（Veo 系列）：text2video（异步任务模式）
 *
 * 使用 Gemini REST API 直接调用，通过 GEMINI_TOKENS 多 Key 轮换。
 */
export class GeminiProvider extends BaseProvider {
  readonly name = "gemini";
  readonly supportedActions = [
    "generate",
    "edit",
    "text",
    "video",
    "task-status",
  ];

  getModelConfigs(): Record<string, { apiId: string; config: ModelConfig }> {
    return {
      // === 图片生成/编辑模型（Nano Banana 系列）===
      "nano-banana-2": {
        apiId: "gemini-3.1-flash-image-preview",
        config: {
          id: "gemini/nano-banana-2",
          name: "Nano Banana 2",
          type: ["text2image", "image2image"],
          responseType: "base64",
        },
      },
      "nano-banana-pro": {
        apiId: "gemini-3-pro-image-preview",
        config: {
          id: "gemini/nano-banana-pro",
          name: "Nano Banana Pro",
          type: ["text2image", "image2image"],
          responseType: "base64",
        },
      },
      "nano-banana": {
        apiId: "gemini-2.5-flash-image",
        config: {
          id: "gemini/nano-banana",
          name: "Nano Banana",
          type: ["text2image", "image2image"],
          responseType: "base64",
        },
      },

      // === 文本生成模型 ===
      "gemini-3.1-pro": {
        apiId: "gemini-3.1-pro-preview",
        config: {
          id: "gemini/gemini-3.1-pro",
          name: "Gemini 3.1 Pro",
          type: ["text2text"],
        },
      },
      "gemini-3-flash": {
        apiId: "gemini-3-flash-preview",
        config: {
          id: "gemini/gemini-3-flash",
          name: "Gemini 3 Flash",
          type: ["text2text"],
        },
      },
      "gemini-3.1-flash-lite": {
        apiId: "gemini-3.1-flash-lite-preview",
        config: {
          id: "gemini/gemini-3.1-flash-lite",
          name: "Gemini 3.1 Flash-Lite",
          type: ["text2text"],
        },
      },
      "gemini-2.5-flash": {
        apiId: "gemini-2.5-flash",
        config: {
          id: "gemini/gemini-2.5-flash",
          name: "Gemini 2.5 Flash",
          type: ["text2text"],
        },
      },
      "gemini-2.5-pro": {
        apiId: "gemini-2.5-pro",
        config: {
          id: "gemini/gemini-2.5-pro",
          name: "Gemini 2.5 Pro",
          type: ["text2text"],
        },
      },
      "gemini-2.5-flash-lite": {
        apiId: "gemini-2.5-flash-lite",
        config: {
          id: "gemini/gemini-2.5-flash-lite",
          name: "Gemini 2.5 Flash-Lite",
          type: ["text2text"],
        },
      },

      // === 视频生成模型（Veo 系列，支持 text2video + image2video）===
      "veo-3.1": {
        apiId: "veo-3.1-generate-preview",
        config: {
          id: "gemini/veo-3.1",
          name: "Veo 3.1",
          type: ["text2video", "image2video"],
          async: true,
        },
      },
      "veo-3.1-fast": {
        apiId: "veo-3.1-fast-generate-preview",
        config: {
          id: "gemini/veo-3.1-fast",
          name: "Veo 3.1 Fast",
          type: ["text2video", "image2video"],
          async: true,
        },
      },
      "veo-3.1-lite": {
        apiId: "veo-3.1-lite-generate-preview",
        config: {
          id: "gemini/veo-3.1-lite",
          name: "Veo 3.1 Lite",
          type: ["text2video", "image2video"],
          async: true,
        },
      },
      "veo-3": {
        apiId: "veo-3.0-generate-001",
        config: {
          id: "gemini/veo-3",
          name: "Veo 3",
          type: ["text2video", "image2video"],
          async: true,
        },
      },
      "veo-3-fast": {
        apiId: "veo-3.0-fast-generate-001",
        config: {
          id: "gemini/veo-3-fast",
          name: "Veo 3 Fast",
          type: ["text2video", "image2video"],
          async: true,
        },
      },
      "veo-2": {
        apiId: "veo-2.0-generate-001",
        config: {
          id: "gemini/veo-2",
          name: "Veo 2",
          type: ["text2video", "image2video"],
          async: true,
        },
      },
    };
  }

  async handleRequest(c: Context, action: string, params: any): Promise<any> {
    if (!this.supportsAction(action)) {
      this.throwUnsupportedAction(action);
    }

    const env = c.env;

    switch (action) {
      case "generate":
        return this.handleGenerate(env, params);
      case "edit":
        return this.handleEdit(env, params);
      case "text":
        return this.handleText(env, params);
      case "video":
        return this.handleVideo(env, params);
      case "task-status":
        return this.handleTaskStatus(env, params);
      default:
        this.throwUnsupportedAction(action);
    }
  }

  /**
   * 图片生成 — 使用 Nano Banana 系列模型
   *
   * 返回完整 Data URI：data:image/png;base64,...
   */
  private async handleGenerate(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("gemini", env, async (token) => {
      if (!token) {
        throw new Error("Gemini API key is required");
      }

      const { model, prompt } = params;
      const modelId = this.getApiModelId(model);

      const response = await fetchWithTimeout(
        `${env.GEMINI_API_BASE || DEFAULT_GEMINI_API_BASE}/models/${modelId}:generateContent`,
        {
          timeout: TIMEOUT.LONG,
          method: "POST",
          headers: {
            "x-goog-api-key": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: "You are a professional AI image generator. You MUST ONLY generate and return the image. Do NOT output any text, markdown, or conversational content.",
                },
              ],
            },
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();
      const parts = data.candidates?.[0]?.content?.parts;

      if (!parts) {
        throw new Error("Invalid response from Gemini API");
      }

      // 提取图片的 inlineData
      for (const part of parts) {
        if (part.inlineData) {
          const mimeType = part.inlineData.mimeType || "image/png";
          return {
            url: `data:${mimeType};base64,${part.inlineData.data}`,
            type: "base64" as const,
          };
        }
      }

      throw new Error("No image data in Gemini response");
    });
  }

  /**
   * 图片编辑 — 使用 Nano Banana 系列模型
   *
   * 接收 FormData 中的图片，转为 base64 后与文本 prompt 一起发送。
   * 返回完整 Data URI：data:image/png;base64,...
   */
  private async handleEdit(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("gemini", env, async (token) => {
      if (!token) {
        throw new Error("Gemini API key is required");
      }

      const { model, image, prompt } = params;
      const modelId = this.getApiModelId(model);

      // 校验图片参数
      if (!image || !Array.isArray(image) || image.length === 0) {
        throw new Error("image parameter is required and must be an array");
      }

      // 将上传的图片（Blob/File）转为 base64
      const file = image[0];
      const arrayBuffer = await file.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString("base64");
      const mimeType = file.type || "image/png";

      const response = await fetchWithTimeout(
        `${env.GEMINI_API_BASE || DEFAULT_GEMINI_API_BASE}/models/${modelId}:generateContent`,
        {
          timeout: TIMEOUT.LONG,
          method: "POST",
          headers: {
            "x-goog-api-key": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: "You are a professional AI image editor. You MUST ONLY edit and return the image. Do NOT output any text, markdown, or conversational content.",
                },
              ],
            },
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Image,
                    },
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();
      const parts = data.candidates?.[0]?.content?.parts;

      if (!parts) {
        throw new Error("Invalid response from Gemini API");
      }

      for (const part of parts) {
        if (part.inlineData) {
          const resMimeType = part.inlineData.mimeType || "image/png";
          return {
            url: `data:${resMimeType};base64,${part.inlineData.data}`,
            type: "base64" as const,
          };
        }
      }

      throw new Error("No image data in Gemini response");
    });
  }

  /**
   * 文本生成 — 使用 Gemini 系列模型（流式 SSE）
   *
   * 调用 streamGenerateContent 端点，透传 SSE 流到前端。
   * 返回 Response 对象。
   */
  private async handleText(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("gemini", env, async (token) => {
      if (!token) {
        throw new Error("Gemini API key is required");
      }

      const { model, prompt } = params;
      const modelId = this.getApiModelId(model);

      const response = await fetchWithTimeout(
        `${env.GEMINI_API_BASE || DEFAULT_GEMINI_API_BASE}/models/${modelId}:streamGenerateContent?alt=sse`,
        {
          timeout: TIMEOUT.SHORT,
          method: "POST",
          headers: {
            "x-goog-api-key": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      // 透传上游 SSE 流
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    });
  }

  /**
   * 视频任务创建 — 使用 Veo 系列模型
   *
   * 支持两种模式：
   * - text2video：仅传 prompt，无需 imageUrl
   * - image2video：传 prompt + imageUrl，下载图片转 base64 后发送
   *
   * 调用 predictLongRunning 创建异步任务，
   * 将 operation name 作为 taskId 存入 KV，前端通过 task-status 轮询。
   */
  private async handleVideo(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("gemini", env, async (token) => {
      if (!token) {
        throw new Error("Gemini API key is required");
      }

      const { model, prompt, imageUrl } = params;
      const modelId = this.getApiModelId(model);

      // 构建 instance：根据是否有 imageUrl 切换模式
      const instance: any = { prompt };

      if (imageUrl) {
        // image2video 模式：下载图片并转为 base64，使用 referenceImages 格式
        const imageResponse = await fetchWithTimeout(imageUrl, { timeout: TIMEOUT.DEFAULT });
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.status}`);
        }
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString("base64");
        const mimeType =
          imageResponse.headers.get("content-type") || "image/png";

        instance.referenceImages = [
          {
            image: {
              inlineData: { mimeType, data: base64Image },
            },
            referenceType: "asset",
          },
        ];
      }

      const response = await fetchWithTimeout(
        `${env.GEMINI_API_BASE || DEFAULT_GEMINI_API_BASE}/models/${modelId}:predictLongRunning`,
        {
          timeout: TIMEOUT.SHORT,
          method: "POST",
          headers: {
            "x-goog-api-key": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            instances: [instance],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Gemini Video API error: ${response.status} - ${errorText}`,
        );
      }

      const data: any = await response.json();
      const operationName = data.name;

      if (!operationName) {
        throw new Error("No operation name returned from Gemini Video API");
      }

      // operation name 作为 taskId 存入 KV
      const taskId = operationName;
      const encryptedToken = await encryptTokenForStorage(token!, env);
      await env.VIDEO_TASK_KV.put(
        taskId,
        JSON.stringify({
          status: "processing",
          id: taskId,
          provider: "gemini",
          token: encryptedToken,
          operationName,
          createdAt: new Date().toISOString(),
        }),
        { expirationTtl: 86400 },
      );

      return { taskId, predict: 120 };
    });
  }

  /**
   * 视频任务状态轮询
   *
   * 通过 operation name 查询 Gemini API，
   * 完成后下载视频并返回完整 Data URI：data:video/mp4;base64,...
   */
  private async handleTaskStatus(env: any, params: any): Promise<any> {
    const { taskId, token } = params;

    try {
      // 查询 operation 状态
      const response = await fetchWithTimeout(
        `${env.GEMINI_API_BASE || DEFAULT_GEMINI_API_BASE}/${taskId}`,
        {
          timeout: TIMEOUT.QUICK,
          headers: { "x-goog-api-key": token },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to check task status");
      }

      const data: any = await response.json();

      if (data.done === true) {
        // 提取视频 URI
        const videoUri =
          data.response?.generateVideoResponse?.generatedSamples?.[0]?.video
            ?.uri;

        if (!videoUri) {
          // 检查是否有错误信息
          const error =
            data.error?.message ||
            "Video generation completed but no video found";

          await env.VIDEO_TASK_KV.put(
            taskId,
            JSON.stringify({
              status: "failed",
              id: taskId,
              provider: "gemini",
              error,
              failedAt: new Date().toISOString(),
            }),
          );

          return { status: "failed", error };
        }

        // 下载视频（需 API key 认证，跟随重定向）
        const videoResponse = await fetchWithTimeout(videoUri, {
          timeout: TIMEOUT.DEFAULT,
          headers: { "x-goog-api-key": token },
          redirect: "follow",
        });

        if (!videoResponse.ok) {
          throw new Error("Failed to download video");
        }

        // 转为 base64 Data URI
        const videoBuffer = await videoResponse.arrayBuffer();
        const videoBase64 = Buffer.from(videoBuffer).toString("base64");

        await env.VIDEO_TASK_KV.put(
          taskId,
          JSON.stringify({
            status: "success",
            id: taskId,
            provider: "gemini",
            completedAt: new Date().toISOString(),
          }),
        );

        return {
          status: "success",
          url: `data:video/mp4;base64,${videoBase64}`,
          type: "base64",
        };
      }

      // 仍在处理中
      return { status: "processing" };
    } catch (error: any) {
      return {
        status: "failed",
        error: error.message || "Video generation failed",
      };
    }
  }
}
