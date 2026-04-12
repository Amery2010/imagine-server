import type { Context, Next } from "hono";

/**
 * 结构化请求日志中间件
 *
 * 在 API 请求完成后记录关键指标：
 * - method: HTTP 方法
 * - path: 请求路径
 * - provider: Provider 名称（从 model 参数解析）
 * - model: 模型 ID
 * - action: 操作类型（generate, edit, text, video 等）
 * - duration: 请求耗时（毫秒）
 * - status: HTTP 状态码
 *
 * 日志格式示例：
 * [API] POST /v1/imagine | provider=gemini model=gemini-2-flash action=generate | 2340ms | 200
 * [API] GET /v1/models/all | 3ms | 200
 */
export function requestLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();

    await next();

    const duration = Date.now() - start;
    const method = c.req.method;
    const path = c.req.path;
    const status = c.res.status;

    // 构建基础日志
    let log = `[API] ${method} ${path}`;

    // 对于 POST /v1/:action 请求，尝试提取 provider/model 信息
    // 通过 c.req.param 获取 action（Hono 会在路由匹配后填充）
    const action = c.req.param("action");
    if (action && method === "POST") {
      // 从 request body 中提取 model 信息比较昂贵（需要 clone body）
      // 所以这里只记录 action
      log += ` | action=${action}`;
    }

    log += ` | ${duration}ms | ${status}`;

    // 根据状态使用不同日志级别
    if (status >= 500) {
      console.error(log);
    } else if (status >= 400) {
      console.warn(log);
    } else {
      console.info(log);
    }
  };
}
