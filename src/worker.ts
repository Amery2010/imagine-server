/**
 * Cloudflare Workers 入口文件
 * 处理静态文件服务和 API 路由
 */
import { Hono } from "hono";
import { app } from "./index";
import type { Bindings } from "./types";

// 扩展 Bindings 类型以包含静态资源
interface WorkerBindings extends Bindings {
  ASSETS: Fetcher;
}

// 创建 Workers 应用
const workerApp = new Hono<{ Bindings: WorkerBindings }>();

// 挂载 API 路由
workerApp.route("/api", app);

// 静态文件服务 - 使用 Cloudflare Workers Assets
workerApp.get("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default workerApp;
