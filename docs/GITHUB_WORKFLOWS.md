# GitHub Actions 工作流说明

本目录包含所有 GitHub Actions 自动化工作流配置。

## 📋 工作流列表

### 1. 🐳 Build and Push Docker Image (`build-docker.yml`)

**用途**：构建多架构 Docker 镜像并推送到 GitHub Container Registry

**触发条件**：

- 推送以 `v` 开头的版本标签（如 `v1.0.0`）
- 手动触发

**功能**：

- 构建支持 `linux/amd64` 和 `linux/arm64` 的多架构镜像
- 推送到 `ghcr.io/<username>/imagine-server`
- 自动生成多个标签：
  - `v1.2.3` - 完整版本号
  - `1.2` - 主次版本号
  - `1` - 主版本号
  - `latest` - 最新版本（仅正式版本）
- 使用 GitHub Actions 缓存加速构建
- 生成构建证明（attestation）

**所需权限**：

- `contents: read` - 读取仓库内容
- `packages: write` - 推送到 GHCR

**使用的 Secrets**：

- `GITHUB_TOKEN` - 自动提供，无需配置

---

### 2. ☁️ Deploy to Cloudflare Workers (`deploy-cloudflare.yml`)

**用途**：自动部署到 Cloudflare Workers

**触发条件**：

- 推送以 `v` 开头的版本标签（如 `v1.0.0`）
- 手动触发

**功能**：

- 安装依赖（pnpm）
- 构建 TypeScript 项目
- 部署到 Cloudflare Workers
- 自动设置环境变量和 Secrets

**所需 Secrets**：

- `CLOUDFLARE_API_TOKEN` - Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare Account ID
- `API_TOKEN` - 应用 API 访问令牌
- `HUGGINGFACE_TOKENS` - Hugging Face API Tokens
- `GITEE_TOKENS` - Gitee AI API Tokens
- `MODELSCOPE_TOKENS` - ModelScope API Tokens

**前置要求**：

- 在 `wrangler.toml` 中配置 KV Namespace IDs

---

### 3. ▲ Deploy to Vercel (`deploy-vercel.yml`)

**用途**：自动部署到 Vercel

**触发条件**：

- 推送以 `v` 开头的版本标签（如 `v1.0.0`）
- 手动触发

**功能**：

- 安装依赖（pnpm）
- 构建 TypeScript 项目
- 部署到 Vercel 生产环境

**所需 Secrets**：

- `VERCEL_TOKEN` - Vercel API Token
- `VERCEL_ORG_ID` - Vercel Organization ID
- `VERCEL_PROJECT_ID` - Vercel Project ID

**前置要求**：

- 在 Vercel Dashboard 中配置环境变量

---

### 4. 📚 Deploy VitePress site to Pages (`deploy-docs.yml`)

**用途**：构建并部署文档站点到 GitHub Pages

**触发条件**：

- 推送到 `main` 分支
- 手动触发

**功能**：

- 构建 VitePress 文档站点
- 部署到 GitHub Pages

**所需权限**：

- `contents: read` - 读取仓库内容
- `pages: write` - 写入 GitHub Pages
- `id-token: write` - 生成部署令牌

**所需 Secrets**：

- 无（使用 `GITHUB_TOKEN`）

**前置要求**：

- 在仓库设置中启用 GitHub Pages
- 设置 Source 为 "GitHub Actions"

---

### 5. 🔍 Check Deployment Secrets (`check-secrets.yml`)

**用途**：验证部署所需的 Secrets 是否正确配置

**触发条件**：

- 仅手动触发

**功能**：

- 检查 Cloudflare 相关 Secrets
- 检查 Vercel 相关 Secrets
- 检查应用配置 Secrets
- 提供清晰的检查结果

**使用方法**：

1. 进入 **Actions** 标签页
2. 选择 **Check Deployment Secrets**
3. 点击 **Run workflow**
4. 查看运行结果

---

## 🚀 使用指南

### 发布新版本

```bash
# 方法 1: 使用发布脚本（推荐）
./scripts/release.sh 1.0.0

# 方法 2: 手动创建标签
git tag v1.0.0
git push origin v1.0.0
```

推送标签后，以下工作流会自动运行：

- Build and Push Docker Image
- Deploy to Cloudflare Workers
- Deploy to Vercel

### 手动触发部署

1. 进入 GitHub 仓库的 **Actions** 标签页
2. 选择要运行的工作流
3. 点击 **Run workflow**
4. 选择分支（通常是 `main`）
5. 点击 **Run workflow** 按钮

### 查看部署状态

1. 进入 **Actions** 标签页
2. 查看最近的工作流运行
3. 点击工作流查看详细日志
4. 绿色勾号表示成功，红色叉号表示失败

### 验证 Secrets 配置

```bash
# 在 Actions 标签页手动运行
Check Deployment Secrets
```

查看输出，确认所有必需的 Secrets 都已设置。

---

## 🔧 配置指南

### 首次配置

1. **配置 GitHub Secrets**

   - 进入 **Settings** → **Secrets and variables** → **Actions**
   - 添加所需的 Secrets（参考各工作流说明）

2. **配置 Cloudflare**

   - 创建 KV Namespaces
   - 更新 `wrangler.toml`

3. **配置 Vercel**

   - 创建项目
   - 配置环境变量
   - 获取 Organization ID 和 Project ID

4. **启用 GitHub Pages**

   - 进入 **Settings** → **Pages**
   - Source 选择 "GitHub Actions"

5. **验证配置**
   - 运行 **Check Deployment Secrets** 工作流
   - 手动触发一次部署测试

详细配置步骤请查看：

