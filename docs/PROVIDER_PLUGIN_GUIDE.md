# Provider 插件开发指南

本指南将帮助你为项目添加新的 AI 服务提供商（Provider）。

## 架构概览

项目采用插件化架构，每个 Provider 都是一个独立的模块：

```
src/api/providers/
├── base.ts           # Provider 接口和基类
├── utils.ts          # 通用工具函数
├── registry.ts       # Provider 注册器
├── index.ts          # 导出文件
├── gitee.ts          # Gitee AI Provider
├── huggingface.ts    # Hugging Face Provider
└── modelscope.ts     # Model Scope Provider
```

## 快速开始

### 1. 创建新的 Provider 文件

在 `src/api/providers/` 目录下创建一个新文件，例如 `myprovider.ts`：

```typescript
import type { Context } from "hono";
import { BaseProvider, type ModelConfig } from "./base";
import { runWithTokenRetry } from "../token-manager";

/**
 * My Provider
 */
export class MyProvider extends BaseProvider {
  // Provider 名称（必需）
  readonly name = "myprovider";

  // 支持的操作类型（必需）
  readonly supportedActions = ["generate", "text"];

  // 返回模型配置（必需）
  getModelConfigs(): Record<string, { apiId: string; config: ModelConfig }> {
    return {
      "my-model": {
        apiId: "actual-api-model-id",
        config: {
          id: "myprovider/my-model",
          name: "My Model Name",
          type: ["text2image"],
          steps: { range: [1, 20], default: 10 },
          guidance: { range: [1, 10], default: 3.5 },
        },
      },
    };
  }

  // 处理请求（必需）
  async handleRequest(c: Context, action: string, params: any): Promise<any> {
    if (!this.supportsAction(action)) {
      this.throwUnsupportedAction(action);
    }

    const env = c.env;

    switch (action) {
      case "generate":
        return this.handleGenerate(env, params);
      case "text":
        return this.handleText(env, params);
      default:
        this.throwUnsupportedAction(action);
    }
  }

  // 实现具体的操作
  private async handleGenerate(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("myprovider", env, async (token) => {
      const { model, prompt } = params;
      const modelId = this.getApiModelId(model);

      // 调用你的 API
      const response = await fetch("https://api.myprovider.com/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: modelId,
          prompt,
        }),
      });

      if (!response.ok) {
        throw new Error("Generation failed");
      }

      const data = await response.json();
      return { url: data.image_url };
    });
  }

  private async handleText(env: any, params: any): Promise<any> {
    // 实现文本处理逻辑
  }
}
```

### 2. 注册 Provider

在 `src/api/providers/registry.ts` 中注册你的 Provider：

```typescript
import { MyProvider } from "./myprovider";

// 在文件末尾添加
providerRegistry.register(new MyProvider());
```

### 3. 导出 Provider（可选）

在 `src/api/providers/index.ts` 中导出你的 Provider：

```typescript
export { MyProvider } from "./myprovider";
```

### 4. 配置 Token 管理（如果需要）

如果你的 Provider 需要 API Token，需要在环境变量中配置：

1. 在 `.env.example` 中添加：

   ```
   MYPROVIDER_TOKENS=token1,token2,token3
   ```

2. 在 `src/types.d.ts` 中添加类型定义：
   ```typescript
   export type Bindings = {
     // ... 其他配置
     MYPROVIDER_TOKENS?: string;
   };
   ```

## 支持的操作类型

Provider 可以支持以下操作类型：

- `generate`: 文本生成图片
- `edit`: 图片编辑
- `text`: 文本处理（如 prompt 优化）
- `video`: 图片生成视频
- `task-status`: 查询异步任务状态
- `upscaler`: 图片放大

## 使用通用工具函数

`src/api/providers/utils.ts` 提供了一些通用工具函数：

```typescript
import {
  getDimensions, // 获取图片尺寸
  extractCompleteEventData, // 从 SSE 流提取数据
  uploadToGradio, // 上传图片到 Gradio
  DEFAULT_SYSTEM_PROMPT_CONTENT, // 默认系统提示词
  VIDEO_NEGATIVE_PROMPT, // 视频负面提示词
} from "./utils";
```

## 模型配置说明

每个模型需要提供以下配置：

