export class GroqError extends Error {
  constructor(
    message: string,
    public code?: number,
    public status?: string,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = "GroqError"
  }
}

export class GroqRateLimitError extends GroqError {
  constructor(message: string, public retryAfter?: number) {
    super(message, 429, "RATE_LIMIT", true)
    this.name = "GroqRateLimitError"
  }
}

export class GroqQuotaError extends GroqError {
  constructor(message: string) {
    super(message, 429, "QUOTA_EXCEEDED", false)
    this.name = "GroqQuotaError"
  }
}

export class GroqAuthError extends GroqError {
  constructor(message: string, code: number = 401) {
    super(message, code, "AUTH", false)
    this.name = "GroqAuthError"
  }
}

export class GroqContentBlockedError extends GroqError {
  constructor(message: string) {
    super(message, 400, "CONTENT_BLOCKED", false)
    this.name = "GroqContentBlockedError"
  }
}

export function parseGroqError(error: unknown): GroqError {
  if (error instanceof Error && error.name === "AbortError") {
    return new GroqError("Request timed out", 408, "TIMEOUT", true)
  }

  // Attempt to parse as Groq/OpenAI-style error shape
  try {
    const maybe = error as any
    const code: number | undefined = maybe?.status ?? maybe?.code ?? maybe?.response?.status
    const message: string = maybe?.message || maybe?.response?.data?.error?.message || "Unknown Groq error"
    const status: string | undefined = maybe?.response?.data?.error?.type || maybe?.status

    if (code === 429) {
      const retryAfterHeader = maybe?.response?.headers?.["retry-after"]
      const retryAfter = retryAfterHeader ? parseInt(String(retryAfterHeader), 10) : undefined
      // Distinguish quota vs rate-limit by message keyword if possible
      if (String(message).toLowerCase().includes("quota")) {
        return new GroqQuotaError(message)
      }
      return new GroqRateLimitError(message, isNaN(Number(retryAfter)) ? undefined : Number(retryAfter))
    }

    if (code === 401 || code === 403) {
      return new GroqAuthError(message, code)
    }

    if (code === 400 && String(message).toLowerCase().includes("safety")) {
      return new GroqContentBlockedError(message)
    }

    if (typeof code === "number") {
      const retryable = code >= 500
      return new GroqError(message, code, status, retryable)
    }

    return new GroqError(message)
  } catch {
    const message = error instanceof Error ? error.message : String(error)
    return new GroqError(message)
  }
}






