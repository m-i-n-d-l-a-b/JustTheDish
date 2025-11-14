import { NextResponse } from "next/server";
import { CORS } from "./constants";
import { getEnv } from "./env";

/**
 * Get allowed origins from environment variable
 */
function getAllowedOrigins(): string[] {
  const env = getEnv();
  const origins = env.ALLOWED_ORIGINS;
  if (origins === "*") {
    return ["*"];
  }
  return origins
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
}

/**
 * Check if an origin is allowed
 */
function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  if (allowedOrigins.includes("*")) return true;
  return allowedOrigins.includes(origin);
}

/**
 * Add CORS headers to a Next.js response based on the request origin.
 * Only sets CORS headers if the origin is allowed or a wildcard is configured.
 * This prevents exposing CORS permissions on rejected requests.
 *
 * @param response - The Next.js response object to add headers to
 * @param requestOrigin - The origin header from the request, or null if not present
 * @returns The response object with CORS headers added (if origin is allowed)
 *
 * @example
 * ```typescript
 * const response = NextResponse.json({ data: "example" });
 * const corsResponse = addCorsHeaders(response, "https://example.com");
 * ```
 */
export function addCorsHeaders(response: NextResponse, requestOrigin: string | null): NextResponse {
  const allowedOrigins = getAllowedOrigins();
  let originHeaderSet = false;

  // If no origin header is present, this is likely a same-origin or non-browser request.
  // For same-origin requests, CORS headers aren't needed, but we can set a wildcard
  // without credentials for compatibility. For non-browser requests that need CORS,
  // we use * without credentials (credentials require a specific origin).
  if (!requestOrigin) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    originHeaderSet = true;
    // Explicitly do NOT set Access-Control-Allow-Credentials for requests without origin
  } else if (isOriginAllowed(requestOrigin, allowedOrigins)) {
    // For requests with an origin header, check if it's allowed
    response.headers.set("Access-Control-Allow-Origin", requestOrigin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    originHeaderSet = true;
  } else if (allowedOrigins.includes("*")) {
    // Wildcard is allowed, but cannot use credentials with wildcard
    response.headers.set("Access-Control-Allow-Origin", "*");
    originHeaderSet = true;
  }
  // If origin is not allowed and no wildcard, don't set CORS headers (request should be rejected)

  // Only set other CORS headers if we actually set the origin header
  // This prevents exposing CORS permissions on rejected requests
  if (originHeaderSet) {
    response.headers.set("Access-Control-Allow-Methods", CORS.ALLOWED_METHODS);
    response.headers.set("Access-Control-Allow-Headers", CORS.ALLOWED_HEADERS);
    response.headers.set("Access-Control-Max-Age", CORS.MAX_AGE.toString());
  }

  return response;
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Returns a 200 response with CORS headers if the origin is allowed,
 * or null if the origin should be rejected (caller should return 403).
 *
 * @param requestOrigin - The origin header from the request, or null if not present
 * @returns A NextResponse with CORS headers if allowed, or null if rejected
 *
 * @example
 * ```typescript
 * const response = handleCorsPreflight("https://example.com");
 * if (response) {
 *   return response; // 200 with CORS headers
 * } else {
 *   return new NextResponse(null, { status: 403 }); // Rejected
 * }
 * ```
 */
export function handleCorsPreflight(requestOrigin: string | null): NextResponse | null {
  const allowedOrigins = getAllowedOrigins();
  if (!isOriginAllowed(requestOrigin, allowedOrigins)) {
    return new NextResponse(null, { status: 403 });
  }

  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response, requestOrigin);
}
