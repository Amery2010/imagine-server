# Provider 插件系统

这个目录包含了所有 AI 服务提供商（Provider）的插件实现。

## 目录结构

```
src/providers/
├── base.ts            # Provider 接口和基类定义
├── utils.ts           # 通用工具函数
├── registry.ts        # Provider 注册器
├── index.ts           # 导出文件
├── gitee.ts           # Gitee AI Provider 实现
├── huggingface.ts     # Hugging Face Provider 实现
└── modelscope.ts      # Model Scope Provider 实现

docs/
├── PROVIDER_ARCHITECTURE.md      # 本文件
├── PROVIDER_PLUGIN_GUIDE.md      # Provider 开发指南
└── QUICK_REFERENCE.md            # 快速参考
```

## 核心概念

### Provider 接口

每个 Provider 必须实现 `IProvider` 接口：

- `name`: Provider 的唯一标识符
- `supportedActions`: 支持的操作类型数组
- `handleRequest()`: 处理请求的主方法
- `getApiModelId()`: 获取 API 使用的实际模型 ID
- `getModelConfigs()`: 返回该 Provider 支持的所有模型配置

### BaseProvider 基类

`BaseProvider` 提供了一些通用的辅助方法：

- `getApiModelId()`: 默认实现，从模型配置中获取 API ID
- `supportsAction()`: 检查是否支持指定的操作
- `throwUnsupportedAction()`: 抛出不支持操作的错误

### Provider 注册器

`ProviderRegistry` 管理所有已注册的 Provider：

- `register()`: 注册一个 Provider
- `get()`: 获取指定的 Provider
- `has()`: 检查 Provider 是否存在
- `getProviderNames()`: 获取所有 Provider 名称
- `getAllModelConfigs()`: 获取所有模型配置
- `parseModelId()`: 解析 `provider/model` 格式的模型 ID

## 支持的操作类型

- `generate`: 文本生成图片
- `edit`: 图片编辑
- `text`: 文本处理（如 prompt 优化）
- `video`: 图片生成视频
- `task-status`: 查询异步任务状态
- `upscaler`: 图片放大

## 如何添加新的 Provider

详细指南请参考：[Provider 插件开发指南](./PROVIDER_PLUGIN_GUIDE.md)

### 快速步骤

1. 创建新的 Provider 类文件（在 `src/providers/` 目录）
2. 继承 `BaseProvider` 并实现必需的方法
3. 在 `src/providers/registry.ts` 中注册
4. 在 `src/providers/index.ts` 中导出（可选）

### 最小示例

```typescript
import { BaseProvider, type ModelConfig } from "./base";

export class MyProvider extends BaseProvider {
  readonly name = "myprovider";
  readonly supportedActions = ["generate"];

  getModelConfigs() {
    return {
      "my-model": {
        apiId: "api-id",
        config: {
          id: "myprovider/my-model",
          name: "My Model",
          type: ["text2image"],
        },
      },
    };
  }

  async handleRequest(c, action, params) {
    if (!this.supportsAction(action)) {
      this.throwUnsupportedAction(action);
    }
    // 实现你的逻辑
  }
}
```

## 现有 Provider

### Gitee AI (`gitee`)

支持的操作：

- ✅ generate
- ✅ edit
- ✅ text
- ✅ video
- ✅ task-status

特点：

- 完整的功能支持
- 异步视频生成
- 多种图像生成模型

### Hugging Face (`huggingface`)

支持的操作：

- ✅ generate
- ✅ edit
- ✅ text
- ✅ video
- ✅ task-status
- ✅ upscaler

特点：

- 通过 Gradio API 集成
- 支持图片放大
- 多种开源模型

### Model Scope (`modelscope`)

支持的操作：

- ✅ generate
- ✅ edit
- ✅ text

特点：

- 简洁的 API 接口
- 支持主流模型
- 易于扩展

## 工具函数

`utils.ts` 提供了以下通用工具：

- `extractCompleteEventData()`: 从 SSE 流中提取数据
- `getBaseDimensions()`: 根据宽高比获取基础尺寸
- `getDimensions()`: 获取图片尺寸（支持 HD）
- `uploadToGradio()`: 上传图片到 Gradio
- `DEFAULT_SYSTEM_PROMPT_CONTENT`: 默认系统提示词
- `VIDEO_NEGATIVE_PROMPT`: 视频负面提示词

## 最佳实践

1. **错误处理**: 提供清晰的错误信息
2. **类型安全**: 充分利用 TypeScript
3. **代码复用**: 使用 `utils.ts` 中的工具函数
4. **Token 管理**: 使用 `runWithTokenRetry`
5. **文档注释**: 为公共方法添加 JSDoc
6. **测试**: 充分测试所有操作

## 贡献

欢迎贡献新的 Provider！请参考：

- [Provider 插件开发指南](./PROVIDER_PLUGIN_GUIDE.md)
- [快速参考](./QUICK_REFERENCE.md)
- [贡献指南](../CONTRIBUTING.md)

## 许可证

MIT License
