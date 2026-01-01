# 快速开始指南

本指南帮助你在 5 分钟内启动 Imagine Server。

## 前置要求

- Node.js >= 18.0.0
- pnpm（推荐）或 npm

## 步骤 1: 克隆项目

```bash
git clone https://github.com/Amery2010/imagine-server.git
cd imagine-server
```

## 步骤 2: 安装依赖

```bash
pnpm install
```

或使用快速设置脚本：

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

## 步骤 3: 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，至少配置一个 AI 提供商的 Token：

```bash
# 选择一个或多个提供商
HUGGINGFACE_TOKENS=hf_your_token_here
GITEE_TOKENS=gitee_your_token_here
MODELSCOPE_TOKENS=ms_your_token_here

# 可选：API 访问控制
API_TOKEN=your-secret-token
```

### 获取 Token

- **Hugging Face**: https://huggingface.co/settings/tokens
- **Gitee AI**: https://ai.gitee.com/
- **ModelScope**: https://modelscope.cn/

## 步骤 4: 启动开发服务器

```bash
pnpm run dev
```

服务器将在 http://localhost:3000 启动。

## 步骤 5: 测试 API

### 健康检查

```bash
curl http://localhost:3000/api/health
```

响应：

```json
{
  "status": "ok",
  "timestamp": "2025-12-29T12:00:00.000Z",
  "version": "1.0.0"
}
```

### 获取可用模型

```bash
curl http://localhost:3000/api/v1/models
```

### 生成图片

```bash
curl -X POST http://localhost:3000/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gitee/flux-2",
    "prompt": "a beautiful sunset over mountains",
    "ar": "16:9"
  }'
```

响应：

```json
{
  "url": "https://...",
  "width": 1024,
  "height": 576,
  "seed": 12345,
  "steps": 9,
  "guidance": 3.5
}
```

## 常用命令

```bash
# 开发模式（热重载）
pnpm run dev

# 生产模式启动
pnpm start

# 类型检查
pnpm run type-check

# Vercel 本地开发
pnpm run vercel:dev

# Cloudflare Workers 本地开发
pnpm run wrangler:dev
```

## 配置存储（可选）

默认使用内存存储，适合开发环境。生产环境建议配置持久化存储：

### 使用 Redis

```bash
# 启动 Redis（Docker）
docker run -d -p 6379:6379 redis:7-alpine

# 配置环境变量
echo "REDIS_URL=redis://localhost:6379" >> .env
```

### 使用 Docker Compose

```bash
# 启动应用和 Redis
docker-compose up -d

# 查看日志
docker-compose logs -f app
```

## 下一步

- 📖 查看完整 [API 文档](README.md#-api-文档)
- 🚀 了解 [部署选项](DEPLOYMENT.md)
- 🤝 阅读 [贡献指南](CONTRIBUTING.md)
- 🎨 探索 [支持的模型](README.md#-支持的模型)

## 故障排查

### 问题：端口 3000 已被占用

```bash
# 使用其他端口
PORT=3001 pnpm run dev
```

### 问题：Token 无效

- 检查 Token 格式（逗号分隔，无空格）
- 确认 Token 未过期
- 验证 Token 权限

### 问题：存储连接失败

- 检查 Redis 是否运行
- 验证 REDIS_URL 格式
- 查看应用日志

## 获取帮助

- 📝 查看 [README.md](README.md)
- 🐛 提交 [Issue](https://github.com/yourusername/imagine-server/issues)
- 💬 加入讨论

---

🎉 恭喜！你已经成功启动 Imagine Server！
