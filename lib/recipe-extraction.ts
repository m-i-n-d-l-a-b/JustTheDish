import { v4 as uuidv4 } from "uuid"
import { GeminiClient, GeminiError, GeminiContentBlockedError, GeminiQuotaError, GeminiRateLimitError } from "./gemini-client"
import { getRecipeExtractionPrompt } from "./prompts"
import { 
  validateRecipeUrl, 
  validateGeminiResponse, 
  sanitizeRecipe,
  type Recipe,
  type GeminiRecipeResponse,
  type RecipeExtractionLog
} from "./schemas"

/**
 * Custom error types for recipe extraction
 */
export class RecipeExtractionError extends Error {
  constructor(
    message: string,
    public type: "invalid-url" | "not-recipe" | "paywall" | "url-inaccessible" | "parsing-failed" | "content-blocked" | "ai-unavailable" | "quota-exceeded" | "server",
    public retryable: boolean = false
  ) {
    super(message)
    this.name = "RecipeExtractionError"
  }
}

/**
 * Recipe extraction service configuration
 */
interface ExtractionConfig {
  strategy?: 'basic' | 'enhanced' | 'partial'
  requestId?: string
  timeout?: number
}

/**
 * Recipe extraction result
 */
interface ExtractionResult {
  recipe?: Recipe
  error?: {
    type: RecipeExtractionError['type']
    message: string
  }
  metadata: {
    requestId: string
    url: string
    duration: number
    model: string
    timestamp: string
  }
}

/**
 * Main recipe extraction service class
 */
export class RecipeExtractionService {
  private geminiClient!: GeminiClient
  private isInitialized: boolean = false

  constructor() {
    try {
      console.log("🔄 Initializing RecipeExtractionService...")
      this.geminiClient = new GeminiClient()
      this.isInitialized = true
      console.log("✅ RecipeExtractionService initialized successfully")
    } catch (error) {
      console.error("❌ Failed to initialize Gemini client:", error)
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace')
      this.isInitialized = false
    }
  }

  /**
   * Check if the service is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized
  }

  /**
   * Get service health status
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isInitialized) {
      return false
    }
    
    try {
      return await this.geminiClient.healthCheck()
    } catch (error) {
      console.error("Recipe extraction service health check failed:", error)
      return false
    }
  }

  /**
   * Map Gemini errors to recipe extraction errors
   */
  private mapGeminiError(error: GeminiError): RecipeExtractionError {
    if (error instanceof GeminiContentBlockedError) {
      return new RecipeExtractionError(
        "The content at this URL was blocked by safety filters. Please try a different recipe URL.",
        "content-blocked",
        false
      )
    }

    if (error instanceof GeminiQuotaError) {
      return new RecipeExtractionError(
        "API quota exceeded. Please try again later or contact support.",
        "quota-exceeded",
        false
      )
    }

    if (error instanceof GeminiRateLimitError) {
      return new RecipeExtractionError(
        "Too many requests. Please wait a moment and try again.",
        "ai-unavailable",
        true
      )
    }

    // Handle specific error codes
    switch (error.code) {
      case 401:
      case 403:
        return new RecipeExtractionError(
          "Authentication failed. Please check API configuration.",
          "server",
          false
        )
      case 404:
        return new RecipeExtractionError(
          "The Gemini API endpoint was not found. Please check configuration.",
          "server",
          false
        )
      case 408:
      case 504:
        return new RecipeExtractionError(
          "Request timed out. Please try again.",
          "ai-unavailable",
          true
        )
      case 500:
      case 502:
      case 503:
        return new RecipeExtractionError(
          "AI service is temporarily unavailable. Please try again later.",
          "ai-unavailable",
          true
        )
      default:
        return new RecipeExtractionError(
          error.retryable 
            ? "Temporary AI service error. Please try again."
            : "AI service error occurred. Please try again later.",
          "ai-unavailable",
          error.retryable
        )
    }
  }

