import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestLogger } from "./middleware/request-logger";
import { rateLimiter } from "./middleware/rate-limiter";
import {
  proxyRequest,
  getAvailableModels,
  getAvailableModelsFiltered,
  getTaskStatus,
} from "./api/imagine";
import {
  getTokenStatsHandler,
  getAllTokenStatsHandler,
  resetTokenStatusHandler,
} from "./api/token-manager";
import { createAutoStorage } from "./storage";
import type { Bindings } from "./types";
import { S3Service } from "./services/s3";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Storage } from "unstorage";

export const app = new Hono<{ Bindings: Bindings }>();
export const webApp = new Hono<{ Bindings: Bindings }>();

// 初始化存储（应用启动时）
let globalStorage: Storage | null = null;

// 存储中间件：为每个请求注入 storage
app.use("*", async (c, next) => {
  // 在无服务器环境中，每次请求都可能是新的实例
  // 所以我们需要检查是否已经初始化
  if (!globalStorage) {
    globalStorage = createAutoStorage(c.env);
  }
  c.env.storage = globalStorage;
  await next();
});

// 全局 CORS 配置（在认证之前）
app.use("/*", async (c, next) => {
  const allowedConfig = c.env.ALLOWED_ORIGINS;
  const allowedOrigins = allowedConfig
    ? allowedConfig.split(",").map((o: string) => o.trim())
    : ["*"];

  const isWildcard = allowedOrigins.includes("*");

  return cors({
    origin: isWildcard ? "*" : allowedOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length", "Content-Type"],
    maxAge: 86400,
    credentials: !isWildcard,
  })(c, next);
});

// 使用结构化请求日志中间件替代基础 logger
app.use(requestLogger());

/**
 * 认证中间件工厂
 *
 * @param tokenSource - 环境变量字段名，指定使用哪个 Token 进行认证。
 *   - 'API_TOKEN': 普通 API 调用
 *   - 'ADMIN_TOKEN': 管理接口（回退到 API_TOKEN）
 *
 * 固定时间比较（timingSafeEqual）防止时序攻击。
 */
function createAuthMiddleware(tokenSource: "API_TOKEN" | "ADMIN_TOKEN") {
  return async (c: any, next: any) => {
    // 获取认证 Token 列表
    // ADMIN_TOKEN 回退到 API_TOKEN，确保向后兼容
    const tokens =
      tokenSource === "ADMIN_TOKEN"
        ? c.env.ADMIN_TOKEN || c.env.API_TOKEN
        : c.env.API_TOKEN;

    // 如果没有配置 Token，则跳过认证
    if (!tokens) {
      return next();
    }

    // 获取 Authorization 头
    const authHeader = c.req.header("Authorization");

    if (!authHeader) {
      return c.json(
        { error: "Unauthorized", message: "Missing Authorization header" },
        401,
      );
    }

    // 检查是否是 Bearer token
    if (!authHeader.startsWith("Bearer ")) {
      return c.json(
        { error: "Unauthorized", message: "Invalid Authorization format" },
        401,
      );
    }

    // 提取 token
    const token = authHeader.substring(7); // 移除 "Bearer " 前缀

    // 固定时间比较函数（防止时序攻击）
    // 将两个字符串填充到相同长度，避免长度差异泄漏信息
    const timingSafeEqual = (a: string, b: string) => {
      const maxLen = Math.max(a.length, b.length);
      const paddedA = a.padEnd(maxLen, "\0");
      const paddedB = b.padEnd(maxLen, "\0");
      let result = a.length ^ b.length; // 长度不同也参与异或，确保最终失败
      for (let i = 0; i < maxLen; i++) {
        result |= paddedA.charCodeAt(i) ^ paddedB.charCodeAt(i);
      }
      return result === 0;
    };

    // 验证 token
    const validTokens = tokens.split(",").map((t: string) => t.trim());
    let isValid = false;

    for (const validToken of validTokens) {
      if (timingSafeEqual(validToken, token)) {
        isValid = true;
        break;
      }
    }

    if (!isValid) {
      return c.json({ error: "Unauthorized", message: "Invalid token" }, 401);
    }

    // Token 有效，继续处理请求
    await next();
  };
}

// 管理路由路径前缀（需要 ADMIN_TOKEN）
const ADMIN_PATHS = ["/v1/token-stats", "/v1/token-reset", "/v1/storage/cleanup"];

// 统一认证中间件：根据路径自动选择 Token 源
app.use("/v1/*", async (c, next) => {
  const path = c.req.path;
  const isAdminRoute = ADMIN_PATHS.some((p) => path.startsWith(p));
  const tokenSource = isAdminRoute ? "ADMIN_TOKEN" : "API_TOKEN";

  return createAuthMiddleware(tokenSource)(c, next);
});

// 获取可用模型列表（根据 token 可用性动态过滤）
app.get("/v1/models", async (c) => {
  const models = await getAvailableModelsFiltered(c.env);
  return c.json(models);
});

// 获取所有模型列表（不过滤，用于管理和调试）
app.get("/v1/models/all", (c) => {
  const models = getAvailableModels();
  return c.json(models);
});

// RESTful 风格的 AI 服务代理 API (通过速率限制防止滥用，限制 60次/分钟)
app.post("/v1/:action", rateLimiter({ limit: 60, windowMs: 60_000 }), proxyRequest);

// 查询异步任务状态（轮询接口，放宽到 120次/分钟）
app.get("/v1/task-status", rateLimiter({ limit: 120, windowMs: 60_000 }), getTaskStatus);

// === 管理接口 ===

// 获取 Token 统计信息
app.get("/v1/token-stats", getTokenStatsHandler);

// 获取所有 Provider 的 Token 统计信息
app.get("/v1/token-stats/all", getAllTokenStatsHandler);

// 重置 Token 状态
app.post("/v1/token-reset", resetTokenStatusHandler);

// 清理 S3 早期文件
app.delete(
  "/v1/storage/cleanup",
  zValidator(
    "query",
    z.object({
      startDate: z.string().datetime({ message: "Invalid ISO 8601 startDate" }),
      endDate: z.string().datetime({ message: "Invalid ISO 8601 endDate" }),
    })
  ),
  async (c) => {
    try {
      const s3 = new S3Service(c.env);
      if (!s3.isActive) {
        return c.json({ error: "S3 service is not enabled" }, 400);
      }
      const { startDate, endDate } = c.req.valid("query");
      const deletedCount = await s3.cleanupOldFiles(
        new Date(startDate),
        new Date(endDate)
      );
      return c.json({ status: "success", deletedCount });
    } catch (e: any) {
      return c.json({ error: "Cleanup failed", message: e.message }, 500);
    }
  }
);

// 健康检查
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.3.0",
  });
});

// 挂载 API 路由
webApp.route("/api", app);

// 挂载 API 路由
webApp.get("/", (c) => c.redirect("/index.html"));

export default webApp;
