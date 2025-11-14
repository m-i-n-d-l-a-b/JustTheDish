import type { RecipeError } from "./schemas";

/**
 * Standardized error response format for API routes
 */
export interface ApiErrorResponse {
  error: {
    type: RecipeError["type"];
    message: string;
  };
}

/**
 * Creates a standardized error response object for API routes.
 * This ensures consistent error format across all endpoints.
 *
 * @param type - The error type from RecipeError type union
 * @param message - Human-readable error message
 * @returns A standardized error response object
 *
 * @example
 * ```typescript
 * const error = createErrorResponse("invalid-url", "Please provide a valid URL");
 * // Returns: { error: { type: "invalid-url", message: "Please provide a valid URL" } }
 * ```
 */
export function createErrorResponse(type: RecipeError["type"], message: string): ApiErrorResponse {
  return {
    error: {
      type,
      message,
    },
  };
}

/**
 * Maps error types to appropriate HTTP status codes.
 * This ensures consistent status code mapping across the application.
 *
 * @param errorType - The error type from RecipeError type union
 * @returns The corresponding HTTP status code
 *
 * @example
 * ```typescript
 * const status = getStatusCodeForErrorType("invalid-url"); // Returns 400
 * const status = getStatusCodeForErrorType("not-recipe"); // Returns 404
 * ```
 */
export function getStatusCodeForErrorType(errorType: RecipeError["type"]): number {
  switch (errorType) {
    case "invalid-url":
      return 400;
    case "not-recipe":
      return 404;
    case "paywall":
    case "content-blocked":
      return 403;
    case "url-inaccessible":
      return 404;
    case "parsing-failed":
      return 422;
    case "ai-unavailable":
      return 503;
    case "quota-exceeded":
      return 429;
    case "rate-limit":
      return 429;
    default:
      return 500;
  }
}

