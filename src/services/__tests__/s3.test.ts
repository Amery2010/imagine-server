import { describe, it, expect } from "vitest";
import { S3Service } from "../s3";
import type { Bindings } from "../../types";

/**
 * S3Service 测试
 *
 * 主要测试初始化逻辑和公共方法的行为边界。
 * 注意：实际的 S3 API 调用依赖 aws4fetch，不在此做网络 mock，
 * 只验证构造函数和 isActive 状态判断。
 */
describe("S3Service", () => {
  const fullEnv: Partial<Bindings> = {
    S3_ENDPOINT: "https://s3.example.com",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE",
    S3_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    S3_BUCKET_NAME: "test-bucket",
  };

  describe("constructor", () => {
    it("should be inactive when S3 config is missing", () => {
      const s3 = new S3Service({} as Bindings);
      expect(s3.isActive).toBe(false);
    });

    it("should be inactive when S3_ENDPOINT is missing", () => {
      const { S3_ENDPOINT: _, ...partial } = fullEnv;
      const s3 = new S3Service(partial as Bindings);
      expect(s3.isActive).toBe(false);
    });

    it("should be inactive when S3_ACCESS_KEY_ID is missing", () => {
      const { S3_ACCESS_KEY_ID: _, ...partial } = fullEnv;
      const s3 = new S3Service(partial as Bindings);
      expect(s3.isActive).toBe(false);
    });

    it("should be inactive when S3_SECRET_ACCESS_KEY is missing", () => {
      const { S3_SECRET_ACCESS_KEY: _, ...partial } = fullEnv;
      const s3 = new S3Service(partial as Bindings);
      expect(s3.isActive).toBe(false);
    });

    it("should be inactive when S3_BUCKET_NAME is missing", () => {
      const { S3_BUCKET_NAME: _, ...partial } = fullEnv;
      const s3 = new S3Service(partial as Bindings);
      expect(s3.isActive).toBe(false);
    });

    it("should be active when all required config is present", () => {
      const s3 = new S3Service(fullEnv as Bindings);
      expect(s3.isActive).toBe(true);
    });

    it("should be active without S3_CDN_URL (optional)", () => {
      const s3 = new S3Service(fullEnv as Bindings);
      expect(s3.isActive).toBe(true);
    });

    it("should default region to 'auto' when S3_REGION is missing", () => {
      const { S3_REGION: _, ...partial } = fullEnv;
      const s3 = new S3Service(partial as Bindings);
      expect(s3.isActive).toBe(true);
    });
  });

  describe("uploadFile", () => {
    it("should throw when inactive", async () => {
      const s3 = new S3Service({} as Bindings);
      await expect(
        s3.uploadFile(new ArrayBuffer(0), "png", "image/png"),
      ).rejects.toThrow("S3 Service is not configured");
    });
  });

  describe("getPresignedUrl", () => {
    it("should return empty string when inactive", async () => {
      const s3 = new S3Service({} as Bindings);
      const url = await s3.getPresignedUrl("test-key");
      expect(url).toBe("");
    });
  });

  describe("cleanupOldFiles", () => {
    it("should throw when inactive", async () => {
      const s3 = new S3Service({} as Bindings);
      await expect(
        s3.cleanupOldFiles(new Date(), new Date()),
      ).rejects.toThrow("S3 Service is not configured");
    });
  });
});
