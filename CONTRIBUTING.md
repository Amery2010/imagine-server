# 为 Imagine Server 贡献代码

感谢你对 Imagine Server 项目的关注！本文档提供了贡献代码的指南和说明。

## 开始使用

### 前置要求

- Node.js >= 18.0.0
- pnpm（推荐）或 npm
- Git

### 设置开发环境

1. Fork 并克隆仓库：

```bash
git clone https://github.com/Amery2010/imagine-server.git
cd imagine-server
```

2. 安装依赖：

```bash
pnpm install
```

3. 复制环境变量文件：

```bash
cp .env.example .env
```

4. 在 `.env` 文件中配置你的 API tokens

5. 启动开发服务器：

```bash
pnpm run dev
```

## 开发流程

### 代码风格

- 使用 TypeScript 确保类型安全
- 遵循现有的代码风格
- 使用 2 个空格进行缩进
- 为复杂逻辑添加注释
- 保持函数简洁且专注

### 类型检查

在提交代码前，确保你的代码通过类型检查：

```bash
pnpm run type-check
```

### 测试

在本地测试你的更改：

```bash
# Vercel 环境
pnpm run vercel:dev

# Cloudflare Workers 环境
pnpm run wrangler:dev
```

## 进行更改

### 分支命名

- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `chore/` - 维护任务

示例：`feature/add-new-model-support`

### 提交信息

遵循约定式提交格式：

- `feat:` - 新功能
- `fix:` - Bug 修复
- `docs:` - 文档变更
- `style:` - 代码样式变更（格式化等）
- `refactor:` - 代码重构
- `test:` - 添加或更新测试
- `chore:` - 维护任务

示例：`feat: add support for DALL-E 3 model`

### Pull Request 流程

1. 从 `main` 分支创建新分支
2. 进行你的更改
3. 充分测试
4. 如有需要，更新文档
5. 使用清晰的信息提交你的更改
6. 推送到你的 fork
7. 创建 Pull Request

#### Pull Request 指南

- 提供清晰的更改描述
- 引用相关的 issue
- 对于 UI 更改，包含截图
- 确保所有检查通过
- 请求维护者审查

## 添加新功能

### 添加新的 AI Provider

本项目采用插件化架构，添加新的 Provider 非常简单！

**详细指南**：请查看 [Provider 插件开发指南](./docs/PROVIDER_PLUGIN_GUIDE.md)

**快速步骤**：

1. 在 `src/providers/` 创建新的 Provider 文件（如 `myprovider.ts`）
2. 继承 `BaseProvider` 类并实现必需的方法
3. 在 `src/providers/registry.ts` 中注册你的 Provider
4. 更新环境变量配置（如果需要 Token）
5. 测试你的实现
6. 更新文档

**示例代码**：

```typescript
import { BaseProvider, type ModelConfig } from "./base";

export class MyProvider extends BaseProvider {
  readonly name = "myprovider";
  readonly supportedActions = ["generate", "text"];

  getModelConfigs() {
    return {
      "my-model": {
        apiId: "api-model-id",
        config: {
          id: "myprovider/my-model",
          name: "My Model",
          type: ["text2image"],
        },
      },
    };
  }

  async handleRequest(c, action, params) {
    // 实现你的逻辑
  }
}
```

然后在 `src/providers/registry.ts` 中注册：

```typescript
providerRegistry.register(new MyProvider());
```

完成！你的 Provider 现在可以通过 `myprovider/my-model` 访问了。

### 添加新模型

如果你只是想为现有的 Provider 添加新模型：

1. 在对应的 Provider 文件（如 `src/providers/gitee.ts`）中更新 `getModelConfigs()` 方法
2. 添加模型配置信息
3. 如果需要特殊处理逻辑，在相应的 handler 方法中添加
4. 更新 README.md 中的模型列表
5. 充分测试新模型

**示例**：

```typescript
getModelConfigs() {
  return {
    // ... 现有模型
    "new-model": {
      apiId: "API-Model-ID",
      config: {
        id: "gitee/new-model",
        name: "New Model Name",
        type: ["text2image"],
        steps: { range: [1, 20], default: 10 },
      },
    },
  };
}
```

## 代码审查

所有提交都需要经过审查。我们使用 GitHub pull requests 进行此流程。

### 审查标准

- 代码质量和风格
- 类型安全
- 错误处理
- 文档完整性
- 性能考虑
- 安全性影响

## 报告问题

### Bug 报告

请包含：

- 问题的清晰描述
- 重现步骤
- 预期行为与实际行为
- 环境详情（操作系统、Node 版本等）
- 错误信息和日志

### 功能请求

请包含：

- 功能的清晰描述
- 使用场景和好处
- 可能的实现方法
- 任何相关示例

## 有疑问？

欢迎：

- 开启 issue 进行讨论
- 在 pull request 评论中提问
- 联系维护者

## 许可证

通过贡献代码，你同意你的贡献将采用 MIT 许可证。

## 感谢！

你的贡献让这个项目变得更好。我们感谢你的时间和努力！🎉
