import { describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "../lib/rate-limit";

// Test that the rate limiter allows only one request per minute per key
describe("rate limiter", () => {
  it("allows one request per minute", () => {
    const key = "test-key";
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));

    // First request should pass
    expect(checkRateLimit(key)).toBe(true);
    // Second request within the same minute should be blocked
    expect(checkRateLimit(key)).toBe(false);

    // Advance time by 60 seconds to reset the limit
    vi.advanceTimersByTime(60 * 1000);
    expect(checkRateLimit(key)).toBe(true);

    vi.useRealTimers();
  });
});
