import type { Context } from "hono";
import { BaseProvider, type ModelConfig } from "./base";
import { runWithTokenRetry } from "../api/token-manager";
import {
  getDimensions,
  uploadToGradio,
  DEFAULT_SYSTEM_PROMPT_CONTENT,
  FIXED_SYSTEM_PROMPT_SUFFIX,
} from "./utils";

// API URLs
const MS_GENERATE_API_URL =
  "https://api-inference.modelscope.cn/v1/images/generations";
const MS_CHAT_API_URL =
  "https://api-inference.modelscope.cn/v1/chat/completions";
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

      const response = await fetch(MS_GENERATE_API_URL, {
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
          errData.message || `Model Scope API Error: ${response.status}`
        );
      }

      const data: any = await response.json();
      const imageUrl = data.images?.[0]?.url;

      if (!imageUrl) {
        throw new Error("Invalid response from Model Scope");
      }

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
          const url = await uploadToGradio(
            QWEN_IMAGE_EDIT_BASE_API_URL,
            blob,
            token
          );
          return url;
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

      const response = await fetch(MS_GENERATE_API_URL, {
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
          errData.message || `Model Scope Image Edit Error: ${response.status}`
        );
      }

      const data: any = await response.json();
      const resultUrl = data.images?.[0]?.url;

      if (!resultUrl) {
        throw new Error("Invalid response from Model Scope");
      }

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

      const response = await fetch(MS_CHAT_API_URL, {
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
}
