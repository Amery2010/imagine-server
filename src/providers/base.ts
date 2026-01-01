import type { Context } from "hono";

/**
 * Provider 接口定义
 * 所有 Provider 插件必须实现此接口
 */
export interface IProvider {
  /** Provider 名称 */
  readonly name: string;

  /** 支持的 action 类型 */
  readonly supportedActions: string[];

  /**
   * 处理请求
   * @param c Hono Context
   * @param action 操作类型 (generate, edit, text, video, task-status, upscaler)
   * @param params 请求参数
   * @returns 处理结果
   */
  handleRequest(c: Context, action: string, params: any): Promise<any>;

  /**
   * 获取 API Model ID
   * @param model 模型名称
   * @returns API 使用的实际模型 ID
   */
  getApiModelId(model: string): string;

  /**
   * 获取该 Provider 支持的模型配置
   * @returns 模型配置映射
   */
  getModelConfigs(): Record<string, { apiId: string; config: ModelConfig }>;
}

/**
 * 模型配置接口
 */
export interface ModelConfig {
  id: string;
  name: string;
  type: string[];
  steps?: {
    range: [number, number];
    default: number;
  };
  guidance?: {
    range: [number, number];
    default: number;
  };
  enableHD?: boolean;
  async?: boolean;
}

/**
 * Provider 基类
 * 提供通用的辅助方法
 */
export abstract class BaseProvider implements IProvider {
  abstract readonly name: string;
  abstract readonly supportedActions: string[];

  abstract handleRequest(c: Context, action: string, params: any): Promise<any>;
  abstract getModelConfigs(): Record<
    string,
    { apiId: string; config: ModelConfig }
  >;

  getApiModelId(model: string): string {
    const configs = this.getModelConfigs();
    return configs[model]?.apiId || model;
  }

  /**
   * 检查是否支持指定的 action
   */
  protected supportsAction(action: string): boolean {
    return this.supportedActions.includes(action);
  }

  /**
   * 抛出不支持的 action 错误
   */
  protected throwUnsupportedAction(action: string): never {
    throw new Error(
      `Action '${action}' is not supported for ${this.name} provider`
    );
  }
}
