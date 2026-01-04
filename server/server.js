/**
 * 生产环境服务器启动脚本
 * 使用 @hono/node-server 启动 Node.js HTTP 服务器
 */

import { config } from "dotenv";
import { resolve } from "path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

// 加载环境变量，优先级：.env.local > .env
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// 动态导入编译后的应用
const { default: app } = await import("../dist/index.js");

const port = Number(process.env.PORT) || 3000;

// 创建一个新的 Hono 实例用于 Node.js 服务器
const serverApp = new Hono();

// 挂载 API 路由
serverApp.route("/api", app);

// 静态文件服务 - 服务前端页面
serverApp.use("/*", serveStatic({ root: "./public" }));

console.log(`🚀 Starting AI Image API server...`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
console.log(`🔧 Port: ${port}`);

// 检查是否配置了 API_TOKEN
if (process.env.API_TOKEN) {
  console.log(`🔐 API Authentication: Enabled`);
  console.log(
    `   Configured tokens: ${process.env.API_TOKEN.split(",").length}`
  );
} else {
  console.log(`⚠️  API Authentication: Disabled (no API_TOKEN configured)`);
}

serve(
  {
    fetch: (request, env) => {
      // 将 Node.js 的 process.env 传递给 Hono 的 env
      return serverApp.fetch(request, {
        ...process.env,
        ...env,
      });
    },
    port,
  },
  (info) => {
    console.log(`✅ Server is running on http://localhost:${info.port}`);
    console.log(`\n📚 Available endpoints:`);
    console.log(`   - Frontend:     http://localhost:${info.port}/`);
    console.log(`   - Health check: http://localhost:${info.port}/api/health`);
    console.log(
      `   - Models list:  http://localhost:${info.port}/api/v1/models`
    );
    console.log(
      `   - Token stats:  http://localhost:${info.port}/api/v1/token-stats/all`
    );
    console.log(`\n💡 Press Ctrl+C to stop the server\n`);
  }
);
