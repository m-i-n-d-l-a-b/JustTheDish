import { getEnv } from "./env"
import { NextResponse } from "next/server"

/**
 * Get allowed origins from environment variable
 */
function getAllowedOrigins(): string[] {
  const env = getEnv()
  const origins = env.ALLOWED_ORIGINS
  if (origins === "*") {
    return ["*"]
  }
  return origins.split(",").map((origin) => origin.trim()).filter(Boolean)
}

/**
 * Check if an origin is allowed
 */
function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false
  if (allowedOrigins.includes("*")) return true
  return allowedOrigins.includes(origin)
}

/**
 * Add CORS headers to a Next.js response
 */
export function addCorsHeaders(
  response: NextResponse,
  requestOrigin: string | null
): NextResponse {
  const allowedOrigins = getAllowedOrigins()
  const origin = isOriginAllowed(requestOrigin, allowedOrigins) && requestOrigin ? requestOrigin : (allowedOrigins[0] ?? "*")

  if (origin !== "*") {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
  } else {
    response.headers.set("Access-Control-Allow-Origin", "*")
  }

  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Request-ID"
  )
  response.headers.set("Access-Control-Max-Age", "86400") // 24 hours

  return response
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflight(requestOrigin: string | null): NextResponse | null {
  const allowedOrigins = getAllowedOrigins()
  if (!isOriginAllowed(requestOrigin, allowedOrigins)) {
    return new NextResponse(null, { status: 403 })
  }

  const response = new NextResponse(null, { status: 200 })
  return addCorsHeaders(response, requestOrigin)
}

