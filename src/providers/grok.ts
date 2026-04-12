import type { Context } from "hono";
import { BaseProvider, type ModelConfig } from "./base";
import { runWithTokenRetry, encryptTokenForStorage } from "../api/token-manager";
import {
  uploadToGradio,
  processFileUpload,
  DEFAULT_SYSTEM_PROMPT_CONTENT,
  FIXED_SYSTEM_PROMPT_SUFFIX,
} from "./utils";
import { fetchWithTimeout, TIMEOUT } from "../utils/fetch-with-timeout";

const DEFAULT_GROK_API_BASE = "https://api.x.ai/v1";

// 用于图片编辑时上传图片获取可公开访问 URL 的 Gradio 服务地址
const GRADIO_UPLOAD_BASE_URL =
  "https://linoyts-qwen-image-edit-2509-fast.hf.space";

/**
 * Grok (xAI) Provider
 *
 * 支持四大类模型：
 * - 图片生成/编辑（Imagine 系列）：text2image + image2image
 * - 文本生成（Grok 系列）：text2text（流式 SSE）
 * - 视频生成（Imagine Video）：text2video + image2video（异步任务模式）
 *
 * 使用 xAI REST API 调用，通过 GROK_TOKENS 多 Key 轮换。
 */
export class GrokProvider extends BaseProvider {
  readonly name = "grok";
  readonly supportedActions = [
    "generate",
    "edit",
    "text",
    "video",
    "task-status",
  ];