  /**
   * Parse and validate Gemini's JSON response
   */
  private parseGeminiResponse(responseText: string): GeminiRecipeResponse {
    try {
      // Prefer strict JSON, but defensively extract when prose is present
      const text = responseText.trim()

      // Fast path: pure JSON
      let parsedResponse: unknown
      const firstBrace = text.indexOf('{')
      const lastBrace = text.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const candidate = text.slice(firstBrace, lastBrace + 1)
        try {
          parsedResponse = JSON.parse(candidate)
        } catch {
          // Remove common code-fence patterns and retry
          const unfenced = text
            .replace(/^```json\s*/i, '')
            .replace(/^```/i, '')
            .replace(/```\s*$/i, '')
            .trim()
          parsedResponse = JSON.parse(unfenced)
        }
      } else {
        parsedResponse = JSON.parse(text)
      }
      
      // Normalize steps: if model returned array of objects with "step", map to strings
      if (
        parsedResponse &&
        typeof parsedResponse === 'object' &&
        'recipe' in (parsedResponse as any) &&
        (parsedResponse as any).recipe &&
        Array.isArray((parsedResponse as any).recipe.steps)
      ) {
        const steps = (parsedResponse as any).recipe.steps
        if (steps.length > 0 && typeof steps[0] === 'object' && steps[0] !== null) {
          (parsedResponse as any).recipe.steps = steps.map((s: any) =>
            typeof s === 'string' ? s : (typeof s?.step === 'string' ? s.step : JSON.stringify(s))
          )
        }
      }
      
      // Validate against schema
      return validateGeminiResponse(parsedResponse)
    } catch (error) {
      console.error("Failed to parse Gemini response:", error)
      console.error("Raw response:", responseText)
      
      throw new RecipeExtractionError(
        "Failed to parse AI response. The recipe extraction may have failed.",
        "parsing-failed",
        true
      )
    }
  }

  /**
   * Create extraction metadata
   */
  private createExtractionMetadata(
    requestId: string,
    url: string,
    startTime: number
  ): ExtractionResult['metadata'] {
    return {
      requestId,
      url,
      duration: Date.now() - startTime,
      model: this.geminiClient.getModelInfo().model,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Log extraction attempt for monitoring
   */
  private logExtraction(
    metadata: ExtractionResult['metadata'],
    success: boolean,
    errorType?: string,
    errorMessage?: string
  ): void {
    const logData: RecipeExtractionLog = {
      requestId: metadata.requestId,
      url: metadata.url, // Note: In production, consider hashing or redacting URLs for privacy
      timestamp: metadata.timestamp,
      duration: metadata.duration,
      success,
      model: metadata.model,
      errorType,
      errorMessage,
    }

    if (success) {
      console.log(`✅ Recipe extraction successful:`, {
        requestId: logData.requestId,
        duration: `${logData.duration}ms`,
        model: logData.model,
      })
    } else {
      console.error(`❌ Recipe extraction failed:`, {
        requestId: logData.requestId,
        duration: `${logData.duration}ms`,
        model: logData.model,
        errorType: logData.errorType,
        errorMessage: logData.errorMessage,
      })
    }

    // In production, you might send this to a monitoring service
    // Example: await sendToMonitoringService(logData)
  }

  /**
   * Extract recipe from URL using Gemini API
   */
  async extractRecipe(
    url: string, 
    config: ExtractionConfig = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now()
    const requestId = config.requestId || uuidv4()
    
    // Check if service is initialized
    if (!this.isInitialized) {
      const metadata = this.createExtractionMetadata(requestId, url, startTime)
      this.logExtraction(metadata, false, "server", "Service not initialized")
      
      return {
        error: {
          type: "server",
          message: "Recipe extraction service is not available. Please try again later."
        },
        metadata
      }
    }

    try {
      // Validate URL
      const validatedUrl = validateRecipeUrl(url)
      
      // Create extraction prompt
      const prompt = getRecipeExtractionPrompt(validatedUrl, config.strategy)
      
      // Call Gemini API
      const responseText = await this.geminiClient.generateContent(prompt, requestId)
      
      // Parse and validate response
      const geminiResponse = this.parseGeminiResponse(responseText)
      
      const metadata = this.createExtractionMetadata(requestId, validatedUrl, startTime)

      // Handle successful recipe extraction
      if (geminiResponse.recipe) {
        const sanitizedRecipe = sanitizeRecipe(geminiResponse.recipe)
        this.logExtraction(metadata, true)
        
        return {
          recipe: sanitizedRecipe,
          metadata
        }
      }

      // Handle error response from Gemini
      if (geminiResponse.error) {
        this.logExtraction(metadata, false, geminiResponse.error.type, geminiResponse.error.message)
        
        return {
          error: {
            type: geminiResponse.error.type,
            message: geminiResponse.error.message
          },
          metadata
        }
      }

      // Should not reach here due to schema validation, but handle just in case
      throw new RecipeExtractionError(
        "Invalid response format from AI service",
        "parsing-failed",
        true
      )

    } catch (error) {
      const metadata = this.createExtractionMetadata(requestId, url, startTime)
      
      // Handle validation errors (invalid URL)
      if (error instanceof Error && error.name === "ZodError") {
        this.logExtraction(metadata, false, "invalid-url", error.message)
        
        return {
          error: {
            type: "invalid-url",
            message: "Please provide a valid URL starting with http:// or https://."
          },
          metadata
        }
      }

      // Handle Gemini API errors
      if (error instanceof GeminiError) {
        const mappedError = this.mapGeminiError(error)
        this.logExtraction(metadata, false, mappedError.type, mappedError.message)
        
        return {
          error: {
            type: mappedError.type,
            message: mappedError.message
          },
          metadata
        }
      }

      // Handle recipe extraction errors
      if (error instanceof RecipeExtractionError) {
        this.logExtraction(metadata, false, error.type, error.message)
        
        return {
          error: {
            type: error.type,
            message: error.message
          },
          metadata
        }
      }

      // Handle unexpected errors
      console.error("Unexpected error during recipe extraction:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logExtraction(metadata, false, "server", errorMessage)
      
      return {
        error: {
          type: "server",
          message: "An unexpected error occurred while processing the recipe. Please try again."
        },
        metadata
      }
    }
  }

  /**
   * Get service information
   */
  getServiceInfo(): {
    initialized: boolean
    model?: string
    timeout?: number
    maxRetries?: number
  } {
    if (!this.isInitialized) {
      return { initialized: false }
    }

    const modelInfo = this.geminiClient.getModelInfo()
    return {
      initialized: true,
      model: modelInfo.model,
      timeout: modelInfo.timeout,
      maxRetries: modelInfo.maxRetries,
    }
  }
}

/**
 * Singleton instance of the recipe extraction service
 */
export const recipeExtractionService = new RecipeExtractionService()
