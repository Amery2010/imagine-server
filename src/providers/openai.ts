import type { Context } from "hono";
import { BaseProvider, type ModelConfig } from "./base";
import { runWithTokenRetry, encryptTokenForStorage } from "../api/token-manager";
import {
  DEFAULT_SYSTEM_PROMPT_CONTENT,
  FIXED_SYSTEM_PROMPT_SUFFIX,
} from "./utils";
import { fetchWithTimeout, TIMEOUT } from "../utils/fetch-with-timeout";

const DEFAULT_OPENAI_API_BASE = "https://api.openai.com/v1";

/**
 * OpenAI Provider
 *
 * 支持四大类模型：
 * - 图片生成/编辑（GPT Image 系列）：text2image + image2image，返回 base64
 * - 文本生成（GPT-5.4 系列）：text2text（Responses API 流式 SSE）
 * - 视频生成（Sora 系列）：text2video + image2video（异步任务模式）
 *
 * 使用 OpenAI REST API 调用，通过 OPENAI_TOKENS 多 Key 轮换。
 */
export class OpenAIProvider extends BaseProvider {
  readonly name = "openai";
  readonly supportedActions = [
    "generate",
    "edit",
    "text",
    "video",
    "task-status",
  ];

  getModelConfigs(): Record<string, { apiId: string; config: ModelConfig }> {
    return {
      // === 图片生成/编辑模型（GPT Image 系列）===
      "gpt-image-1.5-2025-12-16": {
        apiId: "gpt-image-1.5-2025-12-16",
        config: {
          id: "openai/gpt-image-1.5-2025-12-16",
          name: "GPT Image 1.5",
          type: ["text2image", "image2image"],
          responseType: "base64",
        },
      },
      "gpt-image-1-mini": {
        apiId: "gpt-image-1-mini",
        config: {
          id: "openai/gpt-image-1-mini",
          name: "GPT Image 1 Mini",
          type: ["text2image", "image2image"],
          responseType: "base64",
        },
      },

      // === 文本生成模型（GPT-5.4 系列）===
      "gpt-5.4": {
        apiId: "gpt-5.4",
        config: {
          id: "openai/gpt-5.4",
          name: "GPT-5.4",
          type: ["text2text"],
        },
      },
      "gpt-5.4-mini": {
        apiId: "gpt-5.4-mini",
        config: {
          id: "openai/gpt-5.4-mini",
          name: "GPT-5.4 mini",
          type: ["text2text"],
        },
      },
      "gpt-5.4-nano": {
        apiId: "gpt-5.4-nano",
        config: {
          id: "openai/gpt-5.4-nano",
          name: "GPT-5.4 nano",
          type: ["text2text"],
        },
      },

      // === 视频生成模型（Sora 系列，支持 text2video + image2video）===
      "sora-2": {
        apiId: "sora-2",
        config: {
          id: "openai/sora-2",
          name: "Sora 2",
          type: ["text2video", "image2video"],
          async: true,
        },
      },
      "sora-2-pro": {
        apiId: "sora-2-pro",
        config: {
          id: "openai/sora-2-pro",
          name: "Sora 2 Pro",
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
   * 图片生成 — 使用 GPT Image 系列模型
   *
   * 调用 /v1/images/generations，返回 base64 Data URI。
   */
  private async handleGenerate(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("openai", env, async (token) => {
      if (!token) {
        throw new Error("OpenAI API key is required");
      }

      const { model, prompt } = params;
      const modelId = this.getApiModelId(model);

      const response = await fetchWithTimeout(
        `${env.OPENAI_API_BASE || DEFAULT_OPENAI_API_BASE}/images/generations`,
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
            n: 1,
            size: "1024x1024",
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].b64_json) {
        throw new Error("Invalid response from OpenAI API");
      }

      return {
        url: `data:image/png;base64,${data.data[0].b64_json}`,
        type: "base64" as const,
      };
    });
  }

  /**
   * 图片编辑 — 使用 GPT Image 系列模型
   *
   * 接收 FormData 中的图片，重新封装为 FormData 发送给 OpenAI。
   * OpenAI 的 /v1/images/edits 要求 multipart/form-data 格式，
   * 支持多图（image[]=@file）。
   * 返回 base64 Data URI。
   */
  private async handleEdit(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("openai", env, async (token) => {
      if (!token) {
        throw new Error("OpenAI API key is required");
      }

      const { model, image, prompt } = params;
      const modelId = this.getApiModelId(model);

      // 校验图片参数
      if (!image || !Array.isArray(image) || image.length === 0) {
        throw new Error("image parameter is required and must be an array");
      }

      // 构建 FormData 转发给 OpenAI
      const formData = new FormData();
      formData.append("model", modelId);
      formData.append("prompt", prompt);

      // 支持多图：每个图片作为 image[] 字段
      for (const file of image) {
        formData.append("image[]", file);
      }

      const response = await fetchWithTimeout(
        `${env.OPENAI_API_BASE || DEFAULT_OPENAI_API_BASE}/images/edits`,
        {
          timeout: TIMEOUT.LONG,
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            // 不设置 Content-Type，让 fetch 自动设置 multipart boundary
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].b64_json) {
        throw new Error("Invalid response from OpenAI API");
      }

      return {
        url: `data:image/png;base64,${data.data[0].b64_json}`,
        type: "base64" as const,
      };
    });
  }

  /**
   * 文本生成 — 使用 GPT-5.4 系列模型（流式 SSE）
   *
   * 调用 OpenAI Responses API (/v1/responses)，接收 Responses SSE 格式，
   * 通过 TransformStream 转换为标准 Chat Completions SSE 格式后透传给前端。
   *
   * 转换映射：
   * - response.output_text.delta → data: {"choices":[{"delta":{"content":"..."}}]}
   * - response.output_text.done  → data: [DONE]
   */
  private async handleText(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("openai", env, async (token) => {
      if (!token) {
        throw new Error("OpenAI API key is required");
      }

      const { model, prompt } = params;
      const modelId = this.getApiModelId(model);
      const systemInstruction =
        DEFAULT_SYSTEM_PROMPT_CONTENT + FIXED_SYSTEM_PROMPT_SUFFIX;

      const response = await fetchWithTimeout(
        `${env.OPENAI_API_BASE || DEFAULT_OPENAI_API_BASE}/responses`,
        {
          timeout: TIMEOUT.SHORT,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model: modelId,
            instructions: systemInstruction,
            input: prompt,
            stream: true,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      // 将 Responses SSE 转换为 Chat Completions SSE 格式
      const transformedStream = this.transformResponsesSSE(response.body!);

      return new Response(transformedStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    });
  }

  /**
   * 将 OpenAI Responses API 的 SSE 流转换为 Chat Completions SSE 格式
   *
   * 输入格式：
   *   event: response.output_text.delta
   *   data: {"type":"response.output_text.delta","delta":"Hi"}
   *
   * 输出格式：
   *   data: {"choices":[{"delta":{"content":"Hi"}}]}
   *
   * 结束信号：
   *   event: response.output_text.done → data: [DONE]
   */
  private transformResponsesSSE(
    inputStream: ReadableStream<Uint8Array>,
  ): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";

    return new ReadableStream({
      start(controller) {
        const reader = inputStream.getReader();

        async function pump(): Promise<void> {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // 流结束，发送 [DONE]
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            // 保留最后一个可能不完整的行
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();

              if (trimmed === "") {
                // 空行表示事件结束，重置事件类型
                currentEvent = "";
                continue;
              }

              if (trimmed.startsWith("event:")) {
                currentEvent = trimmed.substring(6).trim();
                continue;
              }

              if (trimmed.startsWith("data:")) {
                const jsonStr = trimmed.substring(5).trim();

                if (currentEvent === "response.output_text.delta") {
                  try {
                    const eventData = JSON.parse(jsonStr);
                    const delta = eventData.delta;

                    if (delta !== undefined && delta !== "") {
                      // 转换为 Chat Completions 格式
                      const chunk = {
                        choices: [
                          {
                            delta: { content: delta },
                          },
                        ],
                      };
                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
                      );
                    }
                  } catch {
                    // JSON 解析失败，跳过
                  }
                } else if (currentEvent === "response.output_text.done") {
                  // 文本输出完成，发送 [DONE]
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                  return;
                }
                // 其他事件类型跳过
              }
            }
          }
        }

        pump().catch((err) => {
          controller.error(err);
        });
      },
    });
  }

  /**
   * 视频任务创建 — 支持 text2video 和 image2video
   *
   * - text2video：仅传 prompt，FormData 包含 model/prompt/size/seconds
   * - image2video：传 prompt + imageUrl，下载图片后作为 input_reference 追加到 FormData
   *
   * 调用 POST /v1/videos（multipart/form-data），
   * 将返回的 video id 作为 taskId 存入 KV。
   */
  private async handleVideo(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("openai", env, async (token) => {
      if (!token) {
        throw new Error("OpenAI API key is required");
      }

      const { model, imageUrl, prompt } = params;
      const modelId = this.getApiModelId(model);

      // 构建 FormData
      const formData = new FormData();
      formData.append("model", modelId);
      formData.append(
        "prompt",
        prompt ||
          "make this image come alive, cinematic motion, smooth animation",
      );
      formData.append("size", "1280x720");
      formData.append("seconds", "8");

      if (imageUrl) {
        // image2video 模式：下载图片并作为 input_reference 追加
        const imageResponse = await fetchWithTimeout(imageUrl, { timeout: TIMEOUT.DEFAULT });
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.status}`);
        }
        const imageBlob = await imageResponse.blob();
        const mimeType =
          imageResponse.headers.get("content-type") || "image/jpeg";
        // 确定文件扩展名
        const ext = mimeType.includes("png") ? "png" : "jpeg";
        formData.append(
          "input_reference",
          new File([imageBlob], `reference.${ext}`, { type: mimeType }),
        );
      }

      const response = await fetchWithTimeout(
        `${env.OPENAI_API_BASE || DEFAULT_OPENAI_API_BASE}/videos`,
        {
          timeout: TIMEOUT.SHORT,
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            // 不设置 Content-Type，让 fetch 自动设置 multipart boundary
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenAI Video API error: ${response.status} - ${errorText}`,
        );
      }

      const data: any = await response.json();
      const videoId = data.id;

      if (!videoId) {
        throw new Error("No video id returned from OpenAI Video API");
      }

      // video id 作为 taskId 存入 KV
      const taskId = videoId;
      const encryptedToken = await encryptTokenForStorage(token!, env);
      await env.VIDEO_TASK_KV.put(
        taskId,
        JSON.stringify({
          status: "processing",
          id: taskId,
          provider: "openai",
          token: encryptedToken,
          videoId,
          createdAt: new Date().toISOString(),
        }),
        { expirationTtl: 86400 },
      );

      return { taskId, predict: 300 };
    });
  }

