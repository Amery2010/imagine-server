import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createStorage, Storage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import { CircuitBreaker, withCircuitBreaker } from "../circuit-breaker";

describe("CircuitBreaker", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage({ driver: memoryDriver() });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should initialize in CLOSED state", async () => {
    const cb = new CircuitBreaker(storage, "test");
    const { state, failures } = await cb.getState();
    expect(state).toBe("CLOSED");
    expect(failures).toBe(0);
  });

  it("should trip to OPEN after reaching threshold", async () => {
    const cb = new CircuitBreaker(storage, "test", { failureThreshold: 3 });

    await cb.recordFailure(); // 1
    await cb.recordFailure(); // 2
    let { state } = await cb.getState();
    expect(state).toBe("CLOSED");

    await cb.recordFailure(); // 3 -> OPEN
    ({ state } = await cb.getState());
    expect(state).toBe("OPEN");

    // check should throw now
    await expect(cb.check()).rejects.toThrow("Circuit breaker is OPEN");
  });

  it("should transition to HALF_OPEN after reset timeout", async () => {
    const cb = new CircuitBreaker(storage, "test", { failureThreshold: 1, resetTimeout: 1000 });

    await cb.recordFailure(); // trips

    // check should throw
    await expect(cb.check()).rejects.toThrow("Circuit breaker is OPEN");

    // advance time past resetTimeout
    vi.advanceTimersByTime(1100);

    // check should pass and transition state to HALF_OPEN
    await cb.check();
    const { state } = await cb.getState();
    expect(state).toBe("HALF_OPEN");
  });

  it("should reset to CLOSED if success when HALF_OPEN", async () => {
    const cb = new CircuitBreaker(storage, "test", { failureThreshold: 1, resetTimeout: 1000 });
    await cb.recordFailure(); // trips
    vi.advanceTimersByTime(1100);
    await cb.check(); // transitions to HALF_OPEN

    await cb.recordSuccess(); // success!

    const { state, failures } = await cb.getState();
    expect(state).toBe("CLOSED");
    expect(failures).toBe(0);
  });

  it("should trip back to OPEN if failure when HALF_OPEN", async () => {
    const cb = new CircuitBreaker(storage, "test", { failureThreshold: 1, resetTimeout: 1000 });
    await cb.recordFailure(); // trips
    vi.advanceTimersByTime(1100);
    await cb.check(); // transitions to HALF_OPEN

    await cb.recordFailure(); // fails again!

    const { state } = await cb.getState();
    expect(state).toBe("OPEN");
  });
});

describe("withCircuitBreaker wrapper", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage({ driver: memoryDriver() });
  });

  it("should execute function normally", async () => {
    const result = await withCircuitBreaker(storage, "test", async () => "success");
    expect(result).toBe("success");
  });

  it("should trip breaker if function keeps failing", async () => {
    const failingFn = async () => { throw new Error("Network error"); };
    
    // Fail 3 times (threshold is 2)
    await expect(withCircuitBreaker(storage, "test", failingFn, { failureThreshold: 2 })).rejects.toThrow("Network error");
    await expect(withCircuitBreaker(storage, "test", failingFn, { failureThreshold: 2 })).rejects.toThrow("Network error");
    
    // 3rd time should be circuit breaker error, not network error
    await expect(withCircuitBreaker(storage, "test", failingFn, { failureThreshold: 2 })).rejects.toThrow("Circuit breaker is OPEN");
  });

  it("should bypass circuit breaker if storage is null", async () => {
    const fn = async () => "ok";
    const result = await withCircuitBreaker(null, "test", fn);
    expect(result).toBe("ok");
  });
});
