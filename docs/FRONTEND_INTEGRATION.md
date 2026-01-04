# 前端集成指南

本项目已集成 [Peinture](https://github.com/Amery2010/peinture) 作为前端界面。

## 架构说明

- **前端项目**: Peinture (React + Vite)
- **后端 API**: Hono (位于 `/api` 路径下)
- **静态文件**: 前端构建产物存放在 `public/` 目录
- **运行模式**: 服务器模式（前端通过后端代理调用 AI 服务）

## 路由结构

### 前端路由

- `/` - 前端页面 (Peinture UI)

### API 路由

- `/api/health` - 健康检查
- `/api/v1/models` - 获取可用模型列表
- `/api/v1/generate` - 图片生成接口
- `/api/v1/edit` - 图片编辑接口
- `/api/v1/video` - Live 图接口
- `/api/v1/upscaler` - 图像高清放大接口

## 服务器模式

### 什么是服务器模式？

服务器模式是 Peinture 前端的一个特殊运行模式，通过设置 `VITE_SERVICE_MODE=server` 环境变量启用。

在服务器模式下：

- 前端不直接调用第三方 AI 服务 API
- 所有请求通过本地 `/api` 路径转发到后端
- 使用后端统一管理的 Token 和配置
- 提高安全性和可维护性

### 工作原理

**标准模式（默认）**：

```
浏览器 → Peinture 前端 → 直接调用 Hugging Face/Gitee AI/ModelScope API
```

**服务器模式**：

```
浏览器 → Peinture 前端 → /api → Imagine Server 后端 → AI 服务 API
```

在服务器模式下，后端负责：

- Token 管理和轮换
- 请求代理和转发
- 错误处理和重试
- 统计和监控

### 优势

1. **安全性**

   - Token 不暴露在前端代码中
   - 所有 API 请求通过后端代理
   - 可以在后端实施访问控制

2. **可维护性**

   - 统一的 Token 管理
   - 集中的错误处理
   - 便于监控和日志记录

3. **灵活性**

   - 可以轻松切换 AI 服务提供商
   - 支持 Token 轮换和负载均衡
   - 可以添加缓存和限流

4. **用户体验**
   - 前端配置简单
   - 无需用户提供 Token
   - 统一的错误提示

### API 端点映射

| 功能         | 前端调用                | 后端路由                      |
| ------------ | ----------------------- | ----------------------------- |
| 获取模型列表 | `GET /api/v1/models`    | `apiApp.get("/v1/models")`    |
| 图片生成     | `POST /api/v1/generate` | `apiApp.post("/v1/generate")` |
| 图片编辑     | `POST /api/v1/edit`     | `apiApp.post("/v1/edit")`     |
| Live 图      | `POST /api/v1/video`    | `apiApp.post("/v1/video")`    |
| 图像高清放大 | `POST /api/v1/upscaler` | `apiApp.post("/v1/upscaler")` |

## 构建前端

### 首次构建

前端静态文件已经构建并包含在项目中。如果需要重新构建：

```bash
pnpm run build:frontend
```

此命令会：

1. 克隆 Peinture 项目到临时目录
2. 安装依赖
3. 修改 `vite.config.ts` 添加 `SERVICE_MODE` 环境变量定义
4. 以服务器模式构建项目（注入 `VITE_SERVICE_MODE=server` 环境变量）
5. 将构建产物复制到 `public/` 目录
6. 清理临时文件

**为什么需要修改 vite.config.ts？**

Peinture 项目使用 `process.env.SERVICE_MODE` 访问环境变量，而不是 Vite 标准的 `import.meta.env.VITE_SERVICE_MODE`。因此需要在 `vite.config.ts` 的 `define` 中显式定义：

```typescript
define: {
  'process.env.SERVICE_MODE': JSON.stringify(env.VITE_SERVICE_MODE || 'local')
}
```

这样 Vite 会在构建时将 `process.env.SERVICE_MODE` 替换为实际的值。

### 手动构建

如果需要手动构建，可以执行：

```bash
bash scripts/build-frontend.sh
```

### 环境变量说明

**为什么使用 `VITE_SERVICE_MODE`？**

- Vite 会自动识别以 `VITE_` 开头的环境变量并通过 `loadEnv` 加载
- 这是 Vite 的安全机制，防止敏感信息（如 API 密钥）意外泄露到前端
- 在 Peinture 代码中通过 `process.env.SERVICE_MODE` 访问（需要在 vite.config.ts 中定义）

**构建时的处理流程**：

1. 设置环境变量 `VITE_SERVICE_MODE=server`
2. Vite 通过 `loadEnv` 读取该变量
3. 在 `vite.config.ts` 的 `define` 中将其映射到 `process.env.SERVICE_MODE`
4. 构建时 Vite 会将代码中的 `process.env.SERVICE_MODE` 替换为实际值

**vite.config.ts 配置**：

```typescript
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    define: {
      "process.env.SERVICE_MODE": JSON.stringify(
        env.VITE_SERVICE_MODE || "local"
      ),
    },
  };
});
```

构建脚本会自动修改 Peinture 项目的 `vite.config.ts` 添加此配置。

## 开发模式

启动开发服务器：

```bash
pnpm run dev
```

服务器会在 `http://localhost:3000` 启动：

- 访问 `http://localhost:3000` 查看前端界面
- 访问 `http://localhost:3000/api/health` 测试 API

## 生产部署

### Vercel 部署

```bash
pnpm run vercel:deploy
```

### Cloudflare Workers 部署

```bash
pnpm run wrangler:deploy
```

### Docker 部署

```bash
docker build -t imagine-server -f docker/Dockerfile .
docker run -p 3000:3000 --env-file .env imagine-server
```

## 配置要求

### 后端配置

确保后端已配置 AI 提供商的 Token：

```bash
# .env 文件
HUGGINGFACE_TOKENS=hf_token1,hf_token2
GITEE_TOKENS=gitee_token1,gitee_token2
MODELSCOPE_TOKENS=ms_token1,ms_token2

# 可选：API 访问控制
API_TOKEN=your-secret-token
```

### 前端配置

在服务器模式下，前端无需额外配置。构建时会自动：

- 设置 API 基础路径为 `/api`
- 禁用直接调用第三方 API
- 启用本地代理模式

## 验证服务器模式

### 1. 检查构建产物

查看构建后的 JavaScript 文件，应该包含 `/api` 路径：

```bash
grep -r "/api/v1" public/assets/
```

### 2. 检查网络请求

在浏览器开发者工具中查看网络请求：

- 所有 AI 服务请求应该指向 `/api/v1/*`
- 不应该有直接指向 `huggingface.co`、`ai.gitee.com` 等的请求

### 3. 测试功能

访问 Web UI 并测试图像生成：

```
http://localhost:3000
```

检查后端日志，应该能看到来自前端的 API 请求。

## 故障排除

### 前端显示 "API 错误"

1. 检查后端是否正常运行

   ```bash
   curl http://localhost:3000/api/health
   ```

2. 检查后端是否配置了 Token

   ```bash
   curl http://localhost:3000/api/v1/models
   ```

3. 查看后端日志获取详细错误信息

### 前端仍然直接调用第三方 API

1. 确认构建时注入了环境变量

   ```bash
   cat scripts/build-frontend.sh | grep VITE_SERVICE_MODE
   ```

2. 重新构建前端

   ```bash
   rm -rf public
   pnpm run build:frontend
   ```

3. 清除浏览器缓存并刷新页面

### 模型列表为空

1. 检查后端 Token 配置
2. 查看 `/api/v1/models/all` 获取所有模型（包括不可用的）
3. 检查后端日志中的错误信息

### 前端页面显示空白

1. 检查 `public/` 目录是否存在

   ```bash
   ls -la public/
   ```

2. 检查浏览器控制台是否有错误

3. 确认静态文件路径配置正确

## 注意事项

1. `public/` 目录已添加到 `.gitignore`，不会提交到 Git
2. 部署前需要先运行 `pnpm run build:frontend` 构建前端
3. 前端和后端共享同一个域名，无需配置 CORS（API 路由除外）
4. 前端会调用 `/api` 路径下的接口，确保 API 正常工作
5. 服务器模式下，所有 AI 请求都通过后端代理，确保后端 Token 配置正确

## 更新前端

当 Peinture 项目有更新时，重新运行构建命令即可：

```bash
pnpm run build:frontend
```

## 相关文档

- [Vite 环境变量说明](VITE_ENV_VARIABLES.md) - 详细的 Vite 环境变量配置指南
- [部署检查清单](DEPLOYMENT_CHECKLIST.md) - 部署前的完整检查清单
