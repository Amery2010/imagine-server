import type { Context } from "hono";
import { BaseProvider, type ModelConfig } from "./base";
import { runWithTokenRetry } from "../api/token-manager";
import {
  getDimensions,
  processFileUpload,
  DEFAULT_SYSTEM_PROMPT_CONTENT,
  FIXED_SYSTEM_PROMPT_SUFFIX,
} from "./utils";
import { fetchWithTimeout, TIMEOUT } from "../utils/fetch-with-timeout";

// API URLs
const MS_GENERATE_API_URL =
  "https://api-inference.modelscope.cn/v1/images/generations";
const MS_CHAT_API_URL =
  "https://api-inference.modelscope.cn/v1/chat/completions";
const MS_TASK_API_BASE_URL = "https://api-inference.modelscope.cn/v1/tasks";
const QWEN_IMAGE_EDIT_BASE_API_URL =
  "https://linoyts-qwen-image-edit-2509-fast.hf.space";

/**
 * Model Scope Provider
 */
export class ModelScopeProvider extends BaseProvider {
  readonly name = "modelscope";
  readonly supportedActions = ["generate", "edit", "text"];

  getModelConfigs(): Record<string, { apiId: string; config: ModelConfig }> {
    return {
      "z-image-turbo": {
        apiId: "Tongyi-MAI/Z-Image-Turbo",
        config: {
          id: "modelscope/z-image-turbo",
          name: "Z-Image Turbo (Model Scope)",
          type: ["text2image"],
          steps: { range: [1, 20], default: 9 },
        },
      },
      "flux-2": {
        apiId: "black-forest-labs/FLUX.2-dev",
        config: {
          id: "modelscope/flux-2",
          name: "FLUX.2 (Model Scope)",
          type: ["text2image"],
          steps: { range: [1, 50], default: 9 },
          guidance: { range: [1, 10], default: 3.5 },
        },
      },
      "flux-1-krea": {
        apiId: "black-forest-labs/FLUX.1-Krea-dev",
        config: {
          id: "modelscope/flux-1-krea",
          name: "FLUX.1 Krea (Model Scope)",
          type: ["text2image"],
          steps: { range: [1, 50], default: 9 },
          guidance: { range: [1, 10], default: 3.5 },
        },
      },
      "flux-1": {
        apiId: "MusePublic/489_ckpt_FLUX_1",
        config: {
          id: "modelscope/flux-1",
          name: "FLUX.1 (Model Scope)",
          type: ["text2image"],
          steps: { range: [1, 50], default: 9 },
          guidance: { range: [1, 10], default: 3.5 },
        },
      },
      "qwen-image-edit": {
        apiId: "Qwen/Qwen-Image-Edit-2509",
        config: {
          id: "modelscope/qwen-image-edit",
          name: "Qwen Image Edit (Model Scope)",
          type: ["image2image"],
          steps: { range: [1, 20], default: 16 },
          guidance: { range: [1, 10], default: 4 },
        },
      },
      "deepseek-v3": {
        apiId: "deepseek-ai/DeepSeek-V3.2",
        config: {
          id: "modelscope/deepseek-v3",
          name: "DeepSeek V3.2 (Model Scope)",
          type: ["text2text"],
        },
      },
      "qwen-3": {
        apiId: "Qwen/Qwen3-Next-80B-A3B-Instruct",
        config: {
          id: "modelscope/qwen-3",
          name: "Qwen 3 (Model Scope)",
          type: ["text2text"],
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
      default:
        this.throwUnsupportedAction(action);
    }
  }

  private async handleGenerate(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("modelscope", env, async (token) => {
      if (!token) {
        throw new Error("Model Scope requires authentication token");
      }

      const { model, prompt, ar, seed, steps, guidance } = params;
      const modelId = this.getApiModelId(model);
      const { width, height } = getDimensions(ar || "1:1", true);
      const finalSeed = seed ?? Math.floor(Math.random() * 2147483647);
      const finalSteps = steps ?? 9;
      const sizeString = `${width}x${height}`;

      const requestBody: any = {
        prompt,
        model: modelId,
        size: sizeString,
        seed: finalSeed,
        steps: finalSteps,
      };

      if (guidance !== undefined) {
        requestBody.guidance = guidance;
      }

      // 步骤 1: 发送异步请求，获取 task_id
      const response = await fetchWithTimeout(MS_GENERATE_API_URL, {
        timeout: TIMEOUT.LONG,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-ModelScope-Async-Mode": "true",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errData: any = await response.json().catch(() => ({}));
        throw new Error(
          errData.message || `Model Scope API Error: ${response.status}`,
        );
      }

      const data: any = await response.json();
      const taskId = data.task_id;

      if (!taskId || typeof taskId !== "string") {
        throw new Error("Invalid response from Model Scope: missing task_id");
      }

      // 步骤 2: 轮询任务状态
      const imageUrl = await this.pollTaskStatus(token, taskId);

      return {
        url: imageUrl,
        width,
        height,
        seed: finalSeed,
        steps: finalSteps,
        guidance,
      };
    });
  }

  private async handleEdit(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("modelscope", env, async (token) => {
      if (!token) {
        throw new Error("Model Scope requires authentication token");
      }

      const {
        model,
        image,
        prompt,
        seed = Math.floor(Math.random() * 2147483647),
        steps = 16,
        guidance = 4,
      } = params;
      const modelId = this.getApiModelId(model);

      if (!image || !Array.isArray(image) || image.length === 0) {
        throw new Error("image parameter is required and must be an array");
      }

      const imagePayloadPromises = image.map(async (blob) => {
        if (typeof blob === "string") {
          return blob;
        } else {
          const pathOrUrl = await processFileUpload(
            blob,
            env,
            QWEN_IMAGE_EDIT_BASE_API_URL,
            token,
            (p) => `${QWEN_IMAGE_EDIT_BASE_API_URL}/gradio_api/file=${p}`,
          );
          return pathOrUrl;
        }
      });

      const imagePayload = await Promise.all(imagePayloadPromises);

      const requestBody: any = {
        prompt,
        model: modelId,
        image_url: imagePayload,
        seed,
        steps,
        guidance: guidance,
      };

      // 步骤 1: 发送异步请求，获取 task_id
      const response = await fetchWithTimeout(MS_GENERATE_API_URL, {
        timeout: TIMEOUT.LONG,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-ModelScope-Async-Mode": "true",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errData: any = await response.json().catch(() => ({}));
        throw new Error(
          errData.message || `Model Scope Image Edit Error: ${response.status}`,
        );
      }

      const data: any = await response.json();
      const taskId = data.task_id;

      if (!taskId || typeof taskId !== "string") {
        throw new Error("Invalid response from Model Scope: missing task_id");
      }

      // 步骤 2: 轮询任务状态
      const resultUrl = await this.pollTaskStatus(token, taskId);

      return {
        url: resultUrl,
        seed,
        steps,
        guidance,
      };
    });
  }

  private async handleText(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("modelscope", env, async (token) => {
      const { prompt, model = "deepseek-ai/DeepSeek-V3.2" } = params;
      const modelId = this.getApiModelId(model);
      const systemInstruction =
        DEFAULT_SYSTEM_PROMPT_CONTENT + FIXED_SYSTEM_PROMPT_SUFFIX;

      const response = await fetchWithTimeout(MS_CHAT_API_URL, {
        timeout: TIMEOUT.SHORT,
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
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error("Prompt optimization failed");
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;

      return { text: content || prompt };
    });
  }

  /**
   * 轮询任务状态，直到任务完成或失败
   * @param token API Token
   * @param taskId 任务 ID
   * @returns 生成的图片 URL
   */
  private async pollTaskStatus(token: string, taskId: string): Promise<string> {
    const maxAttempts = 60; // 最多轮询 60 次（5 分钟）
    const pollInterval = 5000; // 每 5 秒轮询一次

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 等待 5 秒
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const taskUrl = `${MS_TASK_API_BASE_URL}/${taskId}`;
      const response = await fetchWithTimeout(taskUrl, {
        timeout: TIMEOUT.QUICK,
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-ModelScope-Task-Type": "image_generation",
        },
      });

      if (!response.ok) {
        const errData: any = await response.json().catch(() => ({}));
        throw new Error(
          errData.message ||
            `Model Scope Task Status Error: ${response.status}`,
        );
      }

      const taskData: any = await response.json();
      const taskStatus = taskData.task_status;

      if (taskStatus === "SUCCEED") {
        const imageUrl = taskData.output_images?.[0];
        if (!imageUrl) {
          throw new Error("Invalid task response: missing output_images");
        }
        return imageUrl;
      } else if (taskStatus === "FAILED") {
        throw new Error(
          `Model Scope task failed: ${taskData.error_message || "Unknown error"}`,
        );
      }

      // 任务仍在进行中，继续轮询
    }

    throw new Error(
      "Model Scope task timeout: exceeded maximum polling attempts",
    );
  }
}
