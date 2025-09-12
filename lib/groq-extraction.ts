import { v4 as uuidv4 } from "uuid"
import { GroqClient } from "./groq-client"
import { createGroqRecipeExtractionPrompt, createGroqRecipeValidationPrompt, createGroqRecipeTimesValidationPrompt } from "./groq-prompts"
import { parseGroqRecipeResponse } from "./groq-response"
import { 
  validateRecipeUrl,
  sanitizeRecipe,
  type Recipe,
  type GeminiRecipeResponse,
  type RecipeExtractionLog,
} from "./schemas"
import { getEnv } from "./env"
import { GroqError, GroqRateLimitError, GroqQuotaError, GroqContentBlockedError } from "./groq-errors"

class GroqRecipeExtractionError extends Error {
  constructor(
    message: string,
    public type: "invalid-url" | "not-recipe" | "paywall" | "url-inaccessible" | "parsing-failed" | "content-blocked" | "ai-unavailable" | "quota-exceeded" | "server",
    public retryable: boolean = false
  ) {
    super(message)
    this.name = "GroqRecipeExtractionError"
  }
}

interface ExtractionConfig {
  strategy?: "basic"
  requestId?: string
}

interface ExtractionResult {
  recipe?: Recipe
  error?: {
    type: GroqRecipeExtractionError["type"]
    message: string
  }
  metadata: {
    requestId: string
    url: string
    duration: number
    model: string
    timestamp: string
    provider: "groq"
  }
}

export class GroqRecipeExtractionService {
  private client!: GroqClient
  private isInitialized = false

  constructor() {
    try {
      this.client = new GroqClient()
      this.isInitialized = true
    } catch (error) {
      console.error("Failed to initialize Groq client:", error)
      this.isInitialized = false
    }
  }

