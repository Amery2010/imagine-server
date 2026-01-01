# 版本发布指南

本指南说明如何发布新版本并触发自动部署。

## 版本号规范

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范：

```
v<major>.<minor>.<patch>[-prerelease]
```

- **major**（主版本号）：不兼容的 API 修改
- **minor**（次版本号）：向下兼容的功能性新增
- **patch**（修订号）：向下兼容的问题修正
- **prerelease**（预发布版本）：可选，如 `alpha`, `beta`, `rc.1`

### 示例

- `v1.0.0` - 正式版本
- `v1.1.0` - 新增功能
- `v1.1.1` - 修复 bug
- `v2.0.0` - 重大更新（不兼容）
- `v1.2.0-beta.1` - Beta 测试版本
- `v2.0.0-rc.1` - Release Candidate

## 发布流程

### 1. 准备发布

#### 更新版本号

编辑 `package.json`：

```json
{
  "version": "1.1.0"
}
```

#### 更新 CHANGELOG

编辑 `docs/CHANGELOG.md`，添加新版本的更新内容：

```markdown
## [1.1.0] - 2025-12-30

### Added

- 新增 XXX 功能
- 支持 YYY 特性

### Changed

- 优化 ZZZ 性能
- 改进 AAA 体验

### Fixed

- 修复 BBB 问题
- 解决 CCC 错误

### Deprecated

- 废弃 DDD 方法（将在 v2.0.0 移除）
```

#### 更新文档

确保所有文档都是最新的：

- README.md
- API 文档
- 部署指南
- 配置说明

### 2. 提交更改

```bash
# 查看更改
git status

# 添加所有更改
git add .

# 提交（使用清晰的提交信息）
git commit -m "chore: prepare release v1.1.0"

# 推送到远程仓库
git push origin main
```

### 3. 创建版本标签

```bash
# 创建带注释的标签（推荐）
git tag -a v1.1.0 -m "Release version 1.1.0

- 新增 XXX 功能
- 优化 YYY 性能
- 修复 ZZZ 问题
"

# 或创建轻量标签
git tag v1.1.0

# 查看标签
git tag -l

# 查看标签详情
git show v1.1.0
```

### 4. 推送标签

```bash
# 推送单个标签
git push origin v1.1.0

# 或推送所有标签
git push origin --tags
```

### 5. 自动部署

推送标签后，GitHub Actions 会自动触发以下工作流：

1. **Create GitHub Release**

   - 从 `docs/CHANGELOG.md` 提取发布说明
   - 创建 GitHub Release

2. **Build Release Assets**

   - 构建多平台 Node.js 发布包
   - 上传到 GitHub Release

3. **Build and Push Docker Image**

   - 构建多架构 Docker 镜像
   - 推送到 ghcr.io
   - 生成标签：`v1.1.0`, `1.1`, `1`, `latest`

4. **Deploy to Cloudflare Workers**

   - 构建项目
   - 部署到 Cloudflare Workers

5. **Deploy to Vercel**
   - 构建项目
   - 部署到 Vercel

### 6. 监控部署

1. 进入 GitHub 仓库的 **Actions** 标签页
2. 查看工作流运行状态
3. 检查是否有错误或警告
4. 等待所有工作流完成

### 7. 验证部署

#### 验证 GitHub Release

1. 进入 GitHub 仓库的 **Releases** 页面
2. 确认新版本的 Release 已创建
3. 检查 Release 说明是否正确
4. 确认发布包已上传：
   - `imagine-server-linux-x64.tar.gz`
   - `imagine-server-linux-arm64.tar.gz`
   - `imagine-server-darwin-x64.tar.gz`
   - `imagine-server-darwin-arm64.tar.gz`
   - `imagine-server-win32-x64.zip`

#### 验证 Docker 镜像

```bash
# 拉取镜像
docker pull ghcr.io/<your-username>/imagine-server:v1.1.0

# 运行容器
docker run -d -p 3000:3000 \
  --env-file .env \
  ghcr.io/<your-username>/imagine-server:v1.1.0

# 测试 API
curl http://localhost:3000/api/health
```

#### 验证 Cloudflare Workers

```bash
# 访问你的 Cloudflare Workers URL
curl https://your-worker.workers.dev/api/health

# 查看部署日志
pnpm run wrangler:tail
```

#### 验证 Vercel

```bash
# 访问你的 Vercel URL
curl https://your-project.vercel.app/api/health
```

### 8. 创建 GitHub Release

GitHub Release 会自动创建，但你也可以手动编辑：

1. 进入 GitHub 仓库的 **Releases** 页面
2. 找到自动创建的 Release
3. 点击 **Edit release**
4. 可以添加额外的说明或附件
5. 如果是预发布版本，勾选 **This is a pre-release**
6. 点击 **Update release**