- [GitHub Actions 部署文档](./GITHUB_ACTIONS_DEPLOYMENT.md)
- [GitHub Secrets 配置清单](./GITHUB_SECRETS_CHECKLIST.md)

---

## 📊 工作流依赖关系

```
版本标签推送 (v1.0.0)
    ├── Build and Push Docker Image
    │   └── 推送到 ghcr.io
    ├── Deploy to Cloudflare Workers
    │   └── 部署到 Cloudflare
    └── Deploy to Vercel
        └── 部署到 Vercel

代码推送到 main 分支
    └── Deploy VitePress site to Pages
        └── 部署文档到 GitHub Pages
```

---

## 🐛 故障排查

### Docker 构建失败

**可能原因**：

- Dockerfile 语法错误
- 依赖安装失败
- 构建超时

**解决方法**：

1. 检查 `docker/Dockerfile` 语法
2. 本地测试构建：`docker build -f docker/Dockerfile .`
3. 查看 Actions 日志获取详细错误信息

### Cloudflare 部署失败

**可能原因**：

- API Token 无效或权限不足
- Account ID 错误
- KV Namespace 未配置

**解决方法**：

1. 验证 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`
2. 检查 `wrangler.toml` 中的 KV Namespace IDs
3. 本地测试：`pnpm run wrangler:deploy`

### Vercel 部署失败

**可能原因**：

- Token 无效
- Organization ID 或 Project ID 错误
- 环境变量未配置

**解决方法**：

1. 验证 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`
2. 检查 Vercel Dashboard 中的环境变量
3. 本地测试：`pnpm run vercel:deploy`

### Secrets 未设置

**解决方法**：

1. 运行 **Check Deployment Secrets** 工作流
2. 根据输出添加缺失的 Secrets
3. 重新触发失败的工作流

---

## 📚 相关文档

- [GitHub Actions 部署文档](./GITHUB_ACTIONS_DEPLOYMENT.md)
- [GitHub Secrets 配置清单](./GITHUB_SECRETS_CHECKLIST.md)
- [版本发布指南](./RELEASE_GUIDE.md)
- [部署指南](./DEPLOYMENT.md)

---

## 🔐 安全注意事项

1. **不要在工作流文件中硬编码敏感信息**
2. **使用 GitHub Secrets 管理所有敏感数据**
3. **定期轮换 API Tokens**
4. **使用最小权限原则配置 Tokens**
5. **审查工作流日志，确保没有泄露敏感信息**
6. **不要在公开仓库中暴露私有配置**

---

## 💡 最佳实践

1. **版本标签**：使用语义化版本（v1.0.0）
2. **测试后发布**：确保本地测试通过后再推送标签
3. **监控部署**：推送标签后检查 Actions 运行状态
4. **保持文档更新**：更新 CHANGELOG 和相关文档
5. **使用发布脚本**：使用 `scripts/release.sh` 自动化发布流程
6. **验证部署**：部署后测试关键功能
7. **准备回滚**：了解如何快速回滚到之前的版本

---

## 🆘 获取帮助

如果遇到问题：

1. 查看 [故障排查](#-故障排查) 部分
2. 检查 Actions 日志获取详细错误信息
3. 查阅相关文档
4. 在 GitHub Issues 中提问
5. 查看 GitHub Actions 官方文档

---

**最后更新**：2025-12-30

---

## 🆕 新增工作流

### Create GitHub Release

**文件**：`.github/workflows/create-release.yml`

自动从 `docs/CHANGELOG.md` 提取发布说明并创建 GitHub Release。

**触发条件**：

- 推送以 `v` 开头的版本标签
- 手动触发

**功能**：

- 自动读取 CHANGELOG.md 中对应版本的更新内容
- 创建 GitHub Release
- 设置 Release 标题和描述

**使用方法**：

确保 `docs/CHANGELOG.md` 遵循 [Keep a Changelog](https://keepachangelog.com/) 格式：

```markdown
## [1.0.0] - 2025-12-30

### Added

- 新功能 A
- 新功能 B

### Changed

- 改进 C

### Fixed

- 修复 D
```

推送标签后自动创建 Release：

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## 📦 本地打包

除了 GitHub Actions 自动构建，你也可以在本地创建发布包：

```bash
# 构建发布包
pnpm run package

# 生成的文件
# - release/ 目录包含所有文件
# - imagine-server-v{version}-{platform}-{arch}.tar.gz 或 .zip
```

本地打包脚本会：

1. 构建 TypeScript 代码
2. 安装生产依赖
3. 复制必要文件
4. 创建启动脚本
5. 生成压缩包

测试发布包：

```bash
cd release
cp .env.example .env
# 编辑 .env
./start.sh  # 或 start.bat (Windows)
```

---

## 🔄 完整的发布流程

推送版本标签后，以下工作流会自动运行：

```
推送版本标签 (v1.0.0)
    │
    ├─→ Create GitHub Release
    │   └─ 从 CHANGELOG.md 创建 Release
    │
    ├─→ Build Release Assets
    │   ├─ 构建 Linux x64 包
    │   ├─ 构建 Linux arm64 包
    │   ├─ 构建 macOS x64 包
    │   ├─ 构建 macOS arm64 包
    │   ├─ 构建 Windows x64 包
    │   └─ 上传到 GitHub Release
    │
    ├─→ Build and Push Docker Image
    │   └─ 推送到 ghcr.io
    │
    ├─→ Deploy to Cloudflare Workers
    │   └─ 部署到 Cloudflare
    │
    └─→ Deploy to Vercel
        └─ 部署到 Vercel
```

所有工作流并行运行，互不影响。

---

**最后更新**：2025-12-30
