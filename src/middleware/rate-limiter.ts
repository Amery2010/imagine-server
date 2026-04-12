import type { Context, Next } from "hono";
import type { Bindings } from "../types";

export interface RateLimiterOptions {
  limit: number; // 窗口期内允许的最大请求数
  windowMs: number; // 窗口持续时间（毫秒）
}

/**
 * 固定窗口速率限制器中间件 (Fixed Window Rate Limiter)
 *
 * 基于用户的 Token（如果提供）或 IP 地址来进行限流。
 * 跨 Worker 状态使用全局 `env.storage` 保持（KV 或 Redis）。
 *
 * 响应会附带标准 RateLimit Headers：
 * - X-RateLimit-Limit: 限制总量
 * - X-RateLimit-Remaining: 剩余额度
 * - X-RateLimit-Reset: 重置时间的 Unix 时间戳（毫秒）
 */
export function rateLimiter(options: RateLimiterOptions) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const storage = c.env.storage;
    if (!storage) {
      // 如果没有存储层（如某种测试环境），直接放行
      return await next();
    }

    // 优先使用 Token 标识，否则降级使用 IP
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const ip =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for") ||
      "anonymous";
      
    // 防止 key 过长，如果 token 存在只截取前 16 位以用于标识
    const identifier = token ? `t:${token.substring(0, 16)}` : `i:${ip}`;

    // 计算当前固定窗口 ID
    const windowId = Math.floor(Date.now() / options.windowMs);
    const key = `rl:${identifier}:${windowId}`;

    // 获取当前窗口计数
    const currentCount = ((await storage.getItem(key)) as number) || 0;
    const limit = options.limit;
    const resetTime = (windowId + 1) * options.windowMs;

    // 写入 Header
    c.res.headers.set("X-RateLimit-Limit", limit.toString());
    c.res.headers.set("X-RateLimit-Reset", resetTime.toString());

    if (currentCount >= limit) {
      c.res.headers.set("X-RateLimit-Remaining", "0");
      return c.json(
        {
          error: "Too Many Requests",
          message: `Rate limit exceeded. Try again at ${new Date(resetTime).toISOString()}.`,
        },
        429,
      );
    }

    // 记录本次请求 (注意：高并发分布式环境下有极小的 Race Condition 并发超额风险，但在普通场景下可接受)
    const newCount = currentCount + 1;
    c.res.headers.set("X-RateLimit-Remaining", (limit - newCount).toString());
    
    // 设置过期 TTL (向下取整转换为秒, 至少 10 秒以上)
    const ttlSeconds = Math.max(10, Math.ceil(options.windowMs / 1000));
    await storage.setItem(key, newCount, { expirationTtl: ttlSeconds });

    await next();
  };
}
