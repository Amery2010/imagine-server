import { defineConfig } from "@lando/vitepress-theme-default-plus/config";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Imagine Server",
  description: "统一 AI 图像生成 API 服务文档",
  base: "/imagine-server/",

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "首页", link: "/" },
      { text: "快速开始", link: "/QUICKSTART" },
      { text: "部署指南", link: "/DEPLOYMENT" },
      {
        text: "自动化部署",
        items: [
          { text: "GitHub Actions 部署", link: "/GITHUB_ACTIONS_DEPLOYMENT" },
          { text: "版本发布指南", link: "/RELEASE_GUIDE" },
        ],
      },
    ],

    sidebar: [
      {
        text: "指南",
        items: [
          { text: "快速开始", link: "/QUICKSTART" },
          { text: "快速参考", link: "/QUICK_REFERENCE" },
          { text: "部署指南", link: "/DEPLOYMENT" },
          { text: "前端集成指南", link: "/FRONTEND_INTEGRATION" },
        ],
      },
      {
        text: "自动化部署",
        items: [
          { text: "GitHub Actions 部署", link: "/GITHUB_ACTIONS_DEPLOYMENT" },
          { text: "Secrets 配置清单", link: "/GITHUB_SECRETS_CHECKLIST" },
          { text: "版本发布指南", link: "/RELEASE_GUIDE" },
          { text: "工作流说明", link: "/GITHUB_WORKFLOWS" },
        ],
      },
      {
        text: "架构",
        items: [
          { text: "架构概览", link: "/ARCHITECTURE_OVERVIEW" },
          { text: "Provider 架构", link: "/PROVIDER_ARCHITECTURE" },
          { text: "Provider 开发指南", link: "/PROVIDER_PLUGIN_GUIDE" },
          { text: "项目结构说明", link: "/PROJECT_STRUCTURE" },
        ],
      },
      {
        text: "其他",
        items: [{ text: "更新日志", link: "/CHANGELOG" }],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/Amery2010/imagine-server" },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 u14.app Team",
    },

    search: {
      provider: "local",
    },

    outline: {
      level: [2, 3],
      label: "目录",
    },

    docFooter: {
      prev: "上一页",
      next: "下一页",
    },

    lastUpdated: {
      text: "最后更新于",
      formatOptions: {
        dateStyle: "short",
        timeStyle: "short",
      },
    },
  },

  lastUpdated: true,

  ignoreDeadLinks: true,

  markdown: {
    lineNumbers: true,
  },
});
