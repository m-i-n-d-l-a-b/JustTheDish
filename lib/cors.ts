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
  
  // If no origin header is present, this is likely a same-origin or non-browser request.
  // For same-origin requests, CORS headers aren't needed, but we can set a wildcard
  // without credentials for compatibility. For non-browser requests that need CORS,
  // we use * without credentials (credentials require a specific origin).
  if (!requestOrigin) {
    response.headers.set("Access-Control-Allow-Origin", "*")
    // Explicitly do NOT set Access-Control-Allow-Credentials for requests without origin
  } else if (isOriginAllowed(requestOrigin, allowedOrigins)) {
    // For requests with an origin header, check if it's allowed
    response.headers.set("Access-Control-Allow-Origin", requestOrigin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
  } else if (allowedOrigins.includes("*")) {
    // Wildcard is allowed, but cannot use credentials with wildcard
    response.headers.set("Access-Control-Allow-Origin", "*")
  }
  // If origin is not allowed and no wildcard, don't set CORS headers (request should be rejected)

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