```typescript
{
  id: "provider/model-name",  // 完整的模型 ID
  name: "Display Name",        // 显示名称
  type: ["text2image"],        // 模型类型数组
  steps?: {                    // 步数配置（可选）
    range: [1, 20],
    default: 10
  },
  guidance?: {                 // 引导系数配置（可选）
    range: [1, 10],
    default: 3.5
  },
  enableHD?: boolean,          // 是否支持 HD（可选）
  async?: boolean              // 是否异步（可选）
}
```

模型类型包括：

- `text2image`: 文本生成图片
- `image2image`: 图片编辑
- `text2text`: 文本处理
- `image2video`: 图片生成视频
- `upscaler`: 图片放大

## Token 管理

使用 `runWithTokenRetry` 函数自动处理 Token 轮换和重试：

```typescript
import { runWithTokenRetry } from "../token-manager";

return await runWithTokenRetry("myprovider", env, async (token) => {
  // 使用 token 调用 API
  const response = await fetch(API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // 返回结果
  return result;
});
```

## 错误处理

Provider 应该抛出有意义的错误信息：

```typescript
if (!response.ok) {
  const errData = await response.json().catch(() => ({}));
  throw new Error(errData.message || `API Error: ${response.status}`);
}
```

## 异步任务处理

对于需要异步处理的任务（如视频生成），使用 KV 存储任务状态：

```typescript
// 创建任务
await env.VIDEO_TASK_KV.put(
  taskId,
  JSON.stringify({
    status: "processing",
    id: taskId,
    provider: "myprovider",
    token,
    createdAt: new Date().toISOString(),
  }),
  { expirationTtl: 86400 } // 24 小时后过期
);

return { taskId, predict: 60 }; // predict 是预计完成时间（秒）
```

```typescript
// 查询任务状态
const response = await fetch(`${API_URL}/task/${taskId}`);
const data = await response.json();

if (data.status === "success") {
  await env.VIDEO_TASK_KV.put(
    taskId,
    JSON.stringify({
      status: "success",
      url: data.url,
      id: taskId,
      provider: "myprovider",
      completedAt: new Date().toISOString(),
    })
  );

  return { status: "success", url: data.url };
}
```

## 测试你的 Provider

1. 启动开发服务器：

   ```bash
   npm run dev
   ```

2. 测试 API 调用：
   ```bash
   curl -X POST http://localhost:8787/api/imagine/generate \
     -H "Content-Type: application/json" \
     -d '{
       "model": "myprovider/my-model",
       "prompt": "a beautiful sunset"
     }'
   ```

## 最佳实践

1. **命名规范**：使用小写字母和连字符，如 `my-provider`
2. **错误处理**：提供清晰的错误信息
3. **文档注释**：为公共方法添加 JSDoc 注释
4. **类型安全**：充分利用 TypeScript 类型系统
5. **代码复用**：使用 `utils.ts` 中的通用函数
6. **Token 管理**：使用 `runWithTokenRetry` 处理 Token
7. **异步任务**：使用 KV 存储管理任务状态

## 示例参考

查看现有的 Provider 实现作为参考：

- **简单实现**：`modelscope.ts` - 只支持基本的 generate、edit、text 操作
- **完整实现**：`gitee.ts` - 支持所有操作类型，包括异步视频生成
- **复杂实现**：`huggingface.ts` - 支持多种 API 端点和 Gradio 集成

### Provider 模板文件

