import type { Context } from "hono";
import type { Storage } from "unstorage";
import type { Bindings } from "../types";
import {
  encryptToken,
  decryptToken,
  getEncryptionKey,
} from "../services/crypto";
import { withCircuitBreaker } from "../utils/circuit-breaker";

export type Provider =
  | "huggingface"
  | "gitee"
  | "modelscope"
  | "a4f"
  | "gemini"
  | "grok"
  | "openai"
  | "modelslab";

// 运行时校验用的有效 Provider 列表
const VALID_PROVIDERS: readonly string[] = [
  "huggingface",
  "gitee",
  "modelscope",
  "a4f",
  "gemini",
  "grok",
  "openai",
  "modelslab",
] as const;

// Token 状态存储结构
interface TokenStatusStore {
  date: string; // YYYY-MM-DD
  exhausted: Record<string, boolean>; // token -> exhausted
}

// KV 键名前缀
const KV_KEY_PREFIX = "token_status_";

// 获取 UTC 日期字符串（用于 Hugging Face）
function getUTCDateString(): string {
  // 使用 en-CA 或 sv-SE 可获取 YYYY-MM-DD 格式
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(
    new Date(),
  );
}

// 获取北京时间日期字符串（用于 Gitee 和 Model Scope）
function getBeijingDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
    new Date(),
  );
}

// 获取 KV 键名
function getKVKey(provider: Provider): string {
  return `${KV_KEY_PREFIX}${provider}`;
}

// 从存储获取 Token 状态
async function getTokenStatusStore(
  provider: Provider,
  storage: Storage,
): Promise<TokenStatusStore> {
  const currentDate =
    provider === "huggingface" ? getUTCDateString() : getBeijingDateString();

  const defaultStore: TokenStatusStore = {
    date: currentDate,
    exhausted: {},
  };

  try {
    const key = getKVKey(provider);
    const stored = await storage.getItem<TokenStatusStore>(key);

    if (!stored) {
      return defaultStore;
    }

    // 如果日期不匹配，说明是新的一天，返回默认值
    if (stored.date !== currentDate) {
      // 清理旧数据
      await storage.removeItem(key);
      return defaultStore;
    }

    return stored;
  } catch (error) {
    console.error(
      `[TokenManager] Error reading storage for ${provider}:`,
      error,
    );
    return defaultStore;
  }
}

// 保存 Token 状态到存储
async function saveTokenStatusStore(
  provider: Provider,
  store: TokenStatusStore,
  storage: Storage,
): Promise<void> {
  try {
    const key = getKVKey(provider);
    // 设置 24 小时过期，自动清理
    await storage.setItem(key, store, {
      ttl: 86400, // 24 hours in seconds
    });
  } catch (error) {
    console.error(
      `[TokenManager] Error writing storage for ${provider}:`,
      error,
    );
  }
}

/**
 * 从环境变量获取 Token 列表
 */
