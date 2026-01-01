# GitHub Actions 自动部署配置指南

本项目已配置 GitHub Actions 工作流，可自动部署到 Cloudflare Workers、Vercel 和 GitHub Container Registry (ghcr.io)。

## 工作流说明

### 1. Build and Push Docker Image (`.github/workflows/build-docker.yml`)

- **触发条件**：推送以 `v` 开头的版本标签（如 `v1.0.0`）
- **手动触发**：支持通过 GitHub Actions 界面手动触发
- **部署目标**：GitHub Container Registry (ghcr.io)
- **支持架构**：linux/amd64, linux/arm64

### 2. Deploy to Cloudflare Workers (`.github/workflows/deploy-cloudflare.yml`)

- **触发条件**：推送以 `v` 开头的版本标签（如 `v1.0.0`）
- **手动触发**：支持通过 GitHub Actions 界面手动触发
- **部署目标**：Cloudflare Workers

### 3. Deploy to Vercel (`.github/workflows/deploy-vercel.yml`)

- **触发条件**：推送以 `v` 开头的版本标签（如 `v1.0.0`）
- **手动触发**：支持通过 GitHub Actions 界面手动触发
- **部署目标**：Vercel

### 4. Deploy VitePress site to Pages (`.github/workflows/deploy-docs.yml`)

- **触发条件**：推送到 `main` 分支
- **部署目标**：GitHub Pages（文档站点）

### 5. Create GitHub Release (`.github/workflows/create-release.yml`)

- **触发条件**：推送以 `v` 开头的版本标签（如 `v1.0.0`）
- **手动触发**：支持通过 GitHub Actions 界面手动触发
- **功能**：自动从 `docs/CHANGELOG.md` 提取发布说明并创建 GitHub Release

## 配置步骤

### 零、Docker 镜像构建配置

Docker 镜像会自动构建并推送到 GitHub Container Registry (ghcr.io)。

#### 权限配置

GitHub Actions 默认已有推送到 GHCR 的权限，无需额外配置。镜像将自动发布到：

```
ghcr.io/<your-username>/imagine-server:latest
ghcr.io/<your-username>/imagine-server:v1.0.0
ghcr.io/<your-username>/imagine-server:1.0
ghcr.io/<your-username>/imagine-server:1
```

#### 使用 Docker 镜像

```bash
# 拉取最新版本
docker pull ghcr.io/<your-username>/imagine-server:latest

# 拉取特定版本
docker pull ghcr.io/<your-username>/imagine-server:v1.0.0

# 运行容器
docker run -d \
  -p 3000:3000 \
  -e API_TOKEN=your-token \
  -e HUGGINGFACE_TOKENS=hf_token1,hf_token2 \
  -e GITEE_TOKENS=gitee_token1,gitee_token2 \
  -e MODELSCOPE_TOKENS=ms_token1,ms_token2 \
  -e REDIS_URL=redis://your-redis:6379 \
  --name imagine-server \
  ghcr.io/<your-username>/imagine-server:latest
```

#### 设置镜像为公开（可选）

默认情况下，GHCR 镜像是私有的。如果想让镜像公开访问：

1. 进入 GitHub 个人主页
2. 点击 **Packages** 标签
3. 找到 `imagine-server` 包
4. 点击 **Package settings**
5. 在 **Danger Zone** 中选择 **Change visibility** → **Public**

### 一、Cloudflare Workers 部署配置

#### 1. 获取 Cloudflare API Token

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **My Profile** → **API Tokens**
3. 点击 **Create Token**
4. 选择 **Edit Cloudflare Workers** 模板
5. 配置权限：
   - Account Resources: `Include` → 选择你的账户
   - Zone Resources: `Include` → `All zones`
6. 点击 **Continue to summary** → **Create Token**
7. 复制生成的 Token（只显示一次）

#### 2. 获取 Cloudflare Account ID

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 首页
2. 选择你的账户
3. 在右侧栏找到 **Account ID**，点击复制

#### 3. 创建 KV Namespaces

在本地运行以下命令创建 KV Namespaces：

```bash
# 登录 Cloudflare
pnpm run wrangler login

# 创建 TOKEN_STATUS_KV
pnpm run wrangler kv:namespace create "TOKEN_STATUS_KV"
# 输出示例：
# 🌀 Creating namespace with title "imagine-server-TOKEN_STATUS_KV"
# ✨ Success!
# Add the following to your configuration file in your kv_namespaces array:
# { binding = "TOKEN_STATUS_KV", id = "1234567890abcdef1234567890abcdef" }

pnpm run wrangler kv:namespace create "TOKEN_STATUS_KV" --preview
# 输出示例：
# 🌀 Creating namespace with title "imagine-server-TOKEN_STATUS_KV_preview"
# ✨ Success!
# Add the following to your configuration file in your kv_namespaces array:
# { binding = "TOKEN_STATUS_KV", preview_id = "1234567890abcdef1234567890abcdef" }

# 创建 VIDEO_TASK_KV
pnpm run wrangler kv:namespace create "VIDEO_TASK_KV"
pnpm run wrangler kv:namespace create "VIDEO_TASK_KV" --preview
```

