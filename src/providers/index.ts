/**
 * Provider 插件系统
 *
 * 这个模块提供了一个可扩展的 Provider 插件架构，允许轻松添加新的 AI 服务提供商。
 *
 * ## 如何添加新的 Provider
 *
 * 1. 在 `src/providers/` 创建新的 Provider 文件（如 `myprovider.ts`）
 * 2. 实现必需的方法：
 *    - `name`: Provider 名称
 *    - `supportedActions`: 支持的操作类型
 *    - `handleRequest`: 处理请求的主方法
 *    - `getModelConfigs`: 返回模型配置
 * 3. 在 `registry.ts` 中注册你的 Provider
 *
 * ## 文档
 *
 * - [Provider 架构说明](../../docs/PROVIDER_ARCHITECTURE.md)
 * - [Provider 开发指南](../../docs/PROVIDER_PLUGIN_GUIDE.md)
 * - [快速参考](../../docs/QUICK_REFERENCE.md)
 *
 * ## 示例
 *
 * ```typescript
 * import { BaseProvider, type ModelConfig } from "./base";
 *
 * export class MyProvider extends BaseProvider {
 *   readonly name = "myprovider";
 *   readonly supportedActions = ["generate", "text"];
 *
 *   getModelConfigs() {
 *     return {
 *       "my-model": {
 *         apiId: "my-api-model-id",
 *         config: {
 *           id: "myprovider/my-model",
 *           name: "My Model",
 *           type: ["text2image"],
 *         },
 *       },
 *     };
 *   }
 *
 *   async handleRequest(c, action, params) {
 *     // 实现你的逻辑
 *   }
 * }
 *
 * // 在 registry.ts 中注册
 * providerRegistry.register(new MyProvider());
 * ```
 */

export * from "./base";
export * from "./registry";
export * from "./utils";

// 导出具体的 Provider 类，方便测试和扩展
export { GiteeProvider } from "./gitee";
export { HuggingFaceProvider } from "./huggingface";
export { ModelScopeProvider } from "./modelscope";

// 导出模型列表相关函数
export { getAvailableModels, getAvailableModelsFiltered } from "./registry";