  /**
   * 视频任务状态轮询
   *
   * 通过 video id 查询 OpenAI Video API，
   * 完成后下载视频内容并返回 base64 Data URI。
   */
  private async handleTaskStatus(env: any, params: any): Promise<any> {
    const { taskId, token } = params;

    try {
      const response = await fetchWithTimeout(
        `${env.OPENAI_API_BASE || DEFAULT_OPENAI_API_BASE}/videos/${taskId}`,
        {
          timeout: TIMEOUT.QUICK,
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to check task status");
      }

      const data: any = await response.json();

      if (data.status === "completed") {
        // 下载视频内容
        const videoResponse = await fetchWithTimeout(
          `${env.OPENAI_API_BASE || DEFAULT_OPENAI_API_BASE}/videos/${taskId}/content`,
          {
            timeout: TIMEOUT.DEFAULT,
            headers: { Authorization: `Bearer ${token}` },
            redirect: "follow",
          },
        );

        if (!videoResponse.ok) {
          const error = "Failed to download video content";

          await env.VIDEO_TASK_KV.put(
            taskId,
            JSON.stringify({
              status: "failed",
              id: taskId,
              provider: "openai",
              error,
              failedAt: new Date().toISOString(),
            }),
          );

          return { status: "failed", error };
        }

        // 转为 base64 Data URI
        const videoBuffer = await videoResponse.arrayBuffer();
        const videoBase64 = Buffer.from(videoBuffer).toString("base64");

        await env.VIDEO_TASK_KV.put(
          taskId,
          JSON.stringify({
            status: "success",
            id: taskId,
            provider: "openai",
            completedAt: new Date().toISOString(),
          }),
        );

        return {
          status: "success",
          url: `data:video/mp4;base64,${videoBase64}`,
          type: "base64",
        };
      }

      if (data.status === "failed") {
        const error = "Video generation failed";

        await env.VIDEO_TASK_KV.put(
          taskId,
          JSON.stringify({
            status: "failed",
            id: taskId,
            provider: "openai",
            error,
            failedAt: new Date().toISOString(),
          }),
        );

        return { status: "failed", error };
      }

      // in_progress / queued — 仍在处理中
      return { status: "processing" };
    } catch (error: any) {
      return {
        status: "failed",
        error: error.message || "Video generation failed",
      };
    }
  }
}
