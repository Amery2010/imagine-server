import type { Context } from "hono";
import { BaseProvider, type ModelConfig } from "./base";
import { runWithTokenRetry } from "../api/token-manager";
import { getDimensions } from "./utils";
import { fetchWithTimeout, TIMEOUT } from "../utils/fetch-with-timeout";

const MODELSLAB_API_URL = "https://modelslab.com/api/v6";

/**
 * ModelsLab Provider
 * Supports text-to-image and text-to-video generation.
 * Uses MODELSLAB_TOKENS for multi-key rotation.
 *
 * @see https://docs.modelslab.com/image-generation/overview
 */
export class ModelsLabProvider extends BaseProvider {
  readonly name = "modelslab";
  readonly supportedActions = ["generate", "video"];

  getModelConfigs(): Record<string, { apiId: string; config: ModelConfig }> {
    return {
      flux: {
        apiId: "flux",
        config: {
          id: "modelslab/flux",
          name: "Flux (ModelsLab)",
          type: ["text2image"],
          steps: { range: [1, 50], default: 30 },
          guidance: { range: [1, 20], default: 7.5 },
        },
      },
      "flux-dev": {
        apiId: "flux-dev",
        config: {
          id: "modelslab/flux-dev",
          name: "Flux Dev (ModelsLab)",
          type: ["text2image"],
          steps: { range: [1, 50], default: 30 },
        },
      },
      sdxl: {
        apiId: "sdxl",
        config: {
          id: "modelslab/sdxl",
          name: "Stable Diffusion XL (ModelsLab)",
          type: ["text2image"],
          steps: { range: [1, 50], default: 30 },
          guidance: { range: [1, 20], default: 7.5 },
        },
      },
      "realistic-vision": {
        apiId: "realistic-vision-v6",
        config: {
          id: "modelslab/realistic-vision",
          name: "Realistic Vision v6 (ModelsLab)",
          type: ["text2image"],
          steps: { range: [1, 50], default: 30 },
          guidance: { range: [1, 20], default: 7.5 },
        },
      },
      "cogvideox-5b": {
        apiId: "cogvideox-5b",
        config: {
          id: "modelslab/cogvideox-5b",
          name: "CogVideoX-5B (ModelsLab)",
          type: ["text2video"],
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
      case "video":
        return this.handleVideo(env, params);
      default:
        this.throwUnsupportedAction(action);
    }
  }

  private async handleGenerate(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("modelslab", env, async (token) => {
      if (!token) {
        throw new Error("ModelsLab API key is required");
      }

      const {
        model,
        prompt,
        ar = "1:1",
        seed,
        steps = 30,
        guidance = 7.5,
        negativePrompt,
      } = params;

      const modelId = this.getApiModelId(model);
      const { width, height } = getDimensions(ar, false);
      const finalSeed = seed ?? Math.floor(Math.random() * 2147483647);

      const body: Record<string, any> = {
        key: token,
        prompt,
        model_id: modelId,
        width: String(width),
        height: String(height),
        samples: "1",
        num_inference_steps: String(steps),
        guidance_scale: guidance,
        safety_checker: "no",
        seed: finalSeed,
      };

      if (negativePrompt) {
        body.negative_prompt = negativePrompt;
      }

      const response = await fetchWithTimeout(`${MODELSLAB_API_URL}/images/text2img`, {
        timeout: TIMEOUT.LONG,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `ModelsLab API error: ${response.status} ${response.statusText}`,
        );
      }

      const data: any = await response.json();

      if (data.status === "error") {
        const msg = data.message ?? data.messege ?? "Unknown ModelsLab error";
        throw new Error(`ModelsLab: ${msg}`);
      }

      const imageUrl = data.output?.[0];
      if (!imageUrl) {
        throw new Error("ModelsLab returned no images");
      }

      return {
        url: imageUrl,
        width,
        height,
        seed: finalSeed,
        steps,
        guidance,
      };
    });
  }

  private async handleVideo(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("modelslab", env, async (token) => {
      if (!token) {
        throw new Error("ModelsLab API key is required");
      }

      const { model, prompt, steps = 20 } = params;
      const modelId = this.getApiModelId(model);

      const body = {
        key: token,
        prompt,
        model_id: modelId,
        num_inference_steps: String(steps),
      };

      const response = await fetchWithTimeout(`${MODELSLAB_API_URL}/video/text2video`, {
        timeout: TIMEOUT.LONG,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`ModelsLab Video API error: ${response.status}`);
      }

      const data: any = await response.json();

      if (data.status === "error") {
        const msg = data.message ?? data.messege ?? "Unknown error";
        throw new Error(`ModelsLab video: ${msg}`);
      }

      // May return a URL directly or a processing status
      const videoUrl = data.output?.[0] ?? data.link;
      if (!videoUrl) {
        // Return task id for async polling
        return { taskId: data.id, status: "processing" };
      }

      return { url: videoUrl };
    });
  }
}