export function getTokens(provider: Provider, env: Bindings): string[] {
  let tokensString: string | undefined;

  switch (provider) {
    case "huggingface":
      tokensString = env.HUGGINGFACE_TOKENS;
      break;
    case "gitee":
      tokensString = env.GITEE_TOKENS;
      break;
    case "modelscope":
      tokensString = env.MODELSCOPE_TOKENS;
      break;
    case "a4f":
      tokensString = env.A4F_TOKENS;
      break;
    case "gemini":
      tokensString = env.GEMINI_TOKENS;
      break;
    case "grok":
      tokensString = env.GROK_TOKENS;
      break;
    case "openai":
      tokensString = env.OPENAI_TOKENS;
      break;
    case "modelslab":
      tokensString = env.MODELSLAB_TOKENS;
      break;
  }

  if (!tokensString) return [];

  return tokensString
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * 获取下一个可用的 Token（随机选择）
 */
async function getNextAvailableToken(
  provider: Provider,
  env: Bindings,
): Promise<string | null> {
  const tokens = getTokens(provider, env);

  if (!env.storage) {
    console.warn(
      "[TokenManager] Storage not available, returning random token",
    );
    if (tokens.length === 0) return null;
    // 随机返回一个 token
    return tokens[Math.floor(Math.random() * tokens.length)];
  }

  const store = await getTokenStatusStore(provider, env.storage);

  // 获取所有未被标记为耗尽的 Token
  const availableTokens = tokens.filter((t) => !store.exhausted[t]);

  if (availableTokens.length === 0) return null;

  // 从可用 tokens 中随机选择一个
  return availableTokens[Math.floor(Math.random() * availableTokens.length)];
}

/**
 * 标记 Token 为已耗尽
 */
export async function markTokenExhausted(
  provider: Provider,
  token: string,
  env: Bindings,
): Promise<void> {
  if (!env.storage) {
    console.warn(
      "[TokenManager] Storage not available, cannot mark token as exhausted",
    );
    return;
  }

  // 检查是否已被标记
  const initialStore = await getTokenStatusStore(provider, env.storage);
  if (initialStore.exhausted[token]) {
    return;
  }

  // 获取最新的 store 状态进行合并，减小并发写入覆盖（Race Condition）的窗口
  const latestStore = await getTokenStatusStore(provider, env.storage);

  if (latestStore.date === initialStore.date) {
    latestStore.exhausted[token] = true;
    await saveTokenStatusStore(provider, latestStore, env.storage);
  } else {
    // 跨天情况
    initialStore.exhausted[token] = true;
    await saveTokenStatusStore(provider, initialStore, env.storage);
  }

  console.log(
    `[TokenManager] Token exhausted for ${provider}: ${token.substring(
      0,
      8,
    )}...`,
  );
}

/**
 * 获取 Token 统计信息
 */
export async function getTokenStats(provider: Provider, env: Bindings) {
  const tokens = getTokens(provider, env);
  const total = tokens.length;

  if (!env.storage) {
    return {
      total,
      exhausted: 0,
      active: total,
    };
  }

  const store = await getTokenStatusStore(provider, env.storage);
  const exhausted = tokens.filter((t) => store.exhausted[t]).length;

  return {
    total,
    exhausted,
    active: total - exhausted,
  };
}

/**
 * 使用 Token 重试机制执行操作
 *
 * 当一个 Token 配额耗尽时，自动切换到下一个可用 Token
 */
export async function runWithTokenRetry<T>(
  provider: Provider,
  env: Bindings,
  operation: (token: string | null) => Promise<T>,
): Promise<T> {
  const tokens = getTokens(provider, env);

  // 如果没有配置 Token，尝试使用 null（某些服务支持公共配额）
  if (tokens.length === 0) {
    if (provider === "huggingface") {
      // Hugging Face 支持无 Token 访问（公共配额）
      return operation(null);
    } else {
      throw new Error(`error_${provider}_token_required`);
    }
  }

  let lastError: any;
  let attempts = 0;
  const maxAttempts = tokens.length + 1;

  while (attempts < maxAttempts) {
    attempts++;
    const token = await getNextAvailableToken(provider, env);

    // 如果所有 Token 都已耗尽
    if (!token) {
      throw new Error(`error_${provider}_token_exhausted`);
    }

    try {
      return await withCircuitBreaker(
        env.storage,
        provider,
        async () => {
          return await operation(token);
        },
        // 对大模型服务，设置 5 次连续非客户端错误失败为熔断阈值，60秒后半开尝试
        { failureThreshold: 5, resetTimeout: 60_000 }
      );
    } catch (error: any) {
      lastError = error;

      // 如果是用户中止请求，直接抛出
      if (error.name === "AbortError") {
        throw error;
      }

      // 如果是熔断器触发，直接抛出，无需重试其他 token，因为是整个 provider 不可用
      if (error.message?.includes("Circuit breaker is OPEN")) {
        console.warn(`[TokenManager] Fast-failing due to circuit breaker trip for ${provider}`);
        throw error;
      }

      // 检查是否是配额错误
      const isQuotaError =
        error.message?.includes("429") ||
        error.status === 429 ||
        error.message?.includes("quota") ||
        error.message?.includes("credit") ||
        error.message?.includes("Arrearage") ||
        error.message?.includes("Bill") ||
        error.message?.includes("exhausted");

      if (isQuotaError && token) {
        console.warn(
          `[TokenManager] ${provider} Token ${token.substring(
            0,
            8,
          )}... exhausted. Switching to next token.`,
        );
        await markTokenExhausted(provider, token, env);
        continue; // 重试下一个 Token
      }

      // 如果不是配额错误，直接抛出
      throw error;
    }
  }

  // 所有重试都失败了
  throw lastError || new Error("error_api_connection");
}

/**
 * 重置指定 provider 的所有 Token 状态（用于测试或手动重置）
 */
export async function resetTokenStatus(
  provider: Provider,
  env: Bindings,
): Promise<void> {
  if (!env.storage) {
    console.warn(
      "[TokenManager] Storage not available, cannot reset token status",
    );
    return;
  }

  const currentDate =
    provider === "huggingface" ? getUTCDateString() : getBeijingDateString();

  const store: TokenStatusStore = {
    date: currentDate,
    exhausted: {},
  };

  await saveTokenStatusStore(provider, store, env.storage);
  console.log(`[TokenManager] Reset token status for ${provider}`);
}

/**
 * 检查指定 provider 是否有可用的 token
 */
export async function hasAvailableToken(
  provider: Provider,
  env: Bindings,
): Promise<boolean> {
  const tokens = getTokens(provider, env);

  // 如果没有配置 token
  if (tokens.length === 0) {
    // Hugging Face 支持无 token 访问
    return provider === "huggingface";
  }

  // 如果没有存储，假设所有 token 都可用
  if (!env.storage) {
    return true;
  }

  const store = await getTokenStatusStore(provider, env.storage);

  // 检查是否至少有一个未耗尽的 token
  return tokens.some((t) => !store.exhausted[t]);
}

/**
 * 获取所有 Provider 的 Token 状态概览
 */
export async function getAllTokenStats(env: Bindings) {
  const providers: Provider[] = [
    "huggingface",
    "gitee",
    "modelscope",
    "a4f",
    "gemini",
    "grok",
    "openai",
    "modelslab",
  ];
  const stats: Record<string, any> = {};

  for (const provider of providers) {
    stats[provider] = await getTokenStats(provider, env);
  }

  return stats;
}

export async function getTokenStatsHandler(c: Context) {
  const provider = (c.req.query("provider") || "gitee") as Provider;
  const stats = await getTokenStats(provider, c.env);
  return c.json(stats);
}

export async function getAllTokenStatsHandler(c: Context) {
  const stats = await getAllTokenStats(c.env);
  return c.json(stats);
}

export async function resetTokenStatusHandler(c: Context) {
  const body = await c.req.json();
  const { provider } = body;

  if (!provider) {
    return c.json({ error: "Provider is required" }, 400);
  }

  if (!VALID_PROVIDERS.includes(provider)) {
    return c.json(
      {
        error: "Invalid provider",
        message: `Valid providers: ${VALID_PROVIDERS.join(", ")}`,
      },
      400,
    );
  }

  await resetTokenStatus(provider as Provider, c.env);

  return c.json({
    success: true,
    message: `Token status reset for ${provider}`,
  });
}

/**
 * 加密 Token 用于 KV 存储
 *
 * 如果配置了加密密钥，使用 AES-GCM 加密；否则原样返回。
 */
export async function encryptTokenForStorage(
  token: string,
  env: Bindings,
): Promise<string> {
  const key = getEncryptionKey(env);
  if (!key) return token;

  try {
    return await encryptToken(token, key);
  } catch (e) {
    console.warn("[TokenManager] Encryption failed, storing as-is:", e);
    return token;
  }
}

/**
 * 从 KV 中解密 Token
 *
 * 如果配置了加密密钥，尝试 AES-GCM 解密；解密失败时回退到原始值
 * （兼容加密前已存储的旧数据）。
 */
export async function decryptTokenFromStorage(
  encryptedToken: string,
  env: Bindings,
): Promise<string> {
  const key = getEncryptionKey(env);
  if (!key) return encryptedToken;

  try {
    return await decryptToken(encryptedToken, key);
  } catch {
    // 可能是未加密的旧数据，直接返回
    return encryptedToken;
  }
}
