/**
 * Vercel 入口文件
 * 处理 API 路由（静态文件由 vercel.json 配置处理）
 */
import app from "./index";

// 直接导出 API 应用
// 静态文件通过 vercel.json 的 routes 配置直接服务
export default app;