## 📦 本地打包

除了 GitHub Actions 自动构建，你也可以在本地创建发布包：

```bash
# 构建发布包
pnpm run package
```

这会：

1. 构建 TypeScript 代码
2. 安装生产依赖
3. 复制必要文件
4. 创建启动脚本
5. 生成压缩包

生成的文件：

- `release/` - 发布目录
- `imagine-server-v{version}-{platform}-{arch}.tar.gz` 或 `.zip` - 压缩包

测试发布包：

```bash
cd release
cp .env.example .env
# 编辑 .env 配置
./start.sh  # 或 start.bat (Windows)
```

## 快速发布脚本

创建一个发布脚本 `scripts/release.sh`：

```bash
#!/bin/bash

# 检查参数
if [ -z "$1" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.1.0"
  exit 1
fi

VERSION=$1
TAG="v${VERSION}"

echo "🚀 Preparing release ${TAG}..."

# 更新 package.json 版本号
echo "📝 Updating package.json..."
npm version ${VERSION} --no-git-tag-version

# 提交更改
echo "💾 Committing changes..."
git add package.json
git commit -m "chore: bump version to ${VERSION}"

# 推送到远程
echo "⬆️  Pushing to remote..."
git push origin main

# 创建标签
echo "🏷️  Creating tag ${TAG}..."
git tag -a ${TAG} -m "Release version ${VERSION}"

# 推送标签
echo "⬆️  Pushing tag..."
git push origin ${TAG}

echo "✅ Release ${TAG} created successfully!"
echo "📦 GitHub Actions will now build and deploy automatically."
echo "🔗 Check progress at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
```

使用方法：

```bash
# 赋予执行权限
chmod +x scripts/release.sh

# 发布新版本
./scripts/release.sh 1.1.0
```

## 回滚版本

如果发现问题需要回滚：

### 1. 删除错误的标签

```bash
# 删除本地标签
git tag -d v1.1.0

# 删除远程标签
git push origin :refs/tags/v1.1.0
```

### 2. 回滚部署

#### Cloudflare Workers

```bash
# 查看部署历史
pnpm run wrangler deployments list

# 回滚到指定版本
pnpm run wrangler rollback [deployment-id]
```

#### Vercel

1. 进入 Vercel Dashboard
2. 选择项目 → **Deployments**
3. 找到之前的稳定版本
4. 点击 **...** → **Promote to Production**

#### Docker

```bash
# 使用之前的版本
docker pull ghcr.io/<your-username>/imagine-server:v1.0.0
docker stop imagine-server
docker rm imagine-server
docker run -d -p 3000:3000 \
  --env-file .env \
  ghcr.io/<your-username>/imagine-server:v1.0.0
```

### 3. 创建修复版本

```bash
# 修复问题后，发布修订版本
git tag v1.1.1
git push origin v1.1.1
```

## 预发布版本

用于测试新功能，不会影响生产环境：

```bash
# 创建 beta 版本
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1

# 创建 rc 版本
git tag v1.2.0-rc.1
git push origin v1.2.0-rc.1
```

预发布版本的 Docker 镜像标签：

- `ghcr.io/<username>/imagine-server:v1.2.0-beta.1`
- `ghcr.io/<username>/imagine-server:1.2.0-beta.1`

注意：预发布版本不会更新 `latest` 标签。

## 最佳实践

1. **遵循语义化版本**：让用户清楚了解更新的影响
2. **维护 CHANGELOG**：记录每个版本的变更
3. **测试后再发布**：确保所有测试通过
4. **使用带注释的标签**：提供版本说明
5. **创建 GitHub Release**：方便用户查看和下载
6. **监控部署状态**：确保部署成功
7. **验证功能**：发布后测试关键功能
8. **准备回滚方案**：出问题时快速恢复

## 版本发布检查清单

发布前检查：

- [ ] 所有测试通过
- [ ] 更新 `package.json` 版本号
- [ ] 更新 `CHANGELOG.md`
- [ ] 更新相关文档
- [ ] 提交所有更改
- [ ] 创建版本标签
- [ ] 推送标签到远程

发布后验证：

- [ ] GitHub Actions 工作流全部成功
- [ ] Docker 镜像可以正常拉取和运行
- [ ] Cloudflare Workers 部署成功
- [ ] Vercel 部署成功
- [ ] API 功能正常
- [ ] 创建 GitHub Release
- [ ] 通知用户（如有必要）

## 相关资源

- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [Git 标签文档](https://git-scm.com/book/zh/v2/Git-基础-打标签)
- [GitHub Releases 文档](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Keep a Changelog](https://keepachangelog.com/zh-CN/)
