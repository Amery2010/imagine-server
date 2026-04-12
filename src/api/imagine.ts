import type { Context } from "hono";
import { z } from "zod";
import {
  providerRegistry,
  getAvailableModels,
  getAvailableModelsFiltered,
} from "../providers";
import { processGeneratedResult } from "../providers/utils";
import { decryptTokenFromStorage } from "./token-manager";
import { pollAndFireWebhook } from "../utils/webhook-poller";

/**
 * 获取所有可用模型列表
 */
export { getAvailableModels, getAvailableModelsFiltered };

/**
 * 统一的 AI 服务代理 API
 *
 * 这个函数作为所有 Provider 的统一入口点，负责：
 * 1. 解析请求参数
 * 2. 识别目标 Provider
 * 3. 将请求委托给相应的 Provider 处理
 */
export async function proxyRequest(c: Context) {
  try {
    const action = c.req.param("action");

    // 映射 API action 到 Provider action
    const actionMap: Record<string, string> = {
      imagine: "generate",
      edit: "edit",
      text: "text",
      video: "video",
      upscaler: "upscaler",
      "task-status": "task-status",
    };

    const providerAction = actionMap[action] || action;
    let model: string;
    let params: any;

    if (action === "edit") {
      const formData = await c.req.formData();
      model = formData.get("model") as string;

      if (!model || typeof model !== "string") {
        return c.json(
          {
            error: "Invalid parameters",
            message: "model is required as string",
          },
          400,
        );
      }

      // 提取所有参数
      params = {};
      for (const [key, value] of formData.entries()) {
        if (key === "model") continue;

        // 处理 image 数组
        if (key === "image") {
          if (!params.image) {
            params.image = [];
          }
          params.image.push(value);
        } else {
          params[key] = value;
        }
      }

      if (!params.image || params.image.length === 0) {
        return c.json(
          {
            error: "Invalid parameters",
            message: "image parameter is required for edit action",
          },
          400,
        );
      }
    } else {
      // 其他 action 使用 JSON，并通过 zod 提前验证边界
      const body = await c.req.json().catch(() => ({}));

      const baseSchema = z
        .object({
          model: z.string().min(1, "model is required"),
        })
        .passthrough();

      const parseResult = baseSchema.safeParse(body);
      if (!parseResult.success) {
        return c.json(
          {
            error: "Invalid parameters",
            message: parseResult.error.issues[0].message,
          },
          400,
        );
      }

      const { model: _, ...rest } = parseResult.data;
      model = _;
      params = rest;
    }

    if (!action) {
      return c.json(
        {
          error: "Missing action",
          message: "action parameter is required in URL",
        },
        400,
      );
    }

    // 解析 provider/model 格式
    const { provider: providerName, model: modelKey } =
      providerRegistry.parseModelId(model);

    // 获取 Provider
    const provider = providerRegistry.get(providerName);

    if (!provider) {
      return c.json(
        {
          error: "Invalid provider",
          message: `Provider '${providerName}' is not supported. Available providers: ${providerRegistry
            .getProviderNames()
            .join(", ")}`,
        },
        400,
      );
    }

    // 委托给 Provider 处理
    const result = await provider.handleRequest(c, providerAction, {
      model: modelKey,
      ...params,
    });

    // 如果 provider 返回的是 Response 对象（流式），直接透传
    if (result instanceof Response) {
      return result;
    }

    // 后台提交 Webhook 轮询（如果支持）
    const webhookUrl = params.webhookUrl;
    if (webhookUrl && result.taskId && typeof c.executionCtx?.waitUntil === "function") {
      c.executionCtx.waitUntil(
        pollAndFireWebhook(providerName, result.taskId, webhookUrl, c.env)
      );
    }

    // 拦截结果并走统一存储逻辑
    const finalResult = await processGeneratedResult(result, c.env);

    return c.json(finalResult);
  } catch (error: any) {
    console.error("Proxy request error:", error);
    return c.json(
      {
        error: "Request failed",
        message:
          error.message || "An error occurred while processing the request",
      },
      500,
    );
  }
}

/**
 * 获取任务状态（向后兼容的 API）
 *
 * 这个函数保持了原有的 API 接口，用于查询异步任务的状态
 */
export async function getTaskStatus(c: Context) {
  try {
    const taskId = c.req.query("taskId");

    if (!taskId) {
      return c.json({ error: "taskId is required" }, 400);
    }

    const env = c.env;

    const kvResult = await env.VIDEO_TASK_KV.get(taskId);
    if (kvResult) {
      let taskData: any;
      try {
        taskData = JSON.parse(kvResult);
      } catch {
        return c.json(
          { status: "error", message: "Corrupted task data in storage" },
          500,
        );
      }

      if (taskData.status === "processing") {
        const provider = providerRegistry.get(taskData.provider);

        if (!provider) {
          return c.json(
            {
              status: "error",
              message: `Provider '${taskData.provider}' not found`,
            },
            404,
          );
        }

        // 解密 KV 中加密存储的 token
        const decryptedToken = await decryptTokenFromStorage(
          taskData.token,
          c.env,
        );

        const result = await provider.handleRequest(c, "task-status", {
          taskId,
          token: decryptedToken,
        });

        const finalResult = await processGeneratedResult(result, c.env);
        return c.json(finalResult);
      } else if (taskData.status === "success") {
        const urlObj = { url: taskData.url };
        const finalUrlObj = await processGeneratedResult(urlObj, c.env);
        return c.json({
          status: "success",
          url: finalUrlObj.url,
        });
      } else {
        return c.json({
          status: "error",
          error: taskData.error,
        });
      }
    } else {
      return c.json(
        {
          status: "error",
          message: "The task ID does not exist or has expired",
        },
        404,
      );
    }
  } catch (error: any) {
    return c.json({ status: "error", message: error.message }, 500);
  }
}
