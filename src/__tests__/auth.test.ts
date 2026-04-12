import { describe, it, expect } from "vitest";
import { app } from "../index";

/**
 * 认证中间件测试
 *
 * 使用 Hono 的 app.request() 测试工具直接构造 HTTP 请求，
 * 验证 Bearer Token 认证逻辑的各种场景。
 */
describe("Auth Middleware", () => {
  it("should skip auth when API_TOKEN is not configured", async () => {
    const res = await app.request("/health", {}, { });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.status).toBe("ok");
  });

  it("should return 401 when Authorization header is missing", async () => {
    const res = await app.request(
      "/v1/models",
      {},
      { API_TOKEN: "valid-token" },
    );
    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.message).toBe("Missing Authorization header");
  });

  it("should return 401 for non-Bearer format", async () => {
    const res = await app.request(
      "/v1/models",
      { headers: { Authorization: "Basic dXNlcjpwYXNz" } },
      { API_TOKEN: "valid-token" },
    );
    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.message).toBe("Invalid Authorization format");
  });

  it("should return 401 for invalid token", async () => {
    const res = await app.request(
      "/v1/models",
      { headers: { Authorization: "Bearer wrong-token" } },
      { API_TOKEN: "valid-token" },
    );
    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.message).toBe("Invalid token");
  });

  it("should return 200 for valid token", async () => {
    const res = await app.request(
      "/v1/models/all",
      { headers: { Authorization: "Bearer valid-token" } },
      { API_TOKEN: "valid-token" },
    );
    expect(res.status).toBe(200);
  });

  it("should accept any valid token from comma-separated list", async () => {
    const env = { API_TOKEN: "token-a, token-b, token-c" };

    // token-b should be accepted
    const res = await app.request(
      "/v1/models/all",
      { headers: { Authorization: "Bearer token-b" } },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("should reject token with extra whitespace", async () => {
    const res = await app.request(
      "/v1/models/all",
      { headers: { Authorization: "Bearer  valid-token" } }, // extra space
      { API_TOKEN: "valid-token" },
    );
    // Extra space means token is " valid-token" which doesn't match
    expect(res.status).toBe(401);
  });

  it("should allow health endpoint without auth", async () => {
    const res = await app.request(
      "/health",
      {},
      { API_TOKEN: "some-token" },
    );
    // health endpoint is outside /v1/* so auth middleware doesn't apply
    expect(res.status).toBe(200);
  });
});

describe("ADMIN_TOKEN Separation", () => {
  it("should reject API_TOKEN on admin route when ADMIN_TOKEN is configured", async () => {
    const env = { API_TOKEN: "user-token", ADMIN_TOKEN: "admin-secret" };

    const res = await app.request(
      "/v1/token-stats/all",
      { headers: { Authorization: "Bearer user-token" } },
      env,
    );
    expect(res.status).toBe(401);
  });

  it("should accept ADMIN_TOKEN on admin route", async () => {
    const env = { API_TOKEN: "user-token", ADMIN_TOKEN: "admin-secret" };

    const res = await app.request(
      "/v1/token-stats/all",
      { headers: { Authorization: "Bearer admin-secret" } },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("should fallback to API_TOKEN when ADMIN_TOKEN is not set", async () => {
    const env = { API_TOKEN: "user-token" };

    const res = await app.request(
      "/v1/token-stats/all",
      { headers: { Authorization: "Bearer user-token" } },
      env,
    );
    expect(res.status).toBe(200);
  });

  it("should allow API_TOKEN to access normal routes", async () => {
    const env = { API_TOKEN: "user-token", ADMIN_TOKEN: "admin-secret" };

    const res = await app.request(
      "/v1/models/all",
      { headers: { Authorization: "Bearer user-token" } },
      env,
    );
    expect(res.status).toBe(200);
  });
});
