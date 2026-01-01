import type { IProvider, ModelConfig } from "./base";
import type { Bindings } from "../types";
import { GiteeProvider } from "./gitee";
import { HuggingFaceProvider } from "./huggingface";
import { ModelScopeProvider } from "./modelscope";
import { hasAvailableToken } from "../api/token-manager";

/**
 * Provider 注册器
 * 管理所有可用的 Provider 插件
 */
class ProviderRegistry {
  private providers: Map<string, IProvider> = new Map();

  /**
   * 注册一个 Provider
   */
  register(provider: IProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * 获取指定的 Provider
   */
  get(name: string): IProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * 检查 Provider 是否存在
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * 获取所有已注册的 Provider 名称
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 获取所有可用的模型配置
   */
  getAllModelConfigs(): ModelConfig[] {
    const result: ModelConfig[] = [];

    for (const provider of this.providers.values()) {
      const configs = provider.getModelConfigs();
      Object.values(configs).forEach((modelData) => {
        result.push(modelData.config);
      });
    }

    return result;
  }

  /**
   * 获取所有可用的模型配置（根据 token 可用性过滤）
   */
  async getAllAvailableModelConfigs(env: Bindings): Promise<ModelConfig[]> {
    const result: ModelConfig[] = [];

    for (const provider of this.providers.values()) {
      // 检查该 provider 是否有可用的 token
      const hasToken = await hasAvailableToken(provider.name as any, env);

      // 如果有可用 token，则添加该 provider 的模型
      if (hasToken) {
        const configs = provider.getModelConfigs();
        Object.values(configs).forEach((modelData) => {
          result.push(modelData.config);
        });
      }
    }

    return result;
  }

  /**
   * 解析 provider:model 格式的模型 ID
   */
  parseModelId(modelId: string): {
    provider: string;
    model: string;
  } {
    const parts = modelId.split("/");
    if (parts.length > 1) {
      return {
        provider: parts[0],
        model: modelId.substring(parts[0].length + 1),
      };
    }
    // 兼容旧格式，默认使用 gitee
    return { provider: "gitee", model: modelId };
  }
}

// 创建全局注册器实例
export const providerRegistry = new ProviderRegistry();

// 注册所有内置的 Provider
providerRegistry.register(new GiteeProvider());
providerRegistry.register(new HuggingFaceProvider());
providerRegistry.register(new ModelScopeProvider());

/**
 * 获取所有可用模型列表（不过滤）
 */
export function getAvailableModels(): ModelConfig[] {
  return providerRegistry.getAllModelConfigs();
}

/**
 * 获取所有可用模型列表（根据 token 可用性过滤）
 */
export async function getAvailableModelsFiltered(
  env: Bindings
): Promise<ModelConfig[]> {
  return providerRegistry.getAllAvailableModelConfigs(env);
}
