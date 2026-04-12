import type { Storage } from "unstorage";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number; // 连续失败次数阈值
  resetTimeout?: number; // 熔断后尝试恢复的时间（毫秒）
}

/**
 * Provider 熔断器
 *
 * 实现了基于分布式存储（如 Redis/KV）的熔断器逻辑。
 * 状态机：
 * - CLOSED: 初始状态，允许所有请求。如果失败次数达到阈值，进入 OPEN。
 * - OPEN: 熔断状态，拒绝所有请求。经过 resetTimeout 后，进入 HALF_OPEN。
 * - HALF_OPEN: 半开状态，允许试探性请求。如果成功，回到 CLOSED；如果失败，回到 OPEN。
 */
export class CircuitBreaker {
  private storage: Storage;
  private providerName: string;
  private failureThreshold: number;
  private resetTimeout: number;

  constructor(
    storage: Storage,
    providerName: string,
    options?: CircuitBreakerOptions,
  ) {
    this.storage = storage;
    this.providerName = providerName;
    this.failureThreshold = options?.failureThreshold || 5;
    this.resetTimeout = options?.resetTimeout || 60_000; // 默认 60 秒
  }

  private getKey(key: string) {
    return `cb:${this.providerName}:${key}`;
  }

  /**
   * 检查当前是否允许请求
   *
   * @throws 如果当前处于 OPEN 状态，抛出熔断异常
   */
  async check(): Promise<void> {
    const state = (await this.storage.getItem(this.getKey("state"))) as
      | CircuitState
      | null;

    if (state === "OPEN") {
      const openedAt = (await this.storage.getItem(this.getKey("openedAt"))) as
        | number
        | null;
      if (openedAt && Date.now() - openedAt > this.resetTimeout) {
        // 重置时间已过，进入 HALF_OPEN
        await this.storage.setItem(this.getKey("state"), "HALF_OPEN");
        return; // 允许本次试探请求
      }
      throw new Error(`Circuit breaker is OPEN for provider: ${this.providerName}`);
    }

    // HALF_OPEN 或 CLOSED 都允许执行
  }

  /**
   * 记录一次成功调用
   */
  async recordSuccess(): Promise<void> {
    const state = (await this.storage.getItem(this.getKey("state"))) as
      | CircuitState
      | null;

    // 清空失败计数
    await this.storage.removeItem(this.getKey("failures"));

    if (state === "HALF_OPEN" || state === "OPEN") {
      // 从半开或开启状态恢复到关闭状态
      await this.storage.setItem(this.getKey("state"), "CLOSED");
      await this.storage.removeItem(this.getKey("openedAt"));
      console.log(`[CircuitBreaker] ${this.providerName} recovered and CLOSED.`);
    }
  }

  /**
   * 记录一次调用失败
   */
  async recordFailure(): Promise<void> {
    const state = (await this.storage.getItem(this.getKey("state"))) as
      | CircuitState
      | null;

    if (state === "HALF_OPEN") {
      // 试探失败，立即重新开启熔断
      await this.tripBreaker();
      return;
    }

    if (state === "OPEN") {
      return; // 已经熔断
    }

    // CLOSED 状态，增加失败计数
    const failuresKey = this.getKey("failures");
    const currentFailures = ((await this.storage.getItem(failuresKey)) as number) || 0;
    const newFailures = currentFailures + 1;

    await this.storage.setItem(failuresKey, newFailures);

    if (newFailures >= this.failureThreshold) {
      await this.tripBreaker();
    }
  }

  private async tripBreaker(): Promise<void> {
    await this.storage.setItem(this.getKey("state"), "OPEN");
    await this.storage.setItem(this.getKey("openedAt"), Date.now());
    console.warn(`[CircuitBreaker] ${this.providerName} tripped and OPENED.`);
  }

  /**
   * 获取当前熔断器状态
   */
  async getState(): Promise<{ state: CircuitState; failures: number }> {
    const state =
      ((await this.storage.getItem(this.getKey("state"))) as CircuitState) ||
      "CLOSED";
    const failures =
      ((await this.storage.getItem(this.getKey("failures"))) as number) || 0;
    return { state, failures };
  }
}

/**
 * 包装函数执行，自动处理熔断逻辑
 */
export async function withCircuitBreaker<T>(
  storage: Storage | null | undefined,
  providerName: string,
  fn: () => Promise<T>,
  options?: CircuitBreakerOptions,
): Promise<T> {
  // 如果没有存储实例（测试环境或未初始化），直接执行
  if (!storage) {
    return await fn();
  }

  const cb = new CircuitBreaker(storage, providerName, options);

  // 1. 检查是否熔断
  await cb.check();

  try {
    // 2. 执行逻辑
    const result = await fn();
    // 3. 记录成功
    await cb.recordSuccess();
    return result;
  } catch (error: any) {
    // 4. 记录失败 (只记录部分错误，比如超时或 5xx 服务器错误)
    // 根据需求，可以忽略 400 Client Error
    const isClientError = error.message && error.message.includes("400");
    if (!isClientError) {
      await cb.recordFailure();
    }
    throw error;
  }
}
