import type { Context } from "hono";
import { BaseProvider, type ModelConfig } from "./base";
import { runWithTokenRetry } from "../api/token-manager";
import {
  getDimensions,
  DEFAULT_SYSTEM_PROMPT_CONTENT,
  FIXED_SYSTEM_PROMPT_SUFFIX,
  VIDEO_NEGATIVE_PROMPT,
} from "./utils";

// API URLs
const GITEE_GENERATE_API_URL = "https://ai.gitee.com/v1/images/generations";
const GITEE_EDIT_API_URL = "https://ai.gitee.com/v1/images/edits";
const GITEE_CHAT_API_URL = "https://ai.gitee.com/v1/chat/completions";
const GITEE_VIDEO_TASK_API_URL =
  "https://ai.gitee.com/v1/async/videos/image-to-video";
const GITEE_TASK_STATUS_API_URL = "https://ai.gitee.com/api/v1/task";

/**
 * Gitee AI Provider
 */
export class GiteeProvider extends BaseProvider {
  readonly name = "gitee";
  readonly supportedActions = [
    "generate",
    "edit",
    "text",
    "video",
    "task-status",
  ];

  getModelConfigs(): Record<string, { apiId: string; config: ModelConfig }> {
    return {
      "z-image-turbo": {
        apiId: "z-image-turbo",
        config: {
          id: "gitee/z-image-turbo",
          name: "Z-Image Turbo (Gitee AI)",
          type: ["text2image"],
          steps: { range: [1, 20], default: 9 },
        },
      },
      "qwen-image": {
        apiId: "Qwen-Image",
        config: {
          id: "gitee/qwen-image",
          name: "Qwen Image (Gitee AI)",
          type: ["text2image"],
          steps: { range: [1, 20], default: 9 },
        },
      },
      "flux-2": {
        apiId: "FLUX.2-dev",
        config: {
          id: "gitee/flux-2",
          name: "FLUX.2 (Gitee AI)",
          type: ["text2image"],
          steps: { range: [1, 50], default: 9 },
          guidance: { range: [1, 10], default: 3.5 },
        },
      },
      "flux-1-schnell": {
        apiId: "flux-1-schnell",
        config: {
          id: "gitee/flux-1-schnell",
          name: "FLUX.1 Schnell (Gitee AI)",
          type: ["text2image"],
          steps: { range: [1, 10], default: 9 },
        },
      },
      "flux-1-krea": {
        apiId: "FLUX_1-Krea-dev",
        config: {
          id: "gitee/flux-1-krea",
          name: "FLUX.1 Krea (Gitee AI)",
          type: ["text2image"],
          steps: { range: [1, 50], default: 9 },
          guidance: { range: [1, 10], default: 3.5 },
        },
      },
      "flux-1": {
        apiId: "FLUX.1-dev",
        config: {
          id: "gitee/flux-1",
          name: "FLUX.1 (Gitee AI)",
          type: ["text2image"],
          steps: { range: [1, 50], default: 9 },
          guidance: { range: [1, 10], default: 3.5 },
        },
      },
      "qwen-image-edit": {
        apiId: "Qwen-Image-Edit",
        config: {
          id: "gitee/qwen-image-edit",
          name: "Qwen Image Edit (Gitee AI)",
          type: ["image2image"],
          steps: { range: [1, 20], default: 16 },
          guidance: { range: [1, 10], default: 4 },
        },
      },
      "wan2.2-i2v": {
        apiId: "Wan2_2-I2V-A14B",
        config: {
          id: "gitee/wan2.2-i2v",
          name: "Wan2.2 I2V (Gitee AI)",
          type: ["image2video"],
          steps: { range: [1, 20], default: 10 },
          guidance: { range: [1, 10], default: 4 },
        },
      },
      "deepseek-v3": {
        apiId: "DeepSeek-V3.2",
        config: {
          id: "gitee/deepseek-v3",
          name: "DeepSeek V3.2 (Gitee AI)",
          type: ["text2text"],
        },
      },
      "qwen-3": {
        apiId: "Qwen3-Next-80B-A3B-Instruct",
        config: {
          id: "gitee/qwen-3",
          name: "Qwen 3 (Gitee AI)",
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
      case "video":
        return this.handleVideo(env, params);
      case "task-status":
        return this.handleTaskStatus(env, params);
      default:
        this.throwUnsupportedAction(action);
    }
  }

  private async handleGenerate(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("gitee", env, async (token) => {
      const { model, prompt, ar = "1:1", seed, steps, guidance } = params;
      const modelId = this.getApiModelId(model);
      const { width, height } = getDimensions(ar, true, modelId);
      const finalSeed = seed ?? Math.floor(Math.random() * 2147483647);
      const finalSteps = steps ?? 9;

      const requestBody: any = {
        prompt,
        model: modelId,
        width,
        height,
        seed: finalSeed,
        num_inference_steps: finalSteps,
        response_format: "url",
      };

      if (guidance !== undefined) {
        requestBody.guidance_scale = guidance;
      }

      const response = await fetch(GITEE_GENERATE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errData: any = await response.json().catch(() => ({}));
        throw new Error(
          errData.message || `Gitee AI API Error: ${response.status}`
        );
      }

      const data: any = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].url) {
        throw new Error("Invalid response from Gitee AI");
      }

      return {
        url: data.data[0].url,
        width,
        height,
        seed: finalSeed,
        steps: finalSteps,
        guidance,
      };
    });
  }

