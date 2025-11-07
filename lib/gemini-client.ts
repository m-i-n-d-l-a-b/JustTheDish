import { GoogleGenAI } from "@google/genai"
import { getEnv } from "./env"
import { geminiErrorSchema } from "./schemas"
import { logger } from "./logger"

/**
 * Custom error class for Gemini API errors
 */
export class GeminiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public status?: string,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = "GeminiError"
  }
}

/**
 * Custom error class for rate limiting
 */
export class GeminiRateLimitError extends GeminiError {
  constructor(message: string, public retryAfter?: number) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", true)
    this.name = "GeminiRateLimitError"
  }
}

/**
 * Custom error class for quota exceeded
 */
export class GeminiQuotaError extends GeminiError {
  constructor(message: string) {
    super(message, 429, "QUOTA_EXCEEDED", false)
    this.name = "GeminiQuotaError"
  }
}

/**
 * Custom error class for content blocked by safety filters
 */
export class GeminiContentBlockedError extends GeminiError {
  constructor(message: string) {
    super(message, 400, "CONTENT_BLOCKED", false)
    this.name = "GeminiContentBlockedError"
  }
}

/**
 * Utility function to add jitter to retry delays
 */
function addJitter(delay: number, jitterFactor: number = 0.1): number {
  const jitter = delay * jitterFactor * Math.random()
  return delay + jitter
}

/**
 * Utility function to calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number, baseDelay: number): number {
  const delay = baseDelay * Math.pow(2, attempt)
  return addJitter(delay)
}

/**
 * Utility function to sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Gemini API client with retry logic and error handling
 */
export class GeminiClient {
  private genAI: GoogleGenAI
  private requestTimeout: number
  private maxRetries: number
  private baseRetryDelay: number

  constructor() {
    logger.log("Initializing GeminiClient...")
    
    const env = getEnv()
    logger.log("Environment loaded successfully")
    
    // Fail fast if API key is not configured
    if (!env.GOOGLE_API_KEY || env.GOOGLE_API_KEY.trim().length === 0) {
      throw new Error(
        "Google API key is missing. Set GOOGLE_API_KEY in your .env.local and restart the dev server."
      )
    }

    this.genAI = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY })
    this.requestTimeout = env.GEMINI_REQUEST_TIMEOUT
    this.maxRetries = env.GEMINI_MAX_RETRIES
    this.baseRetryDelay = env.GEMINI_RETRY_DELAY
    logger.log(`GeminiClient initialized with model: ${env.GEMINI_MODEL}`)
  }

  // Note: generation config kept minimal; prompt enforces strict JSON.

  /**
   * Parse and categorize Gemini API errors
   */
  private parseGeminiError(error: unknown): GeminiError {
    // Handle timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      return new GeminiError("Request timed out", 408, "TIMEOUT", true)
    }

    // Handle network errors
    if (error instanceof Error && (
      error.message.includes("fetch") || 
      error.message.includes("network") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("ECONNREFUSED")
    )) {
      return new GeminiError("Network error occurred", 503, "NETWORK_ERROR", true)
    }

    // Try to parse as Gemini API error
    try {
      const parsed = geminiErrorSchema.parse(error)
      const { code, message, status } = parsed.error

      // Handle specific error types
      switch (code ?? -1) {
        case 429:
          if (message.toLowerCase().includes("quota")) {
            return new GeminiQuotaError(message)
          }
          return new GeminiRateLimitError(message)
        
        case 400:
          if (message.toLowerCase().includes("safety") || 
              message.toLowerCase().includes("blocked")) {
            return new GeminiContentBlockedError(message)
          }
          return new GeminiError(message, code, status, false)
        
        case 401:
        case 403:
          return new GeminiError(message, code, status, false)
        
        case 500:
        case 502:
        case 503:
        case 504:
          return new GeminiError(message, code, status, true)
        
        default:
          return new GeminiError(message, code, status, (code ?? -1) >= 500)
      }
    } catch {
      // Fallback for unknown errors
      const errorMessage = error instanceof Error ? error.message : String(error)
      return new GeminiError(`Unknown error: ${errorMessage}`, undefined, undefined, false)
    }
  }

  /**
   * Execute a request with timeout control
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          const timeoutError = new Error("Request timed out")
          ;(timeoutError as Error).name = "AbortError"
          reject(timeoutError)
        }, timeoutMs)
      })

      const result = await Promise.race([operation(), timeoutPromise])
      if (timeoutId) clearTimeout(timeoutId)
      return result as T
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId)
      throw error
    }
  }

  /**
   * Execute a request with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = "Gemini API request"
  ): Promise<T> {
    let lastError: GeminiError | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.executeWithTimeout(operation, this.requestTimeout)
        
        // Log successful retry if this wasn't the first attempt
        if (attempt > 0) {
          logger.log(`${operationName} succeeded on attempt ${attempt + 1}`)
        }
        
        return result
      } catch (error) {
        lastError = this.parseGeminiError(error)
        
        // Don't retry if error is not retryable or we've exhausted attempts
        if (!lastError.retryable || attempt === this.maxRetries) {
          break
        }

        // Handle rate limiting with Retry-After header
        if (lastError instanceof GeminiRateLimitError && lastError.retryAfter) {
          const retryDelay = lastError.retryAfter * 1000 // Convert to milliseconds
          logger.warn(`Rate limited, retrying after ${retryDelay}ms`)
          await sleep(retryDelay)
          continue
        }

        // Calculate backoff delay
        const backoffDelay = calculateBackoffDelay(attempt, this.baseRetryDelay)
        
        logger.warn(
          `${operationName} failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. ` +
          `Retrying in ${Math.round(backoffDelay)}ms...`
        )
        
        await sleep(backoffDelay)
      }
    }

    // All retries exhausted
    const finalMessage = lastError ? lastError.message : "Unknown error"
    logger.error(`${operationName} failed after ${this.maxRetries + 1} attempts: ${finalMessage}`)
    throw (lastError ?? new Error(finalMessage))
  }

  /**
   * Generate content using the Gemini model with retry logic
   */
  async generateContent(prompt: string, requestId?: string): Promise<string> {
    const operation = async () => {
      const env = getEnv()
      const result = await this.genAI.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [prompt],
        // Allow the model to fetch page content via URL Context
        config: {
          tools: [{ urlContext: {} }],
          temperature: 0,
        },
      })

      const text = (result as { text?: string }).text
      if (!text) throw new Error("Empty response received from Gemini")
      return text
    }

    const operationName = requestId 
      ? `Gemini content generation (${requestId})`
      : "Gemini content generation"

    return this.executeWithRetry(operation, operationName)
  }

  /**
   * Get model information
   */
  getModelInfo(): { 
    model: string
    timeout: number
    maxRetries: number
    baseRetryDelay: number
  } {
    const env = getEnv()
    return {
      model: env.GEMINI_MODEL,
      timeout: this.requestTimeout,
      maxRetries: this.maxRetries,
      baseRetryDelay: this.baseRetryDelay,
    }
  }

  /**
   * Health check method to test API connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.generateContent("Test connection. Respond with: OK")
      return true
    } catch (error) {
      logger.error("Gemini health check failed:", error)
      return false
    }
  }
}
