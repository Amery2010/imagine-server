# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-04

### Added

- 🖼️ **Web UI 集成**:
  - 集成 [Peinture](https://github.com/Amery2010/peinture) 作为前端界面
  - 提供友好的图形化操作体验
  - 支持文生图、图生图、图生视频等功能
  - 自动化前端构建脚本 `pnpm run build:frontend`
  - 构建时注入 `VITE_SERVICE_MODE=server` 环境变量启用服务器模式
- 📚 **新增文档**:
  - [前端集成说明](docs/FRONTEND_INTEGRATION.md) - 详细的前端集成指南（包含服务器模式说明）
  - [Vite 环境变量说明](docs/VITE_ENV_VARIABLES.md) - Vite 环境变量配置指南
  - [部署检查清单](docs/DEPLOYMENT_CHECKLIST.md) - 部署前的完整检查清单
- 🔧 **部署优化**:
  - 更新 GitHub Actions 工作流，自动构建前端并注入环境变量
  - 更新 Dockerfile，包含前端构建步骤和环境变量

### Changed

- 🔄 **路由结构调整**:
  - 根路径 `/` 现在返回 Web UI 界面
  - API 路由保持在 `/api/*` 路径下
  - 使用 Hono 的静态文件服务提供前端资源
- 🔧 **前端服务器模式**:
  - 前端构建时注入 `VITE_SERVICE_MODE=server` 环境变量
  - 使用 Vite 标准的环境变量机制（`VITE_` 前缀）
  - 前端自动调用本地 `/api` 接口，无需配置第三方 API
  - 统一使用后端的 Token 管理和请求代理

## [1.0.0] - 2026-01-01

### Added

- 🚀 **GitHub Actions 自动化部署系统**:
  - Docker 镜像自动构建并推送到 GitHub Container Registry (ghcr.io)
  - 支持多架构：linux/amd64, linux/arm64
  - 自动部署到 Cloudflare Workers
  - 自动部署到 Vercel
  - 基于版本标签触发（推送 `v*` 标签）
- 📝 **GitHub Release 自动化**:
  - 使用 `taiki-e/create-gh-release-action` 自动创建 Release
  - 从 `docs/CHANGELOG.md` 自动提取发布说明
  - 支持 Keep a Changelog 格式
- 📦 **多平台 Node.js 发布包**:
  - 自动构建 5 个平台的发布包（Linux x64/arm64, macOS x64/arm64, Windows x64）
  - 包含所有依赖和启动脚本
  - 自动上传到 GitHub Release
  - 提供本地打包脚本 `pnpm run package`
- 📚 **完善的文档系统**:
  - [GitHub Actions 部署文档](docs/GITHUB_ACTIONS_DEPLOYMENT.md) - 详细的自动化部署配置指南
  - [Secrets 配置清单](docs/GITHUB_SECRETS_CHECKLIST.md) - 快速配置检查清单
  - [版本发布指南](docs/RELEASE_GUIDE.md) - 完整的版本发布流程
  - [工作流说明](docs/GITHUB_WORKFLOWS.md) - 所有 GitHub Actions 工作流的详细说明
  - 文档已集成到 VitePress 文档站点
- 🛠️ **开发工具**:
  - 自动化版本发布脚本 `scripts/release.sh`
  - Secrets 配置验证工作流
  - 本地打包脚本 `scripts/package.js`

### Changed

- 📖 **文档站点更新**:
  - 新增"自动化部署"导航菜单和侧边栏分组
  - 首页新增"自动化部署"和"容器化支持"特性卡片
  - 移动 `.github/workflows/README.md` 到 `docs/GITHUB_WORKFLOWS.md`
- 🔄 **部署流程优化**:
  - 所有部署工作流改为基于版本标签触发
  - 文档部署仍保持推送到 main 分支触发
  - 所有工作流支持手动触发

### Technical Details

- **GitHub Actions 工作流**:
  - `build-docker.yml`: Docker 镜像构建和推送
  - `deploy-cloudflare.yml`: Cloudflare Workers 部署
  - `deploy-vercel.yml`: Vercel 部署
  - `create-release.yml`: GitHub Release 创建
  - `check-secrets.yml`: Secrets 配置验证
  - `deploy-docs.yml`: VitePress 文档部署
- **发布包内容**:
  - 编译后的 TypeScript 代码 (`dist/`)
  - 生产依赖 (`node_modules/`)
  - 服务器启动文件 (`server/`)
  - 配置文件和文档
  - 跨平台启动脚本 (`start.sh`, `start.bat`)
  - 发布说明 (`RELEASE_README.md`)
- **Docker 镜像标签**:
  - `v1.2.0` - 完整版本号
  - `1.2` - 主次版本号
  - `1` - 主版本号
  - `latest` - 最新版本

### Benefits

- 🎯 **完全自动化**: 推送版本标签即可完成所有部署
- 🌐 **多平台支持**: Docker、Cloudflare、Vercel、Node.js 发布包
- 📦 **即下即用**: 发布包包含所有依赖，解压即可运行
- 🔐 **安全管理**: 使用 GitHub Secrets 管理敏感信息
- 📊 **可追溯性**: 每个版本都有完整的 Release 和发布资产
- 🚀 **提升效率**: 从手动部署到一键发布

### Documentation

- 新增 7 个详细的部署和发布文档
- 所有文档集成到 VitePress 文档站点
- 提供完整的配置清单和故障排查指南
- 包含多个使用示例和最佳实践

[1.0.0]: https://github.com/Amery2010/imagine-server/releases/tag/v1.0.0
