import { handle } from "hono/vercel";
import app from "./index";

// 重要：Vercel 需要默认导出 handle 处理后的函数
export default handle(app);
