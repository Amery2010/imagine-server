# Provider 插件快速参考

## 目录

- [创建新 Provider](#创建新-provider)
- [注册 Provider](#注册-provider)
- [支持的操作类型](#支持的操作类型)
- [模型配置](#模型配置)
- [常用工具函数](#常用工具函数)
- [Token 管理](#token-管理)
- [错误处理](#错误处理)
- [异步任务](#异步任务)

## 创建新 Provider

### 最小实现

```typescript
import { BaseProvider, type ModelConfig } from "./base";

export class MyProvider extends BaseProvider {
  readonly name = "myprovider";
  readonly supportedActions = ["generate"];

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
    if (!this.supportsAction(action)) {
      this.throwUnsupportedAction(action);
    }
    // 实现逻辑
  }
}
```

## 注册 Provider

在 `src/api/providers/registry.ts`:

```typescript
import { MyProvider } from "./myprovider";
providerRegistry.register(new MyProvider());
```

## 支持的操作类型

| 操作          | 说明         | 返回值                                          |
| ------------- | ------------ | ----------------------------------------------- |
| `generate`    | 文本生成图片 | `{ url, width, height, seed, steps, guidance }` |
| `edit`        | 图片编辑     | `{ url, seed, steps, guidance }`                |
| `text`        | 文本处理     | `{ text }`                                      |
| `video`       | 图片生成视频 | `{ taskId, predict }`                           |
| `task-status` | 查询任务状态 | `{ status, url?, error? }`                      |
| `upscaler`    | 图片放大     | `{ url }`                                       |

## 模型配置

### 完整配置示例

```typescript
{
  "model-key": {
    apiId: "actual-api-id",
    config: {
      id: "provider/model-key",        // 必需
      name: "Display Name",             // 必需
      type: ["text2image"],             // 必需
      steps: {                          // 可选
        range: [1, 20],
        default: 10
      },
      guidance: {                       // 可选
        range: [1, 10],
        default: 3.5
      },
      enableHD: true,                   // 可选
      async: false                      // 可选
    }
  }
}
```

### 模型类型

- `text2image`: 文本生成图片
- `image2image`: 图片编辑
- `text2text`: 文本处理
- `image2video`: 图片生成视频
- `upscaler`: 图片放大

## 常用工具函数

### 导入

```typescript
import {
  getDimensions,
  extractCompleteEventData,
  uploadToGradio,
  DEFAULT_SYSTEM_PROMPT_CONTENT,
  FIXED_SYSTEM_PROMPT_SUFFIX,
  VIDEO_NEGATIVE_PROMPT,
} from "./utils";
```

### getDimensions

```typescript
const { width, height } = getDimensions(
  "16:9", // 宽高比
  true, // 是否 HD
  "model" // 模型名称（可选）
);
```

支持的宽高比：

- `1:1` (1024x1024)
- `16:9` (1024x576)
- `9:16` (576x1024)
- `4:3` (1024x768)
- `3:4` (768x1024)
- `3:2` (960x640)
- `2:3` (640x960)

### extractCompleteEventData

```typescript
const response = await fetch(url);
const text = await response.text();
const data = extractCompleteEventData(text);
```

### uploadToGradio

```typescript
const path = await uploadToGradio(
  "https://api.example.com", // baseUrl
  imageBlob, // Blob
  token // token (可选)
);
```

## Token 管理

### 使用 runWithTokenRetry

```typescript
import { runWithTokenRetry } from "../token-manager";

return await runWithTokenRetry("provider-name", env, async (token) => {
  const response = await fetch(API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Request failed");
  }

  return await response.json();
});
```

### 配置环境变量

在 `.env`:

```
MYPROVIDER_TOKENS=token1,token2,token3
```

在 `src/types.d.ts`:

```typescript
export type Bindings = {
  MYPROVIDER_TOKENS?: string;
};
```

## 错误处理

### 标准错误处理

```typescript
if (!response.ok) {
  const errData = await response.json().catch(() => ({}));
  throw new Error(errData.message || `API Error: ${response.status}`);
}
```

### 验证参数

```typescript
if (!image || !Array.isArray(image) || image.length === 0) {
  throw new Error("image parameter is required and must be an array");
}
```

### 不支持的操作

```typescript
if (!this.supportsAction(action)) {
  this.throwUnsupportedAction(action);
}
```

## 异步任务

### 创建任务

```typescript
const taskId = "task-" + Date.now();

await env.VIDEO_TASK_KV.put(
  taskId,
  JSON.stringify({
    status: "processing",
    id: taskId,
    provider: this.name,
    token,
    createdAt: new Date().toISOString(),
  }),
  { expirationTtl: 86400 } // 24 小时
);

return { taskId, predict: 60 };
```

### 更新任务状态（成功）

```typescript
await env.VIDEO_TASK_KV.put(
  taskId,
  JSON.stringify({
    status: "success",
    url: videoUrl,
    id: taskId,
    provider: this.name,
    completedAt: new Date().toISOString(),
  })
);

return { status: "success", url: videoUrl };
```

### 更新任务状态（失败）

```typescript
await env.VIDEO_TASK_KV.put(
  taskId,
  JSON.stringify({
    status: "failed",
    id: taskId,
    provider: this.name,
    error: "Error message",
    failedAt: new Date().toISOString(),
  })
);

return { status: "failed", error: "Error message" };
```

## 请求参数

### generate 操作

```typescript
{
  model: string;      // 模型名称
  prompt: string;     // 提示词
  ar?: string;        // 宽高比 (默认 "1:1")
  seed?: number;      // 随机种子
  steps?: number;     // 步数
  guidance?: number;  // 引导系数
}
```

### edit 操作

```typescript
{
  model: string;      // 模型名称
  image: Blob[];      // 图片数组
  prompt: string;     // 提示词
  seed?: number;      // 随机种子
  steps?: number;     // 步数
  guidance?: number;  // 引导系数
}
```

### text 操作

```typescript
{
  model: string; // 模型名称
  prompt: string; // 提示词
}
```

### video 操作

```typescript
{
  model: string;      // 模型名称
  imageUrl: string;   // 图片 URL
  prompt?: string;    // 提示词
  duration?: number;  // 时长（秒）
  steps?: number;     // 步数
  guidance?: number;  // 引导系数
}
```

## 响应格式

### generate 响应

```typescript
{
  url: string;        // 图片 URL
  width: number;      // 宽度
  height: number;     // 高度
  seed: number;       // 随机种子
  steps: number;      // 步数
  guidance?: number;  // 引导系数
}
```

### edit 响应

```typescript
{
  url: string; // 图片 URL
  seed: number; // 随机种子
  steps: number; // 步数
  guidance: number; // 引导系数
}
```

### text 响应

```typescript
{
  text: string; // 处理后的文本
}
```

### video 响应

```typescript
{
  taskId: string; // 任务 ID
  predict: number; // 预计完成时间（秒）
}
```

### task-status 响应

```typescript
// 处理中
{
  status: "processing"
}

// 成功
{
  status: "success",
  url: string
}

// 失败
{
  status: "failed",
  error: string
}
```

## 测试

### 本地测试

```bash
# 启动开发服务器
pnpm run dev

# 测试 generate
curl -X POST http://localhost:8787/api/imagine/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "myprovider/my-model",
    "prompt": "a beautiful sunset"
  }'
```

### 单元测试示例

```typescript
import { MyProvider } from "./myprovider";

describe("MyProvider", () => {
  const provider = new MyProvider();

  test("should have correct name", () => {
    expect(provider.name).toBe("myprovider");
  });

  test("should support generate action", () => {
    expect(provider.supportedActions).toContain("generate");
  });

  test("should return model configs", () => {
    const configs = provider.getModelConfigs();
    expect(configs["my-model"]).toBeDefined();
  });
});
```

## 常见问题

### Q: 如何添加新模型？

在 `getModelConfigs()` 中添加：

```typescript
getModelConfigs() {
  return {
    "existing-model": { ... },
    "new-model": {
      apiId: "new-api-id",
      config: {
        id: "provider/new-model",
        name: "New Model",
        type: ["text2image"],
      },
    },
  };
}
```

### Q: 如何处理多个图片？

```typescript
const imagePayloadPromises = image.map(async (blob) => {
  if (typeof blob === "string") {
    return blob;
  } else {
    return await uploadToGradio(baseUrl, blob, token);
  }
});

const imagePayload = await Promise.all(imagePayloadPromises);
```

### Q: 如何生成随机种子？

```typescript
const seed = Math.floor(Math.random() * 2147483647);
```

### Q: 如何使用系统提示词？

```typescript
import {
  DEFAULT_SYSTEM_PROMPT_CONTENT,
  FIXED_SYSTEM_PROMPT_SUFFIX,
} from "./utils";

const systemInstruction =
  DEFAULT_SYSTEM_PROMPT_CONTENT + FIXED_SYSTEM_PROMPT_SUFFIX;
```

## 相关文档

- [Provider 插件开发指南](./PROVIDER_PLUGIN_GUIDE.md) - 详细的开发指南
- [Provider 系统说明](../src/api/providers/README.md) - 系统概述
- [贡献指南](../CONTRIBUTING.md) - 如何贡献代码

## 获取帮助

- 查看现有 Provider 的实现作为参考
- 使用 `template.ts.example` 作为起点
- 在 GitHub Issues 中提问
- 阅读详细文档

---

**提示**: 这是一个快速参考，详细信息请查看完整文档。
