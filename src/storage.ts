/**
 * Unstorage 统一存储配置
 * 自动适配 Cloudflare Workers、Vercel 和其他无服务器环境
 */

import { createStorage } from "unstorage";
import redisDriver from "unstorage/drivers/redis";
import cloudflareKVBindingDriver from "unstorage/drivers/cloudflare-kv-binding";
import httpDriver from "unstorage/drivers/http";
import memoryDriver from "unstorage/drivers/memory";
import type { Storage } from "unstorage";

/**
 * 根据环境自动选择合适的存储驱动
 *
 * 优先级：
 * 1. Upstash Redis (KV_REST_API_URL + KV_REST_API_TOKEN) - Vercel 推荐
 * 2. 标准 Redis (REDIS_URL)
 * 3. Cloudflare KV (TOKEN_STATUS_KV binding)
 * 4. Memory (开发环境回退)
 */
export function createAutoStorage(env: any): Storage {
  // 1. 优先使用 Upstash Redis (Vercel KV)
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    console.log("[Storage] Using Upstash Redis (Vercel KV)");
    return createStorage({
      driver: httpDriver({
        base: env.KV_REST_API_URL,
        headers: {
          Authorization: `Bearer ${env.KV_REST_API_TOKEN}`,
        },
      }),
    });
  }

  // 2. 使用标准 Redis
  if (env.REDIS_URL) {
    console.log("[Storage] Using Redis");
    return createStorage({
      driver: redisDriver({
        url: env.REDIS_URL,
      }),
    });
  }

  // 3. 使用 Cloudflare KV (Cloudflare Workers)
  if (env.TOKEN_STATUS_KV) {
    console.log("[Storage] Using Cloudflare KV");
    return createStorage({
      driver: cloudflareKVBindingDriver({
        binding: env.TOKEN_STATUS_KV,
      }),
    });
  }

  // 4. 回退到内存存储（开发环境）
  console.log("[Storage] Using memory storage (development mode)");
  return createStorage({
    driver: memoryDriver(),
  });
}
