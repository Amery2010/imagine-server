---
layout: home

hero:
  name: "Imagine Server"
  text: "统一 AI 图像生成 API"
  tagline: 支持多个 AI 提供商的图像生成服务
  image:
    src: /logo.svg
    alt: Imagine Server
  actions:
    - theme: brand
      text: 快速开始
      link: /QUICKSTART
    - theme: alt
      text: 查看 GitHub
      link: https://github.com/Amery2010/imagine-server

features:
  - icon: 🎨
    title: 多模型支持
    details: 集成 FLUX、Qwen、Z-Image 等多个先进的 AI 模型
  - icon: 🔌
    title: 插件化架构
    details: 模块化的 Provider 系统，轻松扩展新的 AI 服务提供商
  - icon: 🔄
    title: 智能 Token 管理
    details: 自动切换和管理多个 API Token，配额耗尽时自动切换
  - icon: 💾
    title: 统一存储抽象
    details: 使用 Unstorage 支持 Redis、Cloudflare KV 等多种存储后端
  - icon: 🌐
    title: 多平台部署
    details: 支持 Cloudflare Workers、Vercel、Node.js 等多种部署环境
  - icon: 🔐
    title: Bearer Token 认证
    details: 可选的 API 访问控制，支持多个 Token 配置
  - icon: 🚀
    title: 自动化部署
    details: GitHub Actions 自动构建 Docker 镜像并部署到多个平台
  - icon: 📦
    title: 容器化支持
    details: 多架构 Docker 镜像，支持 x86_64 和 ARM64 平台
---

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/Amery2010/imagine-server.git
cd imagine-server

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env

# 启动开发服务器
pnpm run dev
```

查看 [快速开始指南](/QUICKSTART) 了解更多详情。
