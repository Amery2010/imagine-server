import { createHmac } from "crypto";
import type { Bindings } from "../types";
import { fetchWithTimeout, TIMEOUT } from "./fetch-with-timeout";

export interface WebhookPayload {
  taskId: string;
  status: "completed" | "failed";
  result?: any;
  error?: string;
  provider: string;
}

/**
 * 触发 Webhook 回调并使用签名保护
 *
 * 如果配置了 WEBHOOK_SECRET，将会计算 HMAC-SHA256 并在
 * x-webhook-signature Header 中发送。
 */
export async function fireWebhook(
  url: string,
  payload: WebhookPayload,
  env: Bindings,
): Promise<boolean> {
  try {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (env.WEBHOOK_SECRET) {
      const signature = createHmac("sha256", env.WEBHOOK_SECRET)
        .update(body)
        .digest("hex");
      headers["x-webhook-signature"] = `sha256=${signature}`;
    }

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers,
      body,
      timeout: TIMEOUT.SHORT, // Webhook 接收端应该快速响应
    });

    if (!response.ok) {
      console.warn(`[Webhook] Failed to fire webhook to ${url}: ${response.status}`);
      return false;
    }

    console.log(`[Webhook] Successfully fired callback to ${url} for task ${payload.taskId}`);
    return true;
  } catch (error) {
    console.error(`[Webhook] Error firing webhook to ${url}:`, error);
    return false;
  }
}
