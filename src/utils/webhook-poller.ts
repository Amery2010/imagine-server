import type { Context } from "hono";
import type { Bindings } from "../types";
import { fireWebhook } from "./webhook";
import { providerRegistry } from "../providers/registry";
import { decryptTokenFromStorage } from "../api/token-manager";

/**
 * 轮询任务状态并在完成或失败时触发 Webhook
 *
 * 适用于支持 `c.executionCtx.waitUntil(pollAndFireWebhook(...))` 的无服务器环境。
 */
export async function pollAndFireWebhook(
  providerName: string,
  taskId: string,
  webhookUrl: string,
  env: Bindings,
) {
  const provider = providerRegistry.get(providerName);
  if (!provider) {
    console.error(`[Webhook] Provider ${providerName} not found for webhook polling.`);
    return;
  }

  // 构建一个伪造的 Context，因为大多 provider.handleRequest 只需要 c.env
  const mockContext = { env } as unknown as Context;

  // 轮询配置: 最多尝试 120 次，每次间隔 5 秒 (即最长轮询 10 分钟)
  const maxAttempts = 120;
  const pollInterval = 5000;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      // 每次轮询重新从 KV 获取 token（以防跨 worker 取不到准确的内存状态）
      if (!env.VIDEO_TASK_KV) break;
      const kvResult = await env.VIDEO_TASK_KV.get(taskId);
      if (!kvResult) break; // 任务被意外删除
      
      const taskData = JSON.parse(kvResult);
      if (taskData.status === "success" || taskData.status === "failed") {
        // 已经被其他请求处理完毕
        break; 
      }
      
      const decryptedToken = await decryptTokenFromStorage(taskData.token, env);

      const result = await provider.handleRequest(mockContext, "task-status", {
        taskId,
        token: decryptedToken,
      });

      // 如果任务结束，触发请求并退出轮询
      if (result.status === "success" || result.status === "completed") {
        await fireWebhook(
          webhookUrl,
          {
            taskId,
            provider: providerName,
            status: "completed",
            result: result,
          },
          env,
        );
        return;
      }

      if (result.status === "error" || result.status === "failed") {
        await fireWebhook(
          webhookUrl,
          {
            taskId,
            provider: providerName,
            status: "failed",
            error: result.error || result.message || "Unknown error",
          },
          env,
        );
        return;
      }
    } catch (e: any) {
      console.warn(`[Webhook] Error polling task ${taskId}:`, e.message);
      // 网络错误等情况继续重试
    }

    // 等待下一次轮询
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // 超时未完成，触发失败 Webhook
  await fireWebhook(
    webhookUrl,
    {
      taskId,
      provider: providerName,
      status: "failed",
      error: "Task polling timeout exceeded (10 minutes)",
    },
    env,
  );
}
