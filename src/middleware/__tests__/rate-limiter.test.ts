import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Hono } from "hono";
import { createStorage, Storage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import { rateLimiter } from "../rate-limiter";
import type { Bindings } from "../../types";

describe("Rate Limiter Middleware", () => {
  let app: Hono<{ Bindings: Bindings }>;
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage({ driver: memoryDriver() });
    app = new Hono<{ Bindings: Bindings }>();
    
    // 注入 Mock 环境变量
    app.use("*", async (c, next) => {
      c.env = { storage } as any;
      await next();
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should allow requests under the limit", async () => {
    app.use("*", rateLimiter({ limit: 5, windowMs: 60000 }));
    app.get("/", (c) => c.text("OK"));

    for (let i = 0; i < 5; i++) {
      const req = new Request("http://localhost/");
      const res = await app.request(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe((4 - i).toString());
    }
  });

  it("should block requests over the limit", async () => {
    app.use("*", rateLimiter({ limit: 2, windowMs: 60000 }));
    app.get("/", (c) => c.text("OK"));

    const req = new Request("http://localhost/");
    
    // 1st request -> OK
    let res = await app.request(req);
    expect(res.status).toBe(200);

    // 2nd request -> OK
    res = await app.request(req);
    expect(res.status).toBe(200);

    // 3rd request -> Blocked
    res = await app.request(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    const body = await res.json();
    expect(body).toHaveProperty("error", "Too Many Requests");
  });

  it("should distinguish limiters by IP when token is missing", async () => {
    app.use("*", rateLimiter({ limit: 1, windowMs: 60000 }));
    app.get("/", (c) => c.text("OK"));

    // IP 1: Blocked after 1
    const req1_1 = new Request("http://localhost/", { headers: { "cf-connecting-ip": "1.1.1.1" } });
    expect((await app.request(req1_1)).status).toBe(200);
    const req1_2 = new Request("http://localhost/", { headers: { "cf-connecting-ip": "1.1.1.1" } });
    expect((await app.request(req1_2)).status).toBe(429);

    // IP 2: Allowed
    const req2 = new Request("http://localhost/", { headers: { "cf-connecting-ip": "2.2.2.2" } });
    expect((await app.request(req2)).status).toBe(200);
  });

  it("should distinguish limiters by Token", async () => {
    app.use("*", rateLimiter({ limit: 1, windowMs: 60000 }));
    app.get("/", (c) => c.text("OK"));

    // Both share same IP but different tokens
    const ipHeaders = { "cf-connecting-ip": "1.1.1.1" };

    const reqToken1 = new Request("http://localhost/", { 
      headers: { ...ipHeaders, "Authorization": "Bearer tokenA" } 
    });
    expect((await app.request(reqToken1)).status).toBe(200);

    const reqToken2 = new Request("http://localhost/", { 
      headers: { ...ipHeaders, "Authorization": "Bearer tokenB" } 
    });
    expect((await app.request(reqToken2)).status).toBe(200);

    // Retry tokenA -> Blocked
    const reqToken1_Retry = new Request("http://localhost/", { 
      headers: { ...ipHeaders, "Authorization": "Bearer tokenA" } 
    });
    expect((await app.request(reqToken1_Retry)).status).toBe(429);
  });

  it("should reset allowance after window expires", async () => {
    app.use("*", rateLimiter({ limit: 1, windowMs: 60000 }));
    app.get("/", (c) => c.text("OK"));

    // 0:00 - consume limit
    expect((await app.request(new Request("http://localhost/"))).status).toBe(200);
    expect((await app.request(new Request("http://localhost/"))).status).toBe(429);

    // 0:01 (60s later) - should shift into new window and reset
    vi.advanceTimersByTime(61000);
    
    expect((await app.request(new Request("http://localhost/"))).status).toBe(200);
  });
});
