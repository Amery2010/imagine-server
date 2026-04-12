import { describe, it, expect } from "vitest";
import { app } from "../../index";

/**
 * proxyRequest & getTaskStatus 集成测试
 *
 * 使用 Hono 的 app.request() 直接发送 HTTP 请求，
 * 验证路由、参数校验、Provider 解析等逻辑。
 *
 * 注意：由于未 mock Provider 实现，这些测试只验证 API 层面的参数校验和错误处理。
 * Provider 具体逻辑测试属于各 Provider 单元测试的范畴。
 */
describe("Proxy API", () => {
  describe("POST /v1/:action", () => {
    it("should return 400 when model is missing", async () => {
      const res = await app.request(
        "/v1/imagine",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "a cat" }),
        },
        {},
      );
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error).toBe("Invalid parameters");
    });

    it("should return 400 when model is empty string", async () => {
      const res = await app.request(
        "/v1/imagine",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "", prompt: "a cat" }),
        },
        {},
      );
      expect(res.status).toBe(400);
    });

    it("should return 400 for unknown provider", async () => {
      const res = await app.request(
        "/v1/imagine",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "nonexistent-provider/some-model",
            prompt: "a cat",
          }),
        },
        {},
      );
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error).toBe("Invalid provider");
      expect(body.message).toContain("nonexistent-provider");
    });

    it("should return 400 for invalid JSON body", async () => {
      const res = await app.request(
        "/v1/imagine",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "not-json",
        },
        {},
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /v1/task-status", () => {
    it("should return 400 when taskId is missing", async () => {
      const res = await app.request("/v1/task-status", {}, {});
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error).toBe("taskId is required");
    });
  });

  describe("GET /v1/models/all", () => {
    it("should return model list as array", async () => {
      const res = await app.request("/v1/models/all", {}, {});
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
    });

    it("should include provider name in model id", async () => {
      const res = await app.request("/v1/models/all", {}, {});
      const body: any = await res.json();
      // Every model ID should have format "provider/model"
      for (const model of body) {
        expect(model.id).toContain("/");
      }
    });
  });
});
