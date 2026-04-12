/**
 * 带超时的 fetch 封装
 *
 * 使用 AbortController 实现请求超时。
 * 兼容 Cloudflare Workers、Node.js 18+、Vercel Edge 等标准 Web API 环境。
 *
 * 默认超时 60 秒。对于图片/视频生成等长时间操作可自定义。
 */

/** 超时时间常量（毫秒） */
export const TIMEOUT = {
  /** 文本生成、简单查询 */
  SHORT: 30_000,
  /** 默认超时 */
  DEFAULT: 60_000,
  /** 图片/视频生成等长时间操作 */
  LONG: 120_000,
  /** 任务状态查询等轻量操作 */
  QUICK: 15_000,
  /** Webhook 回调等外部通知 */
  WEBHOOK: 10_000,
} as const;

export interface FetchWithTimeoutInit extends RequestInit {
  /** 超时时间（毫秒），默认 60000 */
  timeout?: number;
}

/**
 * 带超时的 fetch
 *
 * @param url - 请求的 URL
 * @param init - 标准 fetch 的 RequestInit 扩展，增加 timeout 字段
 * @returns Promise<Response>
 * @throws Error 超时时抛出 "Request timed out after Xms"
 *
 * @example
 * ```typescript
 * // 使用默认超时（60s）
 * const res = await fetchWithTimeout("https://api.example.com/generate");
 *
 * // 使用自定义超时
 * const res = await fetchWithTimeout("https://api.example.com/video", {
 *   method: "POST",
 *   timeout: TIMEOUT.LONG,
 *   body: JSON.stringify({ prompt: "..." }),
 * });
 * ```
 */
export async function fetchWithTimeout(
  url: string | URL,
  init?: FetchWithTimeoutInit,
): Promise<Response> {
  const { timeout = TIMEOUT.DEFAULT, ...fetchInit } = init || {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeout}ms`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
