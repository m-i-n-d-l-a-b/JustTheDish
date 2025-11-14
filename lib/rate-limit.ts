import type { NextRequest } from "next/server";
import { RATE_LIMIT } from "./constants";

// Entry for rate limiting per key
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage for rate limit data
const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Derives a stable rate limit key from the incoming request.
 * Uses the client IP address from x-forwarded-for header or request.ip.
 * Falls back to "unknown" when IP cannot be determined.
 *
 * @param request - The Next.js request object
 * @returns A string key for rate limiting (typically an IP address)
 *
 * @example
 * ```typescript
 * const key = getRateLimitKey(request);
 * const allowed = checkRateLimit(key);
 * ```
 */
export function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : request.ip;
  return ip ?? "unknown";
}

/**
 * Rate limit information returned by checkRateLimitWithInfo
 */
export interface RateLimitInfo {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
}

/**
 * Checks and updates rate limit state for a given key.
 * Allows one request per minute (60 seconds) by default.
 * Returns true if the request is allowed, false if rate limited.
 *
 * @param key - The rate limit key (typically an IP address)
 * @returns True if the request is allowed, false if rate limited
 *
 * @example
 * ```typescript
 * const key = getRateLimitKey(request);
 * if (!checkRateLimit(key)) {
 *   return new NextResponse(null, { status: 429 });
 * }
 * ```
 */
export function checkRateLimit(key: string): boolean {
  const result = checkRateLimitWithInfo(key);
  return result.allowed;
}

/**
 * Checks and updates rate limit state for a given key with detailed information.
 * Allows one request per minute (60 seconds) by default.
 * Returns detailed rate limit information including remaining requests and reset time.
 *
 * @param key - The rate limit key (typically an IP address)
 * @returns Rate limit information including allowed status, limit, remaining, and reset time
 *
 * @example
 * ```typescript
 * const info = checkRateLimitWithInfo(key);
 * if (!info.allowed) {
 *   response.headers.set("X-RateLimit-Remaining", info.remaining.toString());
 *   response.headers.set("X-RateLimit-Reset", info.reset.toString());
 *   return new NextResponse(null, { status: 429 });
 * }
 * ```
 */
export function checkRateLimitWithInfo(key: string): RateLimitInfo {
  const now = Date.now();
  const windowMs = RATE_LIMIT.WINDOW_MS;
  const maxRequests = RATE_LIMIT.MAX_REQUESTS;

  const current = rateLimitMap.get(key);

  if (current === undefined || now >= current.resetTime) {
    const resetTime = now + windowMs;
    rateLimitMap.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: Math.floor(resetTime / 1000),
    };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      reset: Math.floor(current.resetTime / 1000),
    };
  }

  current.count += 1;
  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - current.count,
    reset: Math.floor(current.resetTime / 1000),
  };
}