**重要**：记录生成的 ID，将在下一步配置 GitHub Secrets 时使用。

**注意**：

- 对于本地开发，可以将 ID 填入 `wrangler.toml` 文件
- 对于 GitHub Actions 部署，将 ID 配置为 GitHub Secrets（推荐）

#### 4. 配置 GitHub Secrets

进入 GitHub 仓库的 **Settings** → **Secrets and variables** → **Actions**，添加以下 Secrets：

| Secret 名称             | 说明                                | 获取方式                                                   |
| ----------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API Token                | 步骤 1 获取                                                |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID               | 步骤 2 获取                                                |
| `API_TOKEN`             | 应用 API 访问令牌                   | 自定义生成                                                 |
| `HUGGINGFACE_TOKENS`    | Hugging Face API Tokens（逗号分隔） | [Hugging Face](https://huggingface.co/settings/tokens)     |
| `GITEE_TOKENS`          | Gitee AI API Tokens（逗号分隔）     | [Gitee AI](https://ai.gitee.com/dashboard/settings/tokens) |
| `MODELSCOPE_TOKENS`     | Model Scope API Tokens（逗号分隔）  | [Model Scope](https://modelscope.cn/my/myaccesstoken)      |

**KV Namespace IDs 配置说明**：

GitHub Actions 会在部署时自动将这些 ID 注入到 `wrangler.toml` 中，无需手动修改配置文件。

### 二、Vercel 部署配置

#### 1. 获取 Vercel Token

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 进入 **Settings** → **Tokens**
3. 点击 **Create Token**
4. 输入 Token 名称（如 `GitHub Actions`）
5. 选择 Scope（建议选择特定项目）
6. 点击 **Create** 并复制 Token

#### 2. 获取 Vercel Organization ID 和 Project ID

方法一：通过 Vercel CLI

```bash
# 安装 Vercel CLI（如果未安装）
npm i -g vercel

# 登录
vercel login

# 在项目目录下运行
vercel link

# 查看 .vercel/project.json 文件
cat .vercel/project.json
```

方法二：通过 Vercel Dashboard

1. 进入项目的 **Settings** → **General**
2. 在页面底部找到 **Project ID**
3. Organization ID 可以在 URL 中找到：`https://vercel.com/<org-id>/<project-name>`

#### 3. 配置 Vercel 环境变量

在 Vercel Dashboard 中配置环境变量：

1. 进入项目的 **Settings** → **Environment Variables**
2. 添加以下环境变量（Production、Preview、Development 都选上）：

| 变量名               | 说明                                |
| -------------------- | ----------------------------------- |
| `API_TOKEN`          | 应用 API 访问令牌                   |
| `HUGGINGFACE_TOKENS` | Hugging Face API Tokens（逗号分隔） |
| `GITEE_TOKENS`       | Gitee AI API Tokens（逗号分隔）     |
| `MODELSCOPE_TOKENS`  | ModelScope API Tokens（逗号分隔）   |
| `NODE_ENV`           | 设置为 `production`                 |

#### 4. 配置 GitHub Secrets

添加以下 Secrets：

| Secret 名称         | 说明                   | 获取方式    |
| ------------------- | ---------------------- | ----------- |
| `VERCEL_TOKEN`      | Vercel API Token       | 步骤 1 获取 |
| `VERCEL_ORG_ID`     | Vercel Organization ID | 步骤 2 获取 |
| `VERCEL_PROJECT_ID` | Vercel Project ID      | 步骤 2 获取 |

## 部署流程

### 版本发布部署

推送版本标签会自动触发所有部署流程：

```bash
# 1. 确保所有更改已提交
git add .
git commit -m "Release version 1.0.0"

# 2. 创建并推送版本标签
git tag v1.0.0
git push origin v1.0.0

# 3. GitHub Actions 会自动：
#    - 构建并推送 Docker 镜像到 ghcr.io
#    - 部署到 Cloudflare Workers
#    - 部署到 Vercel
```

查看部署进度：

- 进入 GitHub 仓库的 **Actions** 标签页
- 查看对应的工作流运行状态

### 自动部署

1. 创建版本标签并推送
2. GitHub Actions 会自动触发所有部署流程
3. 可以在 **Actions** 标签页查看部署进度

### 手动部署

1. 进入 GitHub 仓库的 **Actions** 标签页
2. 选择要运行的工作流：
   - **Build and Push Docker Image** - 构建 Docker 镜像
   - **Deploy to Cloudflare Workers** - 部署到 Cloudflare
   - **Deploy to Vercel** - 部署到 Vercel
3. 点击 **Run workflow** → 选择分支 → **Run workflow**

## 使用 Docker 镜像

### 从 GitHub Container Registry 拉取

```bash
# 拉取最新版本
docker pull ghcr.io/<your-username>/imagine-server:latest

# 拉取特定版本
docker pull ghcr.io/<your-username>/imagine-server:v1.0.0

# 拉取主版本（自动获取最新的 1.x.x）
docker pull ghcr.io/<your-username>/imagine-server:1
```

### 运行容器

#### 使用环境变量

```bash
docker run -d \
  -p 3000:3000 \
  -e API_TOKEN=your-secret-token \
  -e HUGGINGFACE_TOKENS=hf_token1,hf_token2 \
  -e GITEE_TOKENS=gitee_token1,gitee_token2 \
  -e MODELSCOPE_TOKENS=ms_token1,ms_token2 \
  -e REDIS_URL=redis://your-redis:6379 \
  --name imagine-server \
  ghcr.io/<your-username>/imagine-server:latest
```

#### 使用 .env 文件

```bash
# 创建 .env 文件
cat > .env << EOF
API_TOKEN=your-secret-token
HUGGINGFACE_TOKENS=hf_token1,hf_token2
GITEE_TOKENS=gitee_token1,gitee_token2
MODELSCOPE_TOKENS=ms_token1,ms_token2
REDIS_URL=redis://localhost:6379
EOF

# 运行容器
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name imagine-server \
  ghcr.io/<your-username>/imagine-server:latest
```

#### 使用 Docker Compose

```yaml
# docker-compose.yml
version: "3.8"

services:
  app:
    image: ghcr.io/<your-username>/imagine-server:latest
    ports:
      - "3000:3000"
    environment:
      - API_TOKEN=${API_TOKEN}
      - HUGGINGFACE_TOKENS=${HUGGINGFACE_TOKENS}
      - GITEE_TOKENS=${GITEE_TOKENS}
      - MODELSCOPE_TOKENS=${MODELSCOPE_TOKENS}
      - REDIS_URL=redis://redis:6379
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

运行：

```bash
docker-compose up -d
```

### 验证部署

```bash
# 检查容器状态
docker ps

# 查看日志
docker logs imagine-server

# 测试健康检查
curl http://localhost:3000/api/health

# 查看可用模型
curl http://localhost:3000/api/v1/models
```

### 更新镜像

```bash
# 拉取最新镜像
docker pull ghcr.io/<your-username>/imagine-server:latest

# 停止并删除旧容器
docker stop imagine-server
docker rm imagine-server

# 启动新容器
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name imagine-server \
  ghcr.io/<your-username>/imagine-server:latest
```

### 多架构支持

镜像支持以下架构：

- `linux/amd64` - x86_64 架构（Intel/AMD）
- `linux/arm64` - ARM64 架构（Apple Silicon, ARM 服务器）

Docker 会自动选择适合你系统的架构。

## 验证部署

### Cloudflare Workers

```bash
# 查看部署状态
pnpm run wrangler deployments list

# 查看实时日志
pnpm run wrangler tail
```

访问你的 Cloudflare Workers URL 测试 API。

### Vercel

1. 在 Vercel Dashboard 查看部署状态
2. 访问 Vercel 提供的 URL 测试 API

## 故障排查

### Cloudflare 部署失败

1. 检查 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 是否正确
2. 确认 API Token 有足够的权限
3. 检查 `wrangler.toml` 中的 KV Namespace ID 是否已填写
4. 查看 GitHub Actions 日志获取详细错误信息

### Vercel 部署失败

1. 检查 `VERCEL_TOKEN`、`VERCEL_ORG_ID` 和 `VERCEL_PROJECT_ID` 是否正确
2. 确认 Vercel 项目已创建并关联
3. 检查环境变量是否在 Vercel Dashboard 中正确配置
4. 查看 GitHub Actions 日志获取详细错误信息

### 构建失败

1. 检查 `package.json` 中的构建脚本是否正确
2. 确认所有依赖都已正确安装
3. 本地运行 `pnpm run build` 测试构建是否成功

## 注意事项

1. **敏感信息安全**：

   - 不要在代码中硬编码 API Token 和密钥
   - 使用 GitHub Secrets 和环境变量管理敏感信息
   - 定期轮换 API Token

2. **成本控制**：

   - Cloudflare Workers 免费套餐有请求限制
   - Vercel 免费套餐有带宽和构建时间限制
   - 监控使用情况，避免超出限额

3. **环境隔离**：

   - 建议为开发和生产环境使用不同的 Token
   - 可以创建不同的分支触发不同的部署环境

4. **回滚策略**：
   - Cloudflare Workers 支持版本回滚
   - Vercel 支持一键回滚到之前的部署

## 相关资源

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Vercel 文档](https://vercel.com/docs)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [Vercel CLI 文档](https://vercel.com/docs/cli)
