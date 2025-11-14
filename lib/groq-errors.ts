export class GroqError extends Error {
  constructor(
    message: string,
    public code?: number,
    public status?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "GroqError";
  }
}

export class GroqRateLimitError extends GroqError {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message, 429, "RATE_LIMIT", true);
    this.name = "GroqRateLimitError";
  }
}

export class GroqQuotaError extends GroqError {
  constructor(message: string) {
    super(message, 429, "QUOTA_EXCEEDED", false);
    this.name = "GroqQuotaError";
  }
}

export class GroqAuthError extends GroqError {
  constructor(message: string, code: number = 401) {
    super(message, code, "AUTH", false);
    this.name = "GroqAuthError";
  }
}

export class GroqContentBlockedError extends GroqError {
  constructor(message: string) {
    super(message, 400, "CONTENT_BLOCKED", false);
    this.name = "GroqContentBlockedError";
  }
}

/**
 * Possible error response structures from Groq/OpenAI-style APIs
 */
interface GroqErrorResponse {
  status?: number;
  code?: number;
  message?: string;
  response?: {
    status?: number;
    headers?: {
      "retry-after"?: string | number;
      [key: string]: unknown;
    };
    data?: {
      error?: {
        message?: string;
        type?: string;
      };
    };
  };
}

/**
 * Type guard to check if error has a response structure
 */
function hasErrorResponse(error: unknown): error is GroqErrorResponse {
  return typeof error === "object" && error !== null;
}

/**
 * Extract error code from various possible locations
 */
function extractErrorCode(error: GroqErrorResponse): number | undefined {
  return error.status ?? error.code ?? error.response?.status;
}

/**
 * Extract error message from various possible locations
 */
function extractErrorMessage(error: GroqErrorResponse): string {
  return error.message ?? error.response?.data?.error?.message ?? "Unknown Groq error";
}

/**
 * Extract error status/type from various possible locations
 */
function extractErrorStatus(error: GroqErrorResponse): string | undefined {
  return error.response?.data?.error?.type ?? error.status?.toString();
}

/**
 * Extract retry-after header value
 */
function extractRetryAfter(error: GroqErrorResponse): number | undefined {
  const header = error.response?.headers?.["retry-after"];
  if (header === undefined) return undefined;
  const parsed = typeof header === "string" ? parseInt(header, 10) : header;
  return isNaN(parsed) ? undefined : parsed;
}

export function parseGroqError(error: unknown): GroqError {
  if (error instanceof Error && error.name === "AbortError") {
    return new GroqError("Request timed out", 408, "TIMEOUT", true);
  }

  // Attempt to parse as Groq/OpenAI-style error shape
  try {
    if (!hasErrorResponse(error)) {
      const message = error instanceof Error ? error.message : String(error);
      return new GroqError(message);
    }

    const code = extractErrorCode(error);
    const message = extractErrorMessage(error);
    const status = extractErrorStatus(error);

    if (code === 429) {
      const retryAfter = extractRetryAfter(error);
      // Distinguish quota vs rate-limit by message keyword if possible
      if (String(message).toLowerCase().includes("quota")) {
        return new GroqQuotaError(message);
      }
      return new GroqRateLimitError(message, retryAfter);
    }

    if (code === 401 || code === 403) {
      return new GroqAuthError(message, code);
    }

    if (code === 400 && String(message).toLowerCase().includes("safety")) {
      return new GroqContentBlockedError(message);
    }

    if (typeof code === "number") {
      const retryable = code >= 500;
      return new GroqError(message, code, status, retryable);
    }

    return new GroqError(message);
  } catch {
    const message = error instanceof Error ? error.message : String(error);
    return new GroqError(message);
  }
}