```ts
/**
 * Provider 模板文件
 *
 * 复制此文件并重命名为你的 Provider 名称，例如：myprovider.ts
 * 然后按照注释中的说明实现你的 Provider
 */

import type { Context } from "hono";
import { BaseProvider, type ModelConfig } from "./base";
import { runWithTokenRetry } from "../token-manager";
import {
  getDimensions,
  extractCompleteEventData,
  uploadToGradio,
  DEFAULT_SYSTEM_PROMPT_CONTENT,
  FIXED_SYSTEM_PROMPT_SUFFIX,
  VIDEO_NEGATIVE_PROMPT,
} from "./utils";

// 定义你的 API URLs
const MY_API_BASE_URL = "https://api.example.com";
const MY_GENERATE_API_URL = `${MY_API_BASE_URL}/v1/generate`;
const MY_CHAT_API_URL = `${MY_API_BASE_URL}/v1/chat`;

/**
 * My Provider
 *
 * TODO: 修改类名和描述
 */
export class MyProvider extends BaseProvider {
  // TODO: 修改 Provider 名称（小写，使用连字符）
  readonly name = "myprovider";

  // TODO: 定义支持的操作类型
  // 可选值: "generate", "edit", "text", "video", "task-status", "upscaler"
  readonly supportedActions = ["generate", "text"];

  /**
   * 返回该 Provider 支持的所有模型配置
   *
   * TODO: 添加你的模型配置
   */
  getModelConfigs(): Record<string, { apiId: string; config: ModelConfig }> {
    return {
      // 模型 key（用于 API 调用）
      "my-model": {
        // API 实际使用的模型 ID
        apiId: "actual-api-model-id",
        // 模型配置
        config: {
          // 完整的模型 ID（格式：provider/model）
          id: "myprovider/my-model",
          // 显示名称
          name: "My Model Name",
          // 模型类型（可以有多个）
          // 可选值: "text2image", "image2image", "text2text", "image2video", "upscaler"
          type: ["text2image"],
          // 步数配置（可选）
          steps: {
            range: [1, 20],
            default: 10,
          },
          // 引导系数配置（可选）
          guidance: {
            range: [1, 10],
            default: 3.5,
          },
          // 是否支持 HD（可选）
          enableHD: false,
          // 是否异步（可选）
          async: false,
        },
      },
      // 可以添加更多模型...
    };
  }

  /**
   * 处理请求的主方法
   *
   * @param c Hono Context
   * @param action 操作类型
   * @param params 请求参数
   */
  async handleRequest(c: Context, action: string, params: any): Promise<any> {
    // 检查是否支持该操作
    if (!this.supportsAction(action)) {
      this.throwUnsupportedAction(action);
    }

    const env = c.env;

    // 根据 action 分发到不同的处理方法
    switch (action) {
      case "generate":
        return this.handleGenerate(env, params);
      case "text":
        return this.handleText(env, params);
      // TODO: 添加更多 action 处理
      default:
        this.throwUnsupportedAction(action);
    }
  }

  /**
   * 处理图片生成请求
   *
   * TODO: 实现你的图片生成逻辑
   */
  private async handleGenerate(env: any, params: any): Promise<any> {
    // 使用 runWithTokenRetry 自动处理 Token 轮换和重试
    return await runWithTokenRetry("myprovider", env, async (token) => {
      // 提取参数
      const {
        model,
        prompt,
        ar = "1:1", // 宽高比
        seed,
        steps,
        guidance,
      } = params;

      // 获取 API 使用的实际模型 ID
      const modelId = this.getApiModelId(model);

      // 获取图片尺寸
      const { width, height } = getDimensions(ar, true, modelId);

      // 生成随机种子（如果未提供）
      const finalSeed = seed ?? Math.floor(Math.random() * 2147483647);
      const finalSteps = steps ?? 10;

      // 构建请求体
      const requestBody: any = {
        model: modelId,
        prompt,
        width,
        height,
        seed: finalSeed,
        steps: finalSteps,
      };

      // 添加可选参数
      if (guidance !== undefined) {
        requestBody.guidance = guidance;
      }

      // 调用 API
      const response = await fetch(MY_GENERATE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      // 错误处理
      if (!response.ok) {
        const errData: any = await response.json().catch(() => ({}));
        throw new Error(errData.message || `API Error: ${response.status}`);
      }

      // 解析响应
      const data: any = await response.json();

      // 验证响应数据
      if (!data.image_url) {
        throw new Error("Invalid response from API");
      }

      // 返回结果
      return {
        url: data.image_url,
        width,
        height,
        seed: finalSeed,
        steps: finalSteps,
        guidance,
      };
    });
  }

  /**
   * 处理文本优化请求
   *
   * TODO: 实现你的文本处理逻辑
   */
  private async handleText(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("myprovider", env, async (token) => {
      const { model, prompt } = params;
      const modelId = this.getApiModelId(model);

      // 使用默认的系统提示词
      const systemInstruction =
        DEFAULT_SYSTEM_PROMPT_CONTENT + FIXED_SYSTEM_PROMPT_SUFFIX;

      const response = await fetch(MY_CHAT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error("Text processing failed");
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;

      return { text: content || prompt };
    });
  }

  /**
   * 处理图片编辑请求（可选）
   *
   * TODO: 如果支持图片编辑，实现此方法
   */
  private async handleEdit(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("myprovider", env, async (token) => {
      const {
        model,
        image, // 图片数组
        prompt,
        seed = Math.floor(Math.random() * 2147483647),
        steps = 16,
        guidance = 4,
      } = params;

      // 验证图片参数
      if (!image || !Array.isArray(image) || image.length === 0) {
        throw new Error("image parameter is required and must be an array");
      }

      // TODO: 实现图片编辑逻辑
      // 可能需要上传图片到服务器
      // 可以使用 uploadToGradio 工具函数

      throw new Error("Not implemented");
    });
  }

  /**
   * 处理视频生成请求（可选）
   *
   * TODO: 如果支持视频生成，实现此方法
   */
  private async handleVideo(env: any, params: any): Promise<any> {
    return await runWithTokenRetry("myprovider", env, async (token) => {
      const {
        model,
        imageUrl,
        prompt = "make this image come alive",
        duration = 3,
        steps = 10,
        guidance = 4,
      } = params;

      // TODO: 实现视频生成逻辑
      // 通常是异步任务，需要返回 taskId

      // 示例：创建异步任务
      const taskId = "task-" + Date.now();

      // 保存任务状态到 KV
      await env.VIDEO_TASK_KV.put(
        taskId,
        JSON.stringify({
          status: "processing",
          id: taskId,
          provider: this.name,
          token,
          createdAt: new Date().toISOString(),
        }),
        { expirationTtl: 86400 } // 24 小时后过期
      );

      return {
        taskId,
        predict: 60, // 预计完成时间（秒）
      };
    });
  }

  /**
   * 查询任务状态（可选）
   *
   * TODO: 如果支持异步任务，实现此方法
   */
  private async handleTaskStatus(env: any, params: any): Promise<any> {
    const { taskId, token } = params;

    try {
      // TODO: 查询任务状态
      // 调用你的 API 获取任务状态

      const response = await fetch(`${MY_API_BASE_URL}/task/${taskId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to check task status");
      }

      const data: any = await response.json();

      // 任务成功
      if (data.status === "success") {
        await env.VIDEO_TASK_KV.put(
          taskId,
          JSON.stringify({
            status: "success",
            url: data.url,
            id: taskId,
            provider: this.name,
            completedAt: new Date().toISOString(),
          })
        );

        return { status: "success", url: data.url };
      }

      // 任务失败
      if (data.status === "failed") {
        await env.VIDEO_TASK_KV.put(
          taskId,
          JSON.stringify({
            status: "failed",
            id: taskId,
            provider: this.name,
            error: data.error || "Task failed",
            failedAt: new Date().toISOString(),
          })
        );

        return { status: "failed", error: data.error };
      }

      // 任务仍在处理中
      return { status: "processing" };
    } catch (error: any) {
      return {
        status: "failed",
        error: error.message || "Task status check failed",
      };
    }
  }
}

