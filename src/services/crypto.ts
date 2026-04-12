/**
 * 加密工具模块
 *
 * 使用 Web Crypto API (AES-GCM) 加密/解密敏感数据。
 * 兼容 Cloudflare Workers、Node.js 18+、Vercel Edge 等标准 Web Crypto 环境。
 *
 * 主要用途：在 KV 中存储 API Token 时加密，避免明文泄露。
 */

/**
 * 从密码字符串派生 AES-GCM 密钥
 *
 * 使用 PBKDF2 迭代 100,000 次，确保密钥强度。
 * salt 固定为应用标识（因为同一应用内派生的密钥需复用）。
 */
async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  // 使用固定 salt（应用级别的派生密钥不需要随机 salt，
  // 因为每次加密使用随机 IV 保证唯一性）
  const salt = encoder.encode("imagine-server-token-encryption-v1");

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * 加密字符串
 *
 * 返回格式: base64(iv:ciphertext) — 12 字节 IV + 密文
 */
export async function encryptToken(
  plaintext: string,
  encryptionKey: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await deriveKey(encryptionKey);

  // 12 字节随机 IV（AES-GCM 标准推荐）
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );

  // 拼接 IV + 密文，然后 base64 编码
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * 解密字符串
 *
 * 输入格式: base64(iv:ciphertext) — 前 12 字节为 IV
 */
export async function decryptToken(
  encrypted: string,
  encryptionKey: string,
): Promise<string> {
  const key = await deriveKey(encryptionKey);

  // base64 解码
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  // 前 12 字节为 IV
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * 获取加密密钥
 *
 * 优先使用 ENCRYPTION_KEY 环境变量，
 * 回退到 API_TOKEN 的第一个值（总比无加密好）。
 * 如果两者都没有，返回 null（不加密）。
 */
export function getEncryptionKey(env: any): string | null {
  if (env.ENCRYPTION_KEY) {
    return env.ENCRYPTION_KEY;
  }
  if (env.API_TOKEN) {
    const firstToken = env.API_TOKEN.split(",")[0].trim();
    if (firstToken.length > 0) return firstToken;
  }
  return null;
}