  private async handleEdit(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("gitee", env, async (token) => {
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

      const formData = new FormData();
      formData.append("prompt", prompt);
      formData.append("model", modelId);
      formData.append("num_inference_steps", steps.toString());
      formData.append("cfg_scale", guidance.toString());
      formData.append("seed", seed);
      formData.append("response_format", "url");
      formData.append(
        "lora_weights",
        JSON.stringify({
          url: "https://gitee.com/realhugh/materials/raw/master/Qwen-Image-Edit-Lightning-8steps-V1.0.safetensors",
          weight: 1,
        })
      );

      image.forEach((blob) => {
        formData.append("image", blob);
      });

      const response = await fetch(GITEE_EDIT_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData: any = await response.json().catch(() => ({}));
        throw new Error(
          errData.message || `Gitee AI Image Edit Error: ${response.status}`
        );
      }

      const data: any = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].url) {
        throw new Error("Invalid response from Gitee AI");
      }

      return {
        url: data.data[0].url,
        seed,
        steps,
        guidance,
      };
    });
  }

  private async handleText(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("gitee", env, async (token) => {
      const { model, prompt } = params;
      const modelId = this.getApiModelId(model);
      const systemInstruction =
        DEFAULT_SYSTEM_PROMPT_CONTENT + FIXED_SYSTEM_PROMPT_SUFFIX;

      const response = await fetch(GITEE_CHAT_API_URL, {
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

  private async handleVideo(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("gitee", env, async (token) => {
      const {
        model,
        imageUrl,
        width,
        height,
        prompt = "make this image come alive, cinematic motion, smooth animation",
        duration = 3,
        steps = 10,
        guidance = 4,
      } = params;
      const modelId = this.getApiModelId(model);
      const numFrames = Math.round(duration * 16);

      const formData = new FormData();
      formData.append("image", imageUrl);
      formData.append("prompt", prompt);
      formData.append("negative_prompt", VIDEO_NEGATIVE_PROMPT);
      formData.append("model", modelId);
      formData.append("num_inferenece_steps", steps.toString());
      formData.append("num_frames", numFrames.toString());
      formData.append("guidance_scale", guidance.toString());
      formData.append("height", height.toString());
      formData.append("width", width.toString());

      const response = await fetch(GITEE_VIDEO_TASK_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const err: any = await response.json();
        throw new Error(err.message || "Video task creation failed");
      }

      const data: any = await response.json();
      if (!data.task_id) throw new Error("No task ID returned");

      const taskId = data.task_id;

      await env.VIDEO_TASK_KV.put(
        taskId,
        JSON.stringify({
          status: "processing",
          id: taskId,
          provider: "gitee",
          token,
          createdAt: new Date().toISOString(),
        }),
        { expirationTtl: 86400 }
      );

      return { taskId, predict: 400 };
    });
  }

  private async handleTaskStatus(env: any, params: any): Promise<any> {
    const { taskId, token } = params;

    try {
      const response = await fetch(`${GITEE_TASK_STATUS_API_URL}/${taskId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to check task status");

      const data: any = await response.json();
      const result: any = { status: data.status };

      if (data.status === "success" && data.output?.file_url) {
        result.url = data.output.file_url;

        await env.VIDEO_TASK_KV.put(
          taskId,
          JSON.stringify({
            status: "success",
            id: taskId,
            provider: "gitee",
            url: result.url,
            completedAt: new Date().toISOString(),
          })
        );

        return { status: "success", url: result.url };
      } else if (data.status === "failure") {
        result.status = "failed";
        result.error =
          data.output?.error ||
          data.output?.message ||
          "Video generation failed";

        await env.VIDEO_TASK_KV.put(
          taskId,
          JSON.stringify({
            status: "failed",
            id: taskId,
            provider: "gitee",
            error: result.error || "Video generation failed",
            failedAt: new Date().toISOString(),
          })
        );

        return {
          status: "failed",
          error: result.error || "Video generation failed",
        };
      }
    } catch (error: any) {
      return {
        status: "failed",
        error: "Video generation failed",
      };
    }
  }
}
