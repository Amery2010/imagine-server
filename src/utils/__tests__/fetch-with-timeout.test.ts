import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithTimeout, TIMEOUT } from "../fetch-with-timeout";

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should return response for successful request", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const res = await fetchWithTimeout("https://example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("should pass request init options to fetch", async () => {
    const mockResponse = new Response("ok");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("should throw timeout error when request exceeds timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise((_, reject) => {
          // Simulate AbortController aborting
          setTimeout(
            () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })),
            200,
          );
        }),
    );

    vi.useRealTimers(); // need real timers for this test
    await expect(
      fetchWithTimeout("https://example.com", { timeout: 100 }),
    ).rejects.toThrow("Request timed out after 100ms");
  });

  it("should propagate non-abort errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Network error"),
    );

    await expect(
      fetchWithTimeout("https://example.com"),
    ).rejects.toThrow("Network error");
  });

  it("should have correct TIMEOUT constants", () => {
    expect(TIMEOUT.SHORT).toBe(30_000);
    expect(TIMEOUT.DEFAULT).toBe(60_000);
    expect(TIMEOUT.LONG).toBe(120_000);
    expect(TIMEOUT.QUICK).toBe(15_000);
    expect(TIMEOUT.WEBHOOK).toBe(10_000);
  });
});
