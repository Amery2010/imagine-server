import type { Context } from "hono";
import type { Storage } from "unstorage";
import type { Bindings } from "../types";

export type Provider = "huggingface" | "gitee" | "modelscope";

// Token 状态存储结构
interface TokenStatusStore {
  date: string; // YYYY-MM-DD
  exhausted: Record<string, boolean>; // token -> exhausted
}

// KV 键名前缀
const KV_KEY_PREFIX = "token_status_";

// 获取 UTC 日期字符串（用于 Hugging Face）
function getUTCDateString(): string {
  return new Date().toISOString().split("T")[0];
}

// 获取北京时间日期字符串（用于 Gitee 和 Model Scope）
function getBeijingDateString(): string {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const nd = new Date(utc + 3600000 * 8);
  return nd.toISOString().split("T")[0];
}

// 获取 KV 键名
function getKVKey(provider: Provider): string {
  return `${KV_KEY_PREFIX}${provider}`;
}

// 从存储获取 Token 状态
async function getTokenStatusStore(
  provider: Provider,
  storage: Storage
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
      error
    );
    return defaultStore;
  }
}

// 保存 Token 状态到存储
async function saveTokenStatusStore(
  provider: Provider,
  store: TokenStatusStore,
  storage: Storage
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
      error
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
  }

  if (!tokensString) return [];

  return tokensString
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * 获取下一个可用的 Token
 */
async function getNextAvailableToken(
  provider: Provider,
  env: Bindings
): Promise<string | null> {
  const tokens = getTokens(provider, env);

  if (!env.storage) {
    console.warn("[TokenManager] Storage not available, returning first token");
    return tokens[0] || null;
  }

  const store = await getTokenStatusStore(provider, env.storage);

  // 返回第一个未被标记为耗尽的 Token
  return tokens.find((t) => !store.exhausted[t]) || null;
}

/**
 * 标记 Token 为已耗尽
 */
export async function markTokenExhausted(
  provider: Provider,
  token: string,
  env: Bindings
): Promise<void> {
  if (!env.storage) {
    console.warn(
      "[TokenManager] Storage not available, cannot mark token as exhausted"
    );
    return;
  }

  const store = await getTokenStatusStore(provider, env.storage);
  store.exhausted[token] = true;
  await saveTokenStatusStore(provider, store, env.storage);

  console.log(
    `[TokenManager] Token exhausted for ${provider}: ${token.substring(
      0,
      8
    )}...`
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
  operation: (token: string | null) => Promise<T>
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
      return await operation(token);
    } catch (error: any) {
      lastError = error;

      // 如果是用户中止请求，直接抛出
      if (error.name === "AbortError") {
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
            8
          )}... exhausted. Switching to next token.`
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
  env: Bindings
): Promise<void> {
  if (!env.storage) {
    console.warn(
      "[TokenManager] Storage not available, cannot reset token status"
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
 * 获取所有 Provider 的 Token 状态概览
 */
export async function getAllTokenStats(env: Bindings) {
  const providers: Provider[] = ["huggingface", "gitee", "modelscope"];
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

  await resetTokenStatus(provider as Provider, c.env);

  return c.json({
    success: true,
    message: `Token status reset for ${provider}`,
  });
}
