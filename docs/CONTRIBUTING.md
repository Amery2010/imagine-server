# Contributing to Imagine Server

Thank you for your interest in contributing to Imagine Server! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm (recommended) or npm
- Git

### Setup Development Environment

1. Fork and clone the repository:

```bash
git clone https://github.com/Amery2010/imagine-server.git
cd imagine-server
```

2. Install dependencies:

```bash
pnpm install
```

3. Copy environment variables:

```bash
cp .env.example .env
```

4. Configure your `.env` file with your API tokens

5. Start development server:

```bash
pnpm run dev
```

## Development Workflow

### Code Style

- We use TypeScript for type safety
- Follow the existing code style
- Use 2 spaces for indentation
- Add comments for complex logic
- Keep functions small and focused

### Type Checking

Before committing, ensure your code passes type checking:

```bash
pnpm run type-check
```

### Testing

Test your changes locally:

```bash
# For Vercel
pnpm run vercel:dev

# For Cloudflare Workers
pnpm run wrangler:dev
```

## Making Changes

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `chore/` - Maintenance tasks

Example: `feature/add-new-model-support`

### Commit Messages

Follow conventional commits format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example: `feat: add support for DALL-E 3 model`

### Pull Request Process

1. Create a new branch from `main`
2. Make your changes
3. Test thoroughly
4. Update documentation if needed
5. Commit your changes with clear messages
6. Push to your fork
7. Create a Pull Request

#### Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Include screenshots for UI changes
- Ensure all checks pass
- Request review from maintainers

## Adding New Features

### Adding a New AI Provider

本项目采用插件化架构，添加新的 Provider 非常简单！

**详细指南**: 请查看 [Provider 插件开发指南](./docs/PROVIDER_PLUGIN_GUIDE.md)

**快速步骤**:

1. 在 `src/providers/` 创建新的 Provider 文件（如 `myprovider.ts`）
2. 继承 `BaseProvider` 类并实现必需的方法
3. 在 `src/providers/registry.ts` 中注册你的 Provider
4. 更新环境变量配置（如果需要 Token）
5. 测试你的实现
6. 更新文档

**示例代码**:

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

然后在 `src/providers/registry.ts` 中注册:

```typescript
providerRegistry.register(new MyProvider());
```

完成！你的 Provider 现在可以通过 `myprovider/my-model` 访问了。

### Adding a New Model

如果你只是想为现有的 Provider 添加新模型：

1. 在对应的 Provider 文件（如 `src/providers/gitee.ts`）中更新 `getModelConfigs()` 方法
2. 添加模型配置信息
3. 如果需要特殊处理逻辑，在相应的 handler 方法中添加
4. 更新 README.md 中的模型列表
5. 充分测试新模型

**示例**:

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

## Code Review

All submissions require review. We use GitHub pull requests for this purpose.

### Review Criteria

- Code quality and style
- Type safety
- Error handling
- Documentation
- Performance considerations
- Security implications

## Reporting Issues

### Bug Reports

Include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, etc.)
- Error messages and logs

### Feature Requests

Include:

- Clear description of the feature
- Use case and benefits
- Possible implementation approach
- Any relevant examples

## Questions?

Feel free to:

- Open an issue for discussion
- Ask in pull request comments
- Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Your contributions help make this project better for everyone. We appreciate your time and effort! 🎉
