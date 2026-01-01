import type { Context } from "hono";
import {
  providerRegistry,
  getAvailableModels,
  getAvailableModelsFiltered,
} from "../providers";

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

    // 对于 edit action，使用 FormData
    let model: string;
    let params: any;

    if (action === "edit") {
      const formData = await c.req.formData();
      model = formData.get("model") as string;

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
    } else {
      // 其他 action 使用 JSON
      const body = await c.req.json();
      model = body.model;
      const { model: _, ...rest } = body;
      params = rest;
    }

    if (!model) {
      return c.json(
        {
          error: "Missing required parameters",
          message: "model is required",
        },
        400
      );
    }

    if (!action) {
      return c.json(
        {
          error: "Missing action",
          message: "action parameter is required in URL",
        },
        400
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
        400
      );
    }

    // 委托给 Provider 处理
    const result = await provider.handleRequest(c, action, {
      model: modelKey,
      ...params,
    });

    return c.json(result);
  } catch (error: any) {
    console.error("Proxy request error:", error);
    return c.json(
      {
        error: "Request failed",
        message:
          error.message || "An error occurred while processing the request",
      },
      500
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
      const taskData = JSON.parse(kvResult);

      if (taskData.status === "processing") {
        const provider = providerRegistry.get(taskData.provider);

        if (!provider) {
          return c.json(
            {
              status: "error",
              message: `Provider '${taskData.provider}' not found`,
            },
            404
          );
        }

        const result = await provider.handleRequest(c, "task-status", {
          taskId,
          token: taskData.token,
        });

        return c.json(result);
      } else if (taskData.status === "success") {
        return c.json({
          status: "success",
          url: taskData.url,
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
        404
      );
    }
  } catch (error: any) {
    return c.json({ status: "error", message: error.message }, 500);
  }
}
