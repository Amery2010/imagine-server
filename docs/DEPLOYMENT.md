# 部署指南

本文档提供详细的部署说明，帮助你将 Imagine Server 部署到不同的平台。

## 目录

- [Vercel 部署](#vercel-部署)
- [Cloudflare Workers 部署](#cloudflare-workers-部署)
- [Node.js 部署](#nodejs-部署)
- [Docker 部署](#docker-部署)

---

## Vercel 部署

Vercel 是推荐的部署平台，提供开箱即用的 KV 存储支持。

### 前置要求

- Vercel 账户
- Vercel CLI（可选）

### 方式 1: 通过 Vercel Dashboard

1. **导入项目**

   - 访问 [Vercel Dashboard](https://vercel.com/dashboard)
   - 点击 "Add New" → "Project"
   - 导入你的 Git 仓库

2. **配置构建设置**

   - Framework Preset: Other
   - Build Command: `pnpm run build`
   - Output Directory: `dist`
   - Install Command: `pnpm install`

3. **创建 KV 存储**

   - 在项目设置中，进入 "Storage" 标签
   - 点击 "Create Database"
   - 选择 "KV" (Upstash Redis)
   - 创建后会自动注入环境变量

4. **配置环境变量**

   在项目设置 → Environment Variables 中添加：

   ```
   API_TOKEN=your-secret-token
   HUGGINGFACE_TOKENS=hf_token1,hf_token2,hf_token3
   GITEE_TOKENS=gitee_token1,gitee_token2
   MODELSCOPE_TOKENS=ms_token1,ms_token2
   ```

5. **部署**
   - 点击 "Deploy"
   - 等待部署完成

### 方式 2: 通过 Vercel CLI

1. **安装 Vercel CLI**

```bash
npm install -g vercel
```

2. **登录**

```bash
vercel login
```

3. **本地开发**

```bash
pnpm run vercel:dev
```

4. **部署到预览环境**

```bash
pnpm run vercel:deploy
```

5. **部署到生产环境**

```bash
pnpm run vercel:prod
```

### 配置 Vercel KV

Vercel KV 基于 Upstash Redis，创建后会自动注入以下环境变量：

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

项目会自动检测并使用这些变量。

### 验证部署

```bash
curl https://your-project.vercel.app/api/health
```

---

## Cloudflare Workers 部署

Cloudflare Workers 提供全球边缘计算能力，适合需要低延迟的场景。

### 前置要求

- Cloudflare 账户
- Wrangler CLI

### 步骤 1: 安装 Wrangler

```bash
# 已包含在项目依赖中
pnpm install
```

### 步骤 2: 登录 Cloudflare

```bash
pnpm run wrangler login
```

### 步骤 3: 创建 KV Namespaces

```bash
# 创建 Token 状态存储
pnpm run wrangler kv:namespace create "TOKEN_STATUS_KV"
pnpm run wrangler kv:namespace create "TOKEN_STATUS_KV" --preview

# 创建视频任务存储
pnpm run wrangler kv:namespace create "VIDEO_TASK_KV"
pnpm run wrangler kv:namespace create "VIDEO_TASK_KV" --preview
```

命令会输出类似以下内容：

```
{ binding = "TOKEN_STATUS_KV", id = "abc123..." }
{ binding = "TOKEN_STATUS_KV", preview_id = "xyz789..." }
```

### 步骤 4: 配置 wrangler.toml

编辑 `wrangler.toml`，填入上一步获取的 ID：

```toml
[[kv_namespaces]]
binding = "TOKEN_STATUS_KV"
id = "abc123..."  # 填入实际的 ID
preview_id = "xyz789..."  # 填入实际的 preview ID

[[kv_namespaces]]
binding = "VIDEO_TASK_KV"
id = "def456..."
preview_id = "uvw012..."
```

### 步骤 5: 设置 Secrets

**推荐方式**（生产环境）：

```bash
pnpm run wrangler secret put API_TOKEN
# 输入: your-secret-token

pnpm run wrangler secret put HUGGINGFACE_TOKENS
# 输入: hf_token1,hf_token2,hf_token3

pnpm run wrangler secret put GITEE_TOKENS
# 输入: gitee_token1,gitee_token2

pnpm run wrangler secret put MODELSCOPE_TOKENS
# 输入: ms_token1,ms_token2
```

**本地开发方式**：

创建 `.dev.vars` 文件：

```bash
cp .dev.vars.example .dev.vars
```

编辑 `.dev.vars`：

```
API_TOKEN=your-secret-token
HUGGINGFACE_TOKENS=hf_token1,hf_token2
GITEE_TOKENS=gitee_token1,gitee_token2
MODELSCOPE_TOKENS=ms_token1,ms_token2
```

### 步骤 6: 本地开发

```bash
pnpm run wrangler:dev
```

访问 http://localhost:8787/api/health

### 步骤 7: 部署

```bash
pnpm run wrangler:deploy
```

### 步骤 8: 查看日志

```bash
pnpm run wrangler:tail
```

### 管理 Secrets

```bash
# 查看所有 secrets
pnpm run wrangler secret list

# 删除 secret
pnpm run wrangler secret delete SECRET_NAME
```

### 验证部署

```bash
curl https://imagine-server.your-subdomain.workers.dev/api/health
```

---

## Node.js 部署

适合传统的 VPS 或云服务器部署。

### 前置要求

- Node.js >= 18.0.0
- Redis（可选，用于存储）
- PM2（推荐，用于进程管理）

### 步骤 1: 准备服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 pnpm
npm install -g pnpm

# 安装 PM2
npm install -g pm2
```

### 步骤 2: 安装 Redis（可选）

```bash
# 使用 Docker
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine

# 或使用 apt
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

### 步骤 3: 克隆项目

```bash
git clone https://github.com/Amery2010/imagine-server.git
cd imagine-server
```

### 步骤 4: 安装依赖

```bash
pnpm install
```

### 步骤 5: 配置环境变量

```bash
cp .env.example .env
nano .env
```

编辑 `.env`：

```bash
# API Token
API_TOKEN=your-secret-token

# AI 提供商 Token
HUGGINGFACE_TOKENS=hf_token1,hf_token2
GITEE_TOKENS=gitee_token1,gitee_token2
MODELSCOPE_TOKENS=ms_token1,ms_token2

# Redis（如果使用）
REDIS_URL=redis://localhost:6379
```

### 步骤 6: 构建

```bash
pnpm run build
```

### 步骤 7: 使用 PM2 启动

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: "imagine-server",
      script: "server.ts",
      interpreter: "node",
      interpreter_args: "--loader tsx",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
```

启动应用：

```bash
# 创建日志目录
mkdir -p logs

# 启动应用
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

### 步骤 8: 配置 Nginx（可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 步骤 9: 配置 SSL（推荐）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### PM2 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs imagine-server

# 重启
pm2 restart imagine-server

# 停止
pm2 stop imagine-server

# 删除
pm2 delete imagine-server
```

---

## Docker 部署

使用 Docker 容器化部署。

### 创建 Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建
RUN pnpm run build

# 生产镜像
FROM node:18-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts

EXPOSE 3000

ENV NODE_ENV=production

CMD ["pnpm", "start"]
```

### 创建 docker-compose.yml

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - API_TOKEN=${API_TOKEN}
      - HUGGINGFACE_TOKENS=${HUGGINGFACE_TOKENS}
      - GITEE_TOKENS=${GITEE_TOKENS}
      - MODELSCOPE_TOKENS=${MODELSCOPE_TOKENS}
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

### 部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止
docker-compose down

# 重启
docker-compose restart app
```

---

## 环境变量说明

| 变量名               | 必需 | 说明                          | 示例                     |
| -------------------- | ---- | ----------------------------- | ------------------------ |
| `API_TOKEN`          | 否   | API 访问令牌（逗号分隔）      | `token1,token2`          |
| `HUGGINGFACE_TOKENS` | 是   | Hugging Face API 令牌         | `hf_xxx,hf_yyy`          |
| `GITEE_TOKENS`       | 是   | Gitee AI API 令牌             | `gitee_xxx,gitee_yyy`    |
| `MODELSCOPE_TOKENS`  | 是   | ModelScope API 令牌           | `ms_xxx,ms_yyy`          |
| `REDIS_URL`          | 否   | Redis 连接 URL                | `redis://localhost:6379` |
| `KV_REST_API_URL`    | 否   | Upstash Redis URL（Vercel）   | 自动注入                 |
| `KV_REST_API_TOKEN`  | 否   | Upstash Redis Token（Vercel） | 自动注入                 |

---

## 验证部署

部署完成后，访问以下端点验证：

```bash
# 健康检查
curl https://your-domain.com/api/health

# 获取模型列表
curl https://your-domain.com/api/v1/models

# Token 统计（需要认证）
curl -H "Authorization: Bearer your-token" \
  https://your-domain.com/api/v1/token-stats/all
```

---

## 故障排查

### 常见问题

1. **存储连接失败**

   - 检查环境变量配置
   - 确认 Redis/KV 服务正常运行
   - 查看应用日志

2. **Token 无效**

   - 确认 Token 格式正确（逗号分隔，无空格）
   - 检查 Token 是否过期
   - 验证 Token 权限

3. **部署失败**
   - 检查 Node.js 版本 >= 18.0.0
   - 确认所有依赖已安装
   - 查看构建日志

### 查看日志

**Vercel:**

```bash
vercel logs
```

**Cloudflare Workers:**

```bash
pnpm run wrangler:tail
```

**Node.js (PM2):**

```bash
pm2 logs imagine-server
```

**Docker:**

```bash
docker-compose logs -f app
```

---

## 性能优化

1. **使用 CDN**

   - Vercel 和 Cloudflare 自带 CDN
   - Node.js 部署可使用 Cloudflare 或其他 CDN

2. **启用缓存**

   - 配置 Redis 缓存
   - 使用 HTTP 缓存头

3. **负载均衡**

   - 使用多个 Worker 实例
   - 配置负载均衡器

4. **监控**
   - 设置应用监控
   - 配置告警规则

---

## 安全建议

1. **使用 HTTPS**

   - 所有生产环境必须使用 HTTPS
   - 配置 SSL 证书

2. **保护 API Token**

   - 使用环境变量或 Secrets
   - 定期轮换 Token
   - 不要在代码中硬编码

3. **限流**

   - 配置 API 限流
   - 防止滥用

4. **日志**
   - 记录关键操作
   - 定期审查日志

---

## 支持

如有问题，请：

- 查看 [README.md](README.md)
- 提交 [Issue](https://github.com/yourusername/imagine-server/issues)
- 查看 [故障排查](#故障排查) 部分