/**
 * 使用说明：
 *
 * 1. 复制此文件并重命名为你的 Provider 名称
 * 2. 修改类名和 name 属性
 * 3. 更新 supportedActions 数组
 * 4. 实现 getModelConfigs() 方法
 * 5. 实现各个 handler 方法
 * 6. 在 registry.ts 中注册你的 Provider
 * 7. 测试你的实现
 *
 * 注册示例：
 *
 * // 在 src/api/providers/registry.ts
 * import { MyProvider } from "./myprovider";
 * providerRegistry.register(new MyProvider());
 *
 * 环境变量配置（如果需要 Token）：
 *
 * // 在 .env.example
 * MYPROVIDER_TOKENS=token1,token2,token3
 *
 * // 在 src/types.d.ts
 * export type Bindings = {
 *   // ... 其他配置
 *   MYPROVIDER_TOKENS?: string;
 * };
 */
```

## 贡献流程

1. Fork 项目
2. 创建特性分支：`git checkout -b feature/add-myprovider`
3. 实现你的 Provider
4. 添加测试和文档
5. 提交 Pull Request

## 需要帮助？

如果在开发过程中遇到问题，可以：

1. 查看现有 Provider 的实现
2. 阅读 `base.ts` 中的接口定义
3. 在 GitHub Issues 中提问
4. 参考项目的 CONTRIBUTING.md

祝你开发顺利！🚀
