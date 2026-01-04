import type { Context } from "hono";
import { BaseProvider, type ModelConfig } from "./base";
import { runWithTokenRetry, markTokenExhausted } from "../api/token-manager";
import {
  getDimensions,
  extractCompleteEventData,
  uploadToGradio,
  DEFAULT_SYSTEM_PROMPT_CONTENT,
  FIXED_SYSTEM_PROMPT_SUFFIX,
  VIDEO_NEGATIVE_PROMPT,
} from "./utils";

// API URLs
const ZIMAGE_BASE_API_URL = "https://luca115-z-image-turbo.hf.space";
const QWEN_IMAGE_BASE_API_URL = "https://mcp-tools-qwen-image-fast.hf.space";
const OVIS_IMAGE_BASE_API_URL = "https://aidc-ai-ovis-image-7b.hf.space";
const FLUX_SCHNELL_BASE_API_URL =
  "https://black-forest-labs-flux-1-schnell.hf.space";
const QWEN_IMAGE_EDIT_BASE_API_URL =
  "https://linoyts-qwen-image-edit-2509-fast.hf.space";
const POLLINATIONS_API_URL = "https://text.pollinations.ai/openai";
const WAN2_VIDEO_API_URL =
  "https://fradeck619-wan2-2-fp8da-aoti-faster.hf.space";
const UPSCALER_BASE_API_URL = "https://tuan2308-upscaler.hf.space";

/**
 * Hugging Face Provider
 */
export class HuggingFaceProvider extends BaseProvider {
  readonly name = "huggingface";
  readonly supportedActions = [
    "generate",
    "edit",
    "text",
    "video",
    "task-status",
    "upscaler",
  ];

