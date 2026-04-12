import type { Context } from "hono";
import { BaseProvider, type ModelConfig } from "./base";
import { runWithTokenRetry } from "../api/token-manager";
import { getBaseDimensions } from "./utils";
import { fetchWithTimeout, TIMEOUT } from "../utils/fetch-with-timeout";

const A4F_BASE_URL = "https://api.a4f.co/v1";

/**
 * A4F Provider
 * 支持图片生成和文本生成模型
 */
export class A4FProvider extends BaseProvider {
  readonly name = "a4f";
  readonly supportedActions = ["generate", "text"];

  getModelConfigs(): Record<string, { apiId: string; config: ModelConfig }> {
    return {
      // 图片生成模型
      "z-image": {
        apiId: "provider-8/z-image",
        config: {
          id: "a4f/z-image",
          name: "Z-Image Turbo (A4F)",
          type: ["text2image"],
        },
      },
      "imagen-4": {
        apiId: "provider-4/imagen-4",
        config: {
          id: "a4f/imagen-4",
          name: "Imagine 4 (A4F)",
          type: ["text2image"],
        },
      },
      "imagen-3.5": {
        apiId: "provider-4/imagen-3.5",
        config: {
          id: "a4f/imagen-3.5",
          name: "Imagine 3.5 (A4F)",
          type: ["text2image"],
        },
      },
      "flux-schnell": {
        apiId: "provider-4/flux-schnell",
        config: {
          id: "a4f/flux-schnell",
          name: "FLUX.1 Schnell (A4F)",
          type: ["text2image"],
        },
      },
      // 文本生成模型
      "gemini-2.5-flash-lite": {
        apiId: "provider-5/gemini-2.5-flash-lite",
        config: {
          id: "a4f/gemini-2.5-flash-lite",
          name: "Gemini 2.5 Flash-Lite (A4F)",
          type: ["text2text"],
        },
      },
      "gemini-2.0-flash": {
        apiId: "provider-8/gemini-2.0-flash",
        config: {
          id: "a4f/gemini-2.0-flash",
          name: "Gemini 2.0 Flash (A4F)",
          type: ["text2text"],
        },
      },
      "deepseek-v3.1": {
        apiId: "provider-2/deepseek-v3.1",
        config: {
          id: "a4f/deepseek-v3.1",
          name: "DeepSeek V3.1 (A4F)",
          type: ["text2text"],
        },
      },
      "deepseek-r1-0528": {
        apiId: "provider-3/deepseek-r1-0528",
        config: {
          id: "a4f/deepseek-r1-0528",
          name: "DeepSeek R1 (A4F)",
          type: ["text2text"],
        },
      },
      "qwen3-235b": {
        apiId: "provider-8/qwen3-235b",
        config: {
          id: "a4f/qwen3-235b",
          name: "Qwen 3 (A4F)",
          type: ["text2text"],
        },
      },
      "kimi-k2-thinking": {
        apiId: "provider-8/kimi-k2-thinking",
        config: {
          id: "a4f/kimi-k2-thinking",
          name: "Kimi K2 Thinking (A4F)",
          type: ["text2text"],
        },
      },
      "glm-4.5": {
        apiId: "provider-8/glm-4.5",
        config: {
          id: "a4f/glm-4.5",
          name: "GLM 4.5 (A4F)",
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
      case "text":
        return this.handleText(env, params);
      default:
        this.throwUnsupportedAction(action);
    }
  }

  private async handleGenerate(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("a4f", env, async (token) => {
      if (!token) {
        throw new Error("A4F API token is required");
      }

      const { model, prompt, ar = "1:1", n = 1 } = params;
      const modelId = this.getApiModelId(model);

      // 将宽高比转换为 size 参数
      const { width, height } = getBaseDimensions(ar);
      const size = `${width}x${height}`;

      const response = await fetchWithTimeout(`${A4F_BASE_URL}/images/generations`, {
        timeout: TIMEOUT.LONG,
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          prompt,
          n,
          size,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `A4F API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result: any = await response.json();

      if (!result.data || !result.data[0] || !result.data[0].url) {
        throw new Error("Invalid response from A4F API");
      }

      return {
        url: result.data[0].url,
        width,
        height,
        revised_prompt: result.data[0].revised_prompt,
      };
    });
  }

  private async handleText(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("a4f", env, async (token) => {
      if (!token) {
        throw new Error("A4F API token is required");
      }

      const {
        prompt,
        model = "provider-8/gemini-2.0-flash",
        temperature = 0.7,
        max_tokens = 1000,
      } = params;
      const modelId = this.getApiModelId(model);

      const response = await fetchWithTimeout(`${A4F_BASE_URL}/chat/completions`, {
        timeout: TIMEOUT.SHORT,
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature,
          max_tokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `A4F API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result: any = await response.json();

      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        throw new Error("Invalid response from A4F API");
      }

      return {
        text: result.choices[0].message.content,
        usage: result.usage,
      };
    });
  }
}
