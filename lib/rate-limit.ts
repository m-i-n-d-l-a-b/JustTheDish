import { type NextRequest } from "next/server"

// Entry for rate limiting per key
interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory storage for rate limit data
const rateLimitMap = new Map<string, RateLimitEntry>()

/**
 * Derive a stable rate limit key from the incoming request.
 * Falls back to "unknown" when IP cannot be determined.
 */
export function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : request.ip
  return ip ?? "unknown"
}

/**
 * Check and update rate limit state for a given key.
 * Allows one request per minute (60 seconds).
 */
export function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 1

  const current = rateLimitMap.get(key)

  if (current === undefined || now >= current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (current.count >= maxRequests) {
    return false
  }

  current.count += 1
  return true
}
