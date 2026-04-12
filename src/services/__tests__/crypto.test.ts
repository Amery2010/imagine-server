import { describe, it, expect } from "vitest";
import {
  encryptToken,
  decryptToken,
  getEncryptionKey,
} from "../crypto";

/**
 * AES-GCM 加密模块测试
 *
 * 验证 crypto.ts 的加解密正确性、密钥派生逻辑、以及边界场景。
 */
describe("Crypto Module", () => {
  const TEST_KEY = "test-encryption-key-for-unit-tests";

  describe("encrypt / decrypt roundtrip", () => {
    it("should decrypt back to original plaintext", async () => {
      const plaintext = "hf_abc123_secret_token";
      const encrypted = await encryptToken(plaintext, TEST_KEY);
      const decrypted = await decryptToken(encrypted, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle empty string", async () => {
      const encrypted = await encryptToken("", TEST_KEY);
      const decrypted = await decryptToken(encrypted, TEST_KEY);
      expect(decrypted).toBe("");
    });

    it("should handle long strings", async () => {
      const longToken = "x".repeat(10000);
      const encrypted = await encryptToken(longToken, TEST_KEY);
      const decrypted = await decryptToken(encrypted, TEST_KEY);
      expect(decrypted).toBe(longToken);
    });

    it("should handle unicode characters", async () => {
      const unicodeToken = "令牌-🔑-Schlüssel";
      const encrypted = await encryptToken(unicodeToken, TEST_KEY);
      const decrypted = await decryptToken(encrypted, TEST_KEY);
      expect(decrypted).toBe(unicodeToken);
    });
  });

  describe("random IV", () => {
    it("should produce different ciphertext for same plaintext", async () => {
      const plaintext = "same-token-value";
      const encrypted1 = await encryptToken(plaintext, TEST_KEY);
      const encrypted2 = await encryptToken(plaintext, TEST_KEY);
      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to the same value
      expect(await decryptToken(encrypted1, TEST_KEY)).toBe(plaintext);
      expect(await decryptToken(encrypted2, TEST_KEY)).toBe(plaintext);
    });
  });

  describe("key mismatch", () => {
    it("should fail to decrypt with wrong key", async () => {
      const encrypted = await encryptToken("secret", TEST_KEY);
      await expect(
        decryptToken(encrypted, "wrong-key"),
      ).rejects.toThrow();
    });
  });

  describe("corrupted data", () => {
    it("should fail on invalid base64 input", async () => {
      await expect(
        decryptToken("not-valid-base64!!!", TEST_KEY),
      ).rejects.toThrow();
    });

    it("should fail on truncated ciphertext", async () => {
      const encrypted = await encryptToken("test", TEST_KEY);
      // Truncate to just 5 characters — too short to contain IV + ciphertext
      const truncated = encrypted.slice(0, 5);
      await expect(
        decryptToken(truncated, TEST_KEY),
      ).rejects.toThrow();
    });
  });

  describe("getEncryptionKey", () => {
    it("should prefer ENCRYPTION_KEY over API_TOKEN", () => {
      const key = getEncryptionKey({
        ENCRYPTION_KEY: "explicit-key",
        API_TOKEN: "api-token",
      });
      expect(key).toBe("explicit-key");
    });

    it("should fallback to first API_TOKEN value", () => {
      const key = getEncryptionKey({
        API_TOKEN: "token-a, token-b",
      });
      expect(key).toBe("token-a");
    });

    it("should return null when no keys configured", () => {
      const key = getEncryptionKey({});
      expect(key).toBeNull();
    });

    it("should return null for empty API_TOKEN", () => {
      const key = getEncryptionKey({ API_TOKEN: "" });
      expect(key).toBeNull();
    });

    it("should return null for whitespace-only API_TOKEN", () => {
      const key = getEncryptionKey({ API_TOKEN: "   " });
      expect(key).toBeNull();
    });
  });
});