  isReady(): boolean {
    return this.isInitialized
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isInitialized) return false
    try {
      await this.client.chatCompletionsCreate({
        messages: [{ role: "user", content: "Respond with: OK" }],
        userAgent: "just-the-dish/healthcheck",
      })
      return true
    } catch {
      return false
    }
  }

  getServiceInfo(): { initialized: boolean; model?: string } {
    return { initialized: this.isInitialized, model: undefined }
  }

  private createMetadata(requestId: string, url: string, start: number): ExtractionResult["metadata"] {
    return {
      requestId,
      url,
      duration: Date.now() - start,
      model: "groq-model",
      timestamp: new Date().toISOString(),
      provider: "groq",
    }
  }

  private mapGroqError(error: GroqError): GroqRecipeExtractionError {
    if (error instanceof GroqContentBlockedError) {
      return new GroqRecipeExtractionError(
        "The content at this URL was blocked by safety filters. Please try a different recipe URL.",
        "content-blocked",
        false
      )
    }
    if (error instanceof GroqQuotaError) {
      return new GroqRecipeExtractionError(
        "API quota exceeded. Please try again later or contact support.",
        "quota-exceeded",
        false
      )
    }
    if (error instanceof GroqRateLimitError) {
      return new GroqRecipeExtractionError(
        "Too many requests. Please wait a moment and try again.",
        "ai-unavailable",
        true
      )
    }
    const retryable = (error.code ?? 0) >= 500
    return new GroqRecipeExtractionError(
      error.retryable ? "Temporary AI service error. Please try again." : "AI service error occurred. Please try again later.",
      "ai-unavailable",
      retryable
    )
  }

  private log(metadata: ExtractionResult["metadata"], success: boolean, errorType?: string, errorMessage?: string): void {
    const logData: RecipeExtractionLog = {
      requestId: metadata.requestId,
      url: metadata.url,
      timestamp: metadata.timestamp,
      duration: metadata.duration,
      success,
      model: metadata.model,
      errorType,
      errorMessage,
    }
    if (success) {
      console.log("✅ Groq extraction successful:", { requestId: logData.requestId, duration: `${logData.duration}ms` })
    } else {
      console.error("❌ Groq extraction failed:", { requestId: logData.requestId, errorType, errorMessage })
    }
  }

  async extractRecipe(url: string, config: ExtractionConfig = {}): Promise<ExtractionResult> {
    const start = Date.now()
    const requestId = config.requestId || uuidv4()

    if (!this.isInitialized) {
      const metadata = this.createMetadata(requestId, url, start)
      this.log(metadata, false, "server", "Service not initialized")
      return { error: { type: "server", message: "Recipe extraction service is not available. Please try again later." }, metadata }
    }

    try {
      const validatedUrl = validateRecipeUrl(url)
      const prompt = createGroqRecipeExtractionPrompt(validatedUrl)
      const response = await this.client.chatCompletionsCreate({
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: `Extract the recipe for: ${validatedUrl}` },
        ],
        requestId,
        userAgent: "just-the-dish/recipe-extraction",
      })

      const parsed: GeminiRecipeResponse = parseGroqRecipeResponse(response.text)
      const metadata = this.createMetadata(requestId, validatedUrl, start)

      if (parsed.recipe) {
        const firstPass = sanitizeRecipe(parsed.recipe)
        const env = getEnv()
        // Detect likely spacing issues like "1cupsugar" and try a focused second pass
        if (hasIngredientSpacingIssues(firstPass.ingredients) && getEnv().GROQ_REPAIR_INGREDIENT_SPACING) {
          try {
            const validationPrompt = createGroqRecipeValidationPrompt(JSON.stringify({ recipe: firstPass }))
            const validationResponse = await this.client.chatCompletionsCreate({
              messages: [
                { role: "system", content: validationPrompt },
                { role: "user", content: `URL: ${validatedUrl}\nFix only ingredient spacing as per instructions. Return JSON only.` },
              ],
              userAgent: "just-the-dish/recipe-extraction-validate",
            })
            const reparsed: GeminiRecipeResponse = parseGroqRecipeResponse(validationResponse.text)
            if (reparsed.recipe) {
              const secondPass = sanitizeRecipe(reparsed.recipe)
              // Optional minimal, deterministic repair: insert a space between digits and letters when missing
              if (env.GROQ_REPAIR_INGREDIENT_SPACING) {
                secondPass.ingredients = repairIngredientSpacing(secondPass.ingredients)
              }
              this.log(metadata, true)
              return { recipe: secondPass, metadata }
            }
          } catch (e) {
            // Ignore and fall back to first pass
          }
          // If second pass is enabled but didn't yield better result, optionally apply minimal repair to first pass
          if (env.GROQ_REPAIR_INGREDIENT_SPACING) {
            firstPass.ingredients = repairIngredientSpacing(firstPass.ingredients)
          }
        }
        // Times validation pass: if totalTime exists and prep/cook are missing in source, remove inferred ones
        try {
          if (firstPass.totalTime) {
            const timesPrompt = createGroqRecipeTimesValidationPrompt(validatedUrl, JSON.stringify({ recipe: firstPass }))
            const timesResponse = await this.client.chatCompletionsCreate({
              messages: [
                { role: "system", content: timesPrompt },
                { role: "user", content: `Ensure time fields reflect the page or JSON-LD exactly. Return JSON only.` },
              ],
              userAgent: "just-the-dish/recipe-extraction-validate-times",
              requestId,
            })
            const timesParsed: GeminiRecipeResponse = parseGroqRecipeResponse(timesResponse.text)
            if (timesParsed.recipe) {
              const timesFixed = sanitizeRecipe(timesParsed.recipe)
              this.log(metadata, true)
              return { recipe: timesFixed, metadata }
            }
          }
        } catch {
          // ignore and use first pass
        }

        this.log(metadata, true)
        return { recipe: firstPass, metadata }
      }

      if (parsed.error) {
        this.log(metadata, false, parsed.error.type, parsed.error.message)
        return { error: { type: parsed.error.type, message: parsed.error.message }, metadata }
      }

      throw new GroqRecipeExtractionError("Invalid response format from AI service", "parsing-failed", true)
    } catch (error) {
      const metadata = this.createMetadata(requestId, url, start)

      if (error instanceof Error && error.name === "ZodError") {
        this.log(metadata, false, "invalid-url", error.message)
        return { error: { type: "invalid-url", message: "Please provide a valid URL starting with http:// or https://." }, metadata }
      }
      if (error instanceof GroqError) {
        const mapped = this.mapGroqError(error)
        this.log(metadata, false, mapped.type, mapped.message)
        return { error: { type: mapped.type, message: mapped.message }, metadata }
      }
      if (error instanceof GroqRecipeExtractionError) {
        this.log(metadata, false, error.type, error.message)
        return { error: { type: error.type, message: error.message }, metadata }
      }

      console.error("Unexpected error during Groq extraction:", error)
      const message = error instanceof Error ? error.message : String(error)
      this.log(metadata, false, "server", message)
      return { error: { type: "server", message: "An unexpected error occurred while processing the recipe. Please try again." }, metadata }
    }
  }

}

function hasIngredientSpacingIssues(ingredients: string[]): boolean {
  const suspicious = /\d+[a-zA-Z]/ // digit immediately followed by a letter
  return ingredients.some(line => suspicious.test(line))
}

function repairIngredientSpacing(ingredients: string[]): string[] {
  // Insert a space between a digit and a following letter when there is none
  // e.g., "2cups" -> "2 cups" ; "1tablespoon" -> "1 tablespoon"
  return ingredients.map(line => line.replace(/(\d)(?=[a-zA-Z])/g, "$1 "))
}

export const groqRecipeExtractionService = new GroqRecipeExtractionService()



