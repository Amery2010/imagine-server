# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-12-30

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

## [1.1.0] - 2025-12-30

### Added

- 🔌 **插件化架构**: 重构为模块化的 Provider 插件系统
  - 每个 AI 服务提供商作为独立的插件存在
  - 新增 `src/providers/` 目录，包含所有 Provider 实现
  - 提供 `BaseProvider` 基类和 `IProvider` 接口
  - Provider 注册器统一管理所有 Provider
- 📚 **完善的文档系统**:
  - [Provider 插件开发指南](docs/PROVIDER_PLUGIN_GUIDE.md) - 详细的开发指南
  - [Provider 架构说明](docs/PROVIDER_ARCHITECTURE.md) - 系统架构概述
  - [快速参考](docs/QUICK_REFERENCE.md) - 常用代码片段和 API 参考
- 🛠️ **开发者友好**:
  - 降低贡献门槛，添加新 Provider 只需创建新文件
  - 提供完整的 TypeScript 类型定义
  - 代码复用性大幅提升

### Changed

- ♻️ **重构核心代码**:
  - `src/api/imagine.ts` 从 1485 行精简到约 150 行 (-90%)
  - 将 Provider 逻辑分离到独立文件
  - 提取通用工具函数到 `src/providers/utils.ts`
- 📁 **优化目录结构**:
  - 移动 `src/api/providers/` 到 `src/providers/`
  - 文档文件统一放到 `docs/` 目录
  - 更清晰的项目结构
- 📖 **更新文档**:
  - 更新 CONTRIBUTING.md，添加插件化架构说明
  - 更新 README.md，添加架构介绍

### Technical Details

- **Provider 实现**:
  - `GiteeProvider`: 支持 generate, edit, text, video, task-status
  - `HuggingFaceProvider`: 支持 generate, edit, text, video, task-status, upscaler
  - `ModelScopeProvider`: 支持 generate, edit, text
- **核心模块**:
  - `src/providers/base.ts`: Provider 接口和基类
  - `src/providers/utils.ts`: 通用工具函数
  - `src/providers/registry.ts`: Provider 注册器
  - `src/providers/index.ts`: 统一导出

### Backward Compatibility

- ✅ 所有现有 API 端点保持完全兼容
- ✅ 请求/响应格式保持不变
- ✅ 模型 ID 格式保持不变
- ✅ 环境变量配置保持不变
- ✅ 现有客户端代码无需任何修改

### Benefits

- 🎯 更好的代码组织和可维护性
- 🚀 更容易扩展和添加新功能
- 🧪 更容易测试和调试
- 👥 更好的团队协作支持
- 📚 更完善的文档和示例

## [1.0.0] - 2025-12-29

### Added

- Initial release of Imagine Server
- Multi-provider support (Hugging Face, Gitee AI, ModelScope)
- Unified storage abstraction with Unstorage
- Automatic token management and rotation
- Support for multiple AI operations:
  - Text-to-Image generation
  - Image-to-Image editing
  - Image-to-Video generation
  - Image upscaling
  - Text generation and prompt optimization
- Bearer token authentication
- Token statistics and management API
- Support for multiple deployment platforms:
  - Cloudflare Workers
  - Vercel
  - Node.js
- Automatic storage backend selection:
  - Upstash Redis (Vercel KV)
  - Standard Redis
  - Cloudflare KV
  - Memory (development fallback)
- Comprehensive API documentation
- Health check endpoint

### Features

- 🎨 Support for FLUX, Qwen, Z-Image, and other advanced AI models
- 🔄 Intelligent token rotation with quota exhaustion detection
- 💾 Unified KV storage with automatic backend selection
- 🌐 Multi-platform deployment support
- 🔐 Optional API access control
- 📊 Real-time token usage statistics
- ⚡ Fast and lightweight with Hono framework
- 🛡️ TypeScript for type safety

### Documentation

- Complete README with setup instructions
- API usage examples
- Deployment guides for Vercel and Cloudflare Workers
- Storage configuration documentation
- Troubleshooting guide

[1.2.0]: https://github.com/Amery2010/imagine-server/releases/tag/v1.2.0
[1.1.0]: https://github.com/Amery2010/imagine-server/releases/tag/v1.1.0
[1.0.0]: https://github.com/Amery2010/imagine-server/releases/tag/v1.0.0
