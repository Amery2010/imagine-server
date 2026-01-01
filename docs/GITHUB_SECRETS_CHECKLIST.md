# GitHub Secrets 配置清单

快速检查清单，确保所有必需的 GitHub Secrets 都已正确配置。

## 📋 Docker 镜像构建所需配置

### 无需额外配置

Docker 镜像构建使用 `GITHUB_TOKEN`，这是 GitHub Actions 自动提供的，无需手动配置。

镜像会自动推送到：`ghcr.io/<your-username>/imagine-server`

### 设置镜像可见性（可选）

默认镜像是私有的，如需公开访问：

1. 进入 GitHub 个人主页 → **Packages**
2. 找到 `imagine-server` 包
3. **Package settings** → **Change visibility** → **Public**

## 📋 Cloudflare Workers 部署所需 Secrets

在 GitHub 仓库的 **Settings** → **Secrets and variables** → **Actions** 中添加：

### 必需的 Secrets

- [ ] `CLOUDFLARE_API_TOKEN` - Cloudflare API Token

  - 获取方式：Cloudflare Dashboard → My Profile → API Tokens → Create Token
  - 权限：Edit Cloudflare Workers

- [ ] `CLOUDFLARE_ACCOUNT_ID` - Cloudflare Account ID
  - 获取方式：Cloudflare Dashboard 右侧栏

### 应用配置 Secrets

- [ ] `API_TOKEN` - 应用 API 访问令牌（可选，用于访问控制）

  - 自定义生成，可以是任意字符串
  - 支持多个 token，用逗号分隔

- [ ] `HUGGINGFACE_TOKENS` - Hugging Face API Tokens

  - 获取方式：https://huggingface.co/settings/tokens
  - 支持多个 token，用逗号分隔

- [ ] `GITEE_TOKENS` - Gitee AI API Tokens

  - 获取方式：https://ai.gitee.com/dashboard/settings/tokens
  - 支持多个 token，用逗号分隔

- [ ] `MODELSCOPE_TOKENS` - ModelScope API Tokens
  - 获取方式：https://modelscope.cn/my/myaccesstoken
  - 支持多个 token，用逗号分隔

## 📋 Vercel 部署所需 Secrets

### 必需的 Secrets

- [ ] `VERCEL_TOKEN` - Vercel API Token

  - 获取方式：Vercel Dashboard → Account Settings → Tokens → Create Token

- [ ] `VERCEL_ORG_ID` - Vercel Organization ID

  - 获取方式：运行 `vercel link` 后查看 `.vercel/project.json`
  - 或在 Vercel 项目 URL 中找到

- [ ] `VERCEL_PROJECT_ID` - Vercel Project ID
  - 获取方式：运行 `vercel link` 后查看 `.vercel/project.json`
  - 或在 Vercel 项目 Settings → General 中找到

### Vercel 环境变量配置

在 Vercel Dashboard 的项目 **Settings** → **Environment Variables** 中添加：

- [ ] `API_TOKEN` - 应用 API 访问令牌
- [ ] `HUGGINGFACE_TOKENS` - Hugging Face API Tokens
- [ ] `GITEE_TOKENS` - Gitee AI API Tokens
- [ ] `MODELSCOPE_TOKENS` - ModelScope API Tokens
- [ ] `NODE_ENV` - 设置为 `production`

## 🔍 验证配置

### 方法 1：使用检查工作流

1. 进入 GitHub 仓库的 **Actions** 标签页
2. 选择 **Check Deployment Secrets** 工作流
3. 点击 **Run workflow** → **Run workflow**
4. 查看运行结果，确认所有必需的 Secrets 都已设置

### 方法 2：手动触发部署

1. 进入 **Actions** 标签页
2. 选择 **Deploy to Cloudflare Workers** 或 **Deploy to Vercel**
3. 点击 **Run workflow** → **Run workflow**
4. 如果部署失败，查看日志找出缺失的配置

## 📝 配置示例

### GitHub Secrets 格式

```
# 单个 token
API_TOKEN=your-secret-token-here

# 多个 tokens（逗号分隔，不要有空格）
HUGGINGFACE_TOKENS=hf_token1,hf_token2,hf_token3
GITEE_TOKENS=gitee_token1,gitee_token2
MODELSCOPE_TOKENS=ms_token1,ms_token2
```

### Cloudflare KV Namespaces

在部署前，需要在 `wrangler.toml` 中配置 KV Namespace IDs：

```bash
# 创建 KV Namespaces
pnpm run wrangler kv:namespace create "TOKEN_STATUS_KV"
pnpm run wrangler kv:namespace create "TOKEN_STATUS_KV" --preview
pnpm run wrangler kv:namespace create "VIDEO_TASK_KV"
pnpm run wrangler kv:namespace create "VIDEO_TASK_KV" --preview
```

将生成的 ID 填入 `wrangler.toml` 文件。

## ⚠️ 安全提示

1. **不要在代码中硬编码敏感信息**
2. **不要将 `.env` 文件提交到 Git**
3. **定期轮换 API Tokens**
4. **使用最小权限原则配置 API Tokens**
5. **监控 API 使用情况，防止滥用**

## 🔗 相关文档

- [完整部署指南](./GITHUB_ACTIONS_DEPLOYMENT.md)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Vercel 文档](https://vercel.com/docs)
- [GitHub Actions 文档](https://docs.github.com/en/actions)

## 💡 常见问题

### Q: 如何生成安全的 API_TOKEN？

A: 可以使用以下方法生成随机字符串：

```bash
# 使用 openssl
openssl rand -base64 32

# 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 使用 Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Q: 多个 tokens 如何配置？

A: 使用逗号分隔，不要有空格：

```
HUGGINGFACE_TOKENS=token1,token2,token3
```

### Q: 如何更新已配置的 Secret？

A: 在 GitHub 仓库的 **Settings** → **Secrets and variables** → **Actions** 中，点击 Secret 名称，然后点击 **Update secret**。

### Q: Vercel 环境变量和 GitHub Secrets 有什么区别？

A:

- **GitHub Secrets**：用于 GitHub Actions 工作流中，部署时使用
- **Vercel 环境变量**：用于 Vercel 运行时环境，应用运行时使用
- 两者都需要配置相同的应用配置（API_TOKEN、HUGGINGFACE_TOKENS 等）

## ✅ 配置完成后

配置完成后，创建并推送版本标签，GitHub Actions 会自动触发所有部署：

```bash
# 1. 提交所有更改
git add .
git commit -m "Ready for deployment"

# 2. 创建版本标签
git tag v1.0.0

# 3. 推送标签（会自动触发部署）
git push origin v1.0.0

# 4. 查看部署进度
# 在 GitHub Actions 标签页查看：
# - Build and Push Docker Image
# - Deploy to Cloudflare Workers
# - Deploy to Vercel
```

### 版本标签格式

- 必须以 `v` 开头
- 建议使用语义化版本：`v<major>.<minor>.<patch>`
- 示例：`v1.0.0`, `v1.2.3`, `v2.0.0-beta.1`

### 生成的 Docker 镜像标签

推送 `v1.2.3` 会生成以下镜像标签：

- `ghcr.io/<username>/imagine-server:v1.2.3`
- `ghcr.io/<username>/imagine-server:1.2`
- `ghcr.io/<username>/imagine-server:1`
- `ghcr.io/<username>/imagine-server:latest`
