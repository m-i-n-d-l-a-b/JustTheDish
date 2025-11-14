/**
 * Application constants
 * Centralized location for magic numbers and strings used throughout the codebase
 */

/**
 * Rate limiting constants
 */
export const RATE_LIMIT = {
  /** Rate limit window in milliseconds (1 minute) */
  WINDOW_MS: 60 * 1000,
  /** Maximum number of requests per window */
  MAX_REQUESTS: 1,
} as const;

/**
 * Request size limits (in bytes)
 */
export const REQUEST_SIZE_LIMITS = {
  /** Maximum request body size for recipe extraction (1MB) */
  EXTRACT_RECIPE: 1024 * 1024,
  /** Maximum request body size for PDF generation (100KB) */
  GENERATE_PDF: 100 * 1024,
} as const;

/**
 * URL validation constants
 */
export const URL_LIMITS = {
  /** Maximum URL length in characters */
  MAX_LENGTH: 2048,
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * UI timing constants (in milliseconds)
 */
export const UI_TIMING = {
  /** Time to show copied state in clipboard copy button */
  COPIED_STATE_DURATION: 1500,
  /** Time to show error message before auto-dismissing */
  ERROR_DISPLAY_DURATION: 5000,
} as const;

/**
 * CORS constants
 */
export const CORS = {
  /** Maximum age for CORS preflight cache (24 hours in seconds) */
  MAX_AGE: 86400,
  /** Allowed HTTP methods for CORS */
  ALLOWED_METHODS: "GET, POST, OPTIONS",
  /** Allowed HTTP headers for CORS */
  ALLOWED_HEADERS: "Content-Type, Authorization, X-Request-ID",
} as const;

/**
 * Error message strings
 */
export const ERROR_MESSAGES = {
  INVALID_URL: "Please provide a valid URL starting with http:// or https://.",
  RATE_LIMIT_EXCEEDED:
    "Rate limit exceeded. You can extract one recipe per minute. Please try again later.",
  REQUEST_TOO_LARGE_EXTRACT: "Request body too large (maximum 1MB)",
  REQUEST_TOO_LARGE_PDF: "Request body too large (maximum 100KB)",
  RECIPE_REQUIRED: "Recipe data is required",
  SERVICE_UNAVAILABLE:
    "Recipe extraction service is temporarily unavailable. Please try again later.",
  UNEXPECTED_ERROR: "An unexpected error occurred while processing the recipe. Please try again.",
  PDF_GENERATION_FAILED: "Failed to generate PDF",
  COPY_FAILED: "Failed to copy recipe",
} as const;