  getModelConfigs(): Record<string, { apiId: string; config: ModelConfig }> {
    return {
      // === 图片生成/编辑模型（Imagine 系列）===
      "grok-imagine-image": {
        apiId: "grok-imagine-image",
        config: {
          id: "grok/grok-imagine-image",
          name: "Grok Imagine Image",
          type: ["text2image", "image2image"],
        },
      },
      "grok-imagine-image-pro": {
        apiId: "grok-imagine-image-pro",
        config: {
          id: "grok/grok-imagine-image-pro",
          name: "Grok Imagine Image Pro",
          type: ["text2image", "image2image"],
        },
      },

      // === 文本生成模型 ===
      "grok-4.20-0309-reasoning": {
        apiId: "grok-4.20-0309-reasoning",
        config: {
          id: "grok/grok-4.20-0309-reasoning",
          name: "Grok 4.2 Reasoning",
          type: ["text2text"],
        },
      },
      "grok-4.20-0309-non-reasoning": {
        apiId: "grok-4.20-0309-non-reasoning",
        config: {
          id: "grok/grok-4.20-0309-non-reasoning",
          name: "Grok 4.2",
          type: ["text2text"],
        },
      },
      "grok-4-1-fast-reasoning": {
        apiId: "grok-4-1-fast-reasoning",
        config: {
          id: "grok/grok-4-1-fast-reasoning",
          name: "Grok 4.1 Fast Reasoning",
          type: ["text2text"],
        },
      },
      "grok-4-1-fast-non-reasoning": {
        apiId: "grok-4-1-fast-non-reasoning",
        config: {
          id: "grok/grok-4-1-fast-non-reasoning",
          name: "Grok 4.1 Fast",
          type: ["text2text"],
        },
      },

      // === 视频生成模型（支持 text2video + image2video）===
      "grok-imagine-video": {
        apiId: "grok-imagine-video",
        config: {
          id: "grok/grok-imagine-video",
          name: "Grok Imagine Video",
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
   * 图片生成 — 使用 Imagine 系列模型
   *
   * 直接返回 xAI 提供的图片 URL。
   */
  private async handleGenerate(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("grok", env, async (token) => {
      if (!token) {
        throw new Error("Grok API key is required");
      }

      const { model, prompt } = params;
      const modelId = this.getApiModelId(model);

      const response = await fetchWithTimeout(
        `${env.GROK_API_BASE || DEFAULT_GROK_API_BASE}/images/generations`,
        {
          timeout: TIMEOUT.LONG,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model: modelId,
            prompt,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].url) {
        throw new Error("Invalid response from Grok API");
      }

      return {
        url: data.data[0].url,
        revised_prompt: data.data[0].revised_prompt,
      };
    });
  }

  /**
   * 图片编辑 — 使用 Imagine 系列模型
   *
   * 接收 FormData 中的图片，通过 uploadToGradio 上传获取可访问 URL，
   * 再将 URL 传给 Grok 编辑 API。
   * 直接返回 xAI 提供的图片 URL。
   */
  private async handleEdit(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("grok", env, async (token) => {
      if (!token) {
        throw new Error("Grok API key is required");
      }

      const { model, image, prompt } = params;
      const modelId = this.getApiModelId(model);

      // 校验图片参数
      if (!image || !Array.isArray(image) || image.length === 0) {
        throw new Error("image parameter is required and must be an array");
      }

      // 通过统一的文件处理助手获取可公开访问的 URL
      const file = image[0];
      const imageUrl = await processFileUpload(
        file,
        env,
        GRADIO_UPLOAD_BASE_URL,
        null,
        (path) => `${GRADIO_UPLOAD_BASE_URL}/gradio_api/file=${path}`
      );

      const response = await fetchWithTimeout(
        `${env.GROK_API_BASE || DEFAULT_GROK_API_BASE}/images/edits`,
        {
          timeout: TIMEOUT.LONG,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model: modelId,
            prompt,
            image: {
              url: imageUrl,
              type: "image_url",
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].url) {
        throw new Error("Invalid response from Grok API");
      }

      return {
        url: data.data[0].url,
        revised_prompt: data.data[0].revised_prompt,
      };
    });
  }

  /**
   * 文本生成 — 使用 Grok 系列模型（流式 SSE）
   *
   * 调用 OpenAI 兼容的 chat/completions 端点，透传 SSE 流。
   * 返回 Response 对象。
   */
  private async handleText(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("grok", env, async (token) => {
      if (!token) {
        throw new Error("Grok API key is required");
      }

      const { model, prompt } = params;
      const modelId = this.getApiModelId(model);
      const systemInstruction =
        DEFAULT_SYSTEM_PROMPT_CONTENT + FIXED_SYSTEM_PROMPT_SUFFIX;

      const response = await fetchWithTimeout(
        `${env.GROK_API_BASE || DEFAULT_GROK_API_BASE}/chat/completions`,
        {
          timeout: TIMEOUT.LONG,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: prompt },
            ],
            stream: true,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error: ${response.status} - ${errorText}`);
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
   * 视频任务创建 — 支持 text2video 和 image2video
   *
   * - text2video：仅传 prompt
   * - image2video：传 prompt + imageUrl
   *
   * 调用 Grok Imagine Video API，
   * 将 request_id 作为 taskId 存入 KV。
   */
  private async handleVideo(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("grok", env, async (token) => {
      if (!token) {
        throw new Error("Grok API key is required");
      }

      const { model, imageUrl, prompt } = params;
      const modelId = this.getApiModelId(model);

      // 构建请求体：根据是否有 imageUrl 切换模式
      const requestBody: any = {
        model: modelId,
        prompt:
          prompt ||
          "make this image come alive, cinematic motion, smooth animation",
        duration: 5,
      };

      if (imageUrl) {
        // image2video 模式
        requestBody.image = { url: imageUrl };
      }

      const response = await fetchWithTimeout(
        `${env.GROK_API_BASE || DEFAULT_GROK_API_BASE}/videos/generations`,
        {
          timeout: TIMEOUT.LONG,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Grok Video API error: ${response.status} - ${errorText}`,
        );
      }

      const data: any = await response.json();
      const requestId = data.request_id;

      if (!requestId) {
        throw new Error("No request_id returned from Grok Video API");
      }

      // request_id 作为 taskId 存入 KV
      const taskId = requestId;
      const encryptedToken = await encryptTokenForStorage(token!, env);
      await env.VIDEO_TASK_KV.put(
        taskId,
        JSON.stringify({
          status: "processing",
          id: taskId,
          provider: "grok",
          token: encryptedToken,
          requestId,
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
   * 通过 request_id 查询 Grok Video API，
   * 完成后直接返回视频 URL。
   */
  private async handleTaskStatus(env: any, params: any): Promise<any> {
    const { taskId, token } = params;

    try {
      const response = await fetchWithTimeout(
        `${env.GROK_API_BASE || DEFAULT_GROK_API_BASE}/videos/${taskId}`,
        {
          timeout: TIMEOUT.QUICK,
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to check task status");
      }

      const data: any = await response.json();

      if (data.status === "done") {
        const videoUrl = data.video?.url;

        if (!videoUrl) {
          const error = "Video generation completed but no video URL found";

          await env.VIDEO_TASK_KV.put(
            taskId,
            JSON.stringify({
              status: "failed",
              id: taskId,
              provider: "grok",
              error,
              failedAt: new Date().toISOString(),
            }),
          );

          return { status: "failed", error };
        }

        await env.VIDEO_TASK_KV.put(
          taskId,
          JSON.stringify({
            status: "success",
            id: taskId,
            provider: "grok",
            url: videoUrl,
            completedAt: new Date().toISOString(),
          }),
        );

        return { status: "success", url: videoUrl };
      }

      if (data.status === "failed" || data.status === "error") {
        const error = "Video generation failed";

        await env.VIDEO_TASK_KV.put(
          taskId,
          JSON.stringify({
            status: "failed",
            id: taskId,
            provider: "grok",
            error,
            failedAt: new Date().toISOString(),
          }),
        );

        return { status: "failed", error };
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