  getModelConfigs(): Record<string, { apiId: string; config: ModelConfig }> {
    return {
      "z-image-turbo": {
        apiId: "z-image-turbo",
        config: {
          id: "huggingface/z-image-turbo",
          name: "Z-Image Turbo (Hugging Face)",
          type: ["text2image"],
          steps: { range: [1, 20], default: 9 },
        },
      },
      "qwen-image": {
        apiId: "qwen-image",
        config: {
          id: "huggingface/qwen-image",
          name: "Qwen Image (Hugging Face)",
          type: ["text2image"],
          steps: { range: [1, 20], default: 8 },
        },
      },
      "ovis-image": {
        apiId: "ovis-image",
        config: {
          id: "huggingface/ovis-image",
          name: "Ovis Image (Hugging Face)",
          type: ["text2image"],
          steps: { range: [1, 50], default: 24 },
          guidance: { range: [1, 10], default: 4 },
        },
      },
      "flux-1-schnell": {
        apiId: "flux-1-schnell",
        config: {
          id: "huggingface/flux-1-schnell",
          name: "FLUX.1 Schnell (Hugging Face)",
          type: ["text2image"],
          steps: { range: [1, 10], default: 4 },
        },
      },
      "qwen-image-edit": {
        apiId: "qwen-image-edit",
        config: {
          id: "huggingface/qwen-image-edit",
          name: "Qwen Image Edit (Hugging Face)",
          type: ["image2image"],
          steps: { range: [1, 20], default: 4 },
          guidance: { range: [0.5, 2], default: 1 },
        },
      },
      realesrgan: {
        apiId: "realesrgan",
        config: {
          id: "huggingface/realesrgan",
          name: "RealESRGAN x4 Plus (Hugging Face)",
          type: ["upscaler"],
        },
      },
      "wan2_2-i2v": {
        apiId: "wan2.2-i2v",
        config: {
          id: "huggingface/wan2.2-i2v",
          name: "Wan2.2 I2V (Hugging Face)",
          type: ["image2video"],
          steps: { range: [1, 20], default: 6 },
          guidance: { range: [1, 10], default: 1 },
        },
      },
      "openai-gpt-4_1-nano": {
        apiId: "openai-fast",
        config: {
          id: "huggingface/openai-gpt-4_1-nano",
          type: ["text2text"],
          name: "OpenAI GPT-4.1 Nano (Pollinations)",
        },
      },
      "openai-gpt-5-nano": {
        apiId: "openai",
        config: {
          id: "huggingface/openai-gpt-5-nano",
          type: ["text2text"],
          name: "OpenAI GPT-5 Nano (Pollinations)",
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
      case "upscaler":
        return this.handleUpscaler(env, params);
      default:
        this.throwUnsupportedAction(action);
    }
  }

  private async handleGenerate(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("huggingface", env, async (token) => {
      const { model, prompt, ar = "1:1", seed, steps, guidance } = params;
      const modelId = this.getApiModelId(model);
      const finalSeed = seed ?? Math.round(Math.random() * 2147483647);
      const { width, height } = getDimensions(ar || "1:1", true);

      let apiBaseUrl: string;
      let data: any[];
      let endpoint: string;

      if (modelId === "flux-1-schnell") {
        apiBaseUrl = FLUX_SCHNELL_BASE_API_URL;
        data = [prompt, finalSeed, false, width, height, steps || 4];
        endpoint = "infer";
      } else if (modelId === "qwen-image") {
        apiBaseUrl = QWEN_IMAGE_BASE_API_URL;
        data = [
          prompt,
          finalSeed,
          seed === undefined,
          ar || "1:1",
          guidance || 3,
          steps || 8,
        ];
        endpoint = "generate_image";
      } else if (modelId === "ovis-image") {
        apiBaseUrl = OVIS_IMAGE_BASE_API_URL;
        data = [prompt, height, width, finalSeed, steps || 24, guidance || 4];
        endpoint = "generate";
      } else {
        // z-image-turbo
        apiBaseUrl = ZIMAGE_BASE_API_URL;
        data = [prompt, height, width, steps || 9, finalSeed, false];
        endpoint = "generate_image";
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const queue = await fetch(`${apiBaseUrl}/gradio_api/call/${endpoint}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ data }),
      });

      const queueResult: any = await queue.json();
      const response = await fetch(
        `${apiBaseUrl}/gradio_api/call/${endpoint}/${queueResult.event_id}`,
        { headers }
      );
      const result = await response.text();
      const eventData = extractCompleteEventData(result);

      if (!eventData) throw new Error("Invalid response from Hugging Face");

      return {
        url: eventData[0].url,
        width,
        height,
        seed: finalSeed,
        steps,
        guidance,
      };
    });
  }

  private async handleEdit(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("huggingface", env, async (token) => {
      const {
        model,
        image,
        prompt,
        width,
        height,
        seed = Math.floor(Math.random() * 2147483647),
        steps = 4,
        guidance = 1,
      } = params;
      const modelId = this.getApiModelId(model);

      if (!image || !Array.isArray(image) || image.length === 0) {
        throw new Error("image parameter is required and must be an array");
      }

      const imagePayloadPromises = image.map(async (blob) => {
        if (typeof blob === "string") {
          return {
            image: { path: blob, meta: { _type: "gradio.FileData" } },
          };
        } else {
          const path = await uploadToGradio(
            QWEN_IMAGE_EDIT_BASE_API_URL,
            blob,
            token
          );
          return { image: { path, meta: { _type: "gradio.FileData" } } };
        }
      });

      const imagePayload = await Promise.all(imagePayloadPromises);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      if (modelId === "qwen-image-edit") {
        const queue = await fetch(
          QWEN_IMAGE_EDIT_BASE_API_URL + "/gradio_api/call/infer",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              data: [
                imagePayload,
                prompt,
                seed,
                false,
                guidance,
                steps,
                height,
                width,
                true,
              ],
            }),
          }
        );

        const queueResult: any = await queue.json();
        const response = await fetch(
          QWEN_IMAGE_EDIT_BASE_API_URL +
            "/gradio_api/call/infer/" +
            queueResult.event_id,
          { headers }
        );
        const result = await response.text();
        const eventData = extractCompleteEventData(result);

        if (!eventData || !eventData[0] || !eventData[0][0]?.image?.url) {
          throw new Error("Invalid response from Hugging Face");
        }

        return {
          url: eventData[0][0].image.url,
          seed,
          steps,
          guidance,
        };
      } else {
        throw new Error("Invalid Model");
      }
    });
  }

  private async handleText(env: any, params: any): Promise<any> {
    const { prompt, model = "openai-fast" } = params;
    const modelId = this.getApiModelId(model);
    const systemInstruction =
      DEFAULT_SYSTEM_PROMPT_CONTENT + FIXED_SYSTEM_PROMPT_SUFFIX;

    const response = await fetch(POLLINATIONS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  }

  private async handleVideo(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("huggingface", env, async (token) => {
      const {
        model,
        imageUrl,
        prompt = "make this image come alive, cinematic motion, smooth animation",
        duration = 3,
        steps = 6,
        guidance = 1,
      } = params;
      const modelId = this.getApiModelId(model);
      const seed = Math.floor(Math.random() * 2147483647);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        if (modelId === "wan2.2-i2v") {
          const queue = await fetch(
            WAN2_VIDEO_API_URL + "/gradio_api/call/generate_video",
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                data: [
                  {
                    path: imageUrl,
                    meta: { _type: "gradio.FileData" },
                  },
                  prompt,
                  steps,
                  VIDEO_NEGATIVE_PROMPT,
                  duration,
                  guidance,
                  guidance,
                  seed,
                  false,
                ],
              }),
            }
          );

          const { event_id: taskId }: any = await queue.json();

          await env.VIDEO_TASK_KV.put(
            taskId,
            JSON.stringify({
              status: "processing",
              id: taskId,
              provider: "huggingface",
              token,
              createdAt: new Date().toISOString(),
            }),
            { expirationTtl: 86400 }
          );

          return { taskId, predict: 60 };
        } else {
          throw new Error("Invalid Model");
        }
      } catch (error: any) {
        console.error(error);
        throw error;
      }
    });
  }

  private async handleTaskStatus(env: any, params: any): Promise<any> {
    const { taskId, token } = params;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const videoResponse = await fetch(
        WAN2_VIDEO_API_URL + "/gradio_api/call/generate_video/" + taskId,
        { headers }
      );
      const text = await videoResponse.text();
      const eventData = extractCompleteEventData(text);

      if (eventData) {
        const vid = eventData[0];
        const videoUrl = vid?.url;

        await env.VIDEO_TASK_KV.put(
          taskId,
          JSON.stringify({
            status: "success",
            url: videoUrl,
            id: taskId,
            provider: "huggingface",
            completedAt: new Date().toISOString(),
          })
        );

        return { status: "success", url: videoUrl };
      }
    } catch (err) {
      await env.VIDEO_TASK_KV.put(
        taskId,
        JSON.stringify({
          status: "failed",
          id: taskId,
          provider: "huggingface",
          error: "Video generation failed",
          failedAt: new Date().toISOString(),
        })
      );

      await markTokenExhausted("huggingface", token, env);

      return {
        status: "failed",
        error: "Video generation failed",
      };
    }
  }

  private async handleUpscaler(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("huggingface", env, async (token) => {
      const { imageUrl } = params;

      if (!imageUrl) {
        throw new Error("imageUrl parameter is required");
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();
      const path = await uploadToGradio(
        QWEN_IMAGE_EDIT_BASE_API_URL,
        imageBlob,
        token
      );

      const queue = await fetch(
        UPSCALER_BASE_API_URL + "/gradio_api/call/realesrgan",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            data: [
              {
                path: `${QWEN_IMAGE_EDIT_BASE_API_URL}/gradio_api/file=${path}`,
                meta: { _type: "gradio.FileData" },
              },
              "RealESRGAN_x4plus",
              0.5,
              false,
              4,
            ],
          }),
        }
      );

      const queueResult: any = await queue.json();
      const response = await fetch(
        UPSCALER_BASE_API_URL +
          "/gradio_api/call/realesrgan/" +
          queueResult.event_id,
        { headers }
      );
      const result = await response.text();
      const eventData = extractCompleteEventData(result);

      if (!eventData || !eventData[0]?.url) {
        throw new Error("Invalid response from Hugging Face");
      }

      return { url: eventData[0].url };
    });
  }
}
