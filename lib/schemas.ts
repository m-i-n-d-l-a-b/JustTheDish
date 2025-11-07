import { z } from "zod"

/**
 * Check if an IP address is in a private range
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  if (/^10\./.test(ip)) return true
  if (/^192\.168\./.test(ip)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true
  if (/^127\./.test(ip)) return true
  if (/^169\.254\./.test(ip)) return true // Link-local
  if (ip === "::1" || ip === "localhost") return true
  return false
}

/**
 * Extract hostname from URL and check if it's a private/local address
 */
function isPrivateOrLocalhost(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    
    // Check for localhost variants
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true
    }
    
    // Check for private IP ranges
    if (isPrivateIP(hostname)) {
      return true
    }
    
    // Check for .local domains
    if (hostname.endsWith(".local")) {
      return true
    }
    
    return false
  } catch {
    return false
  }
}

/**
 * Schema for validating recipe extraction request input
 */
export const recipeExtractionRequestSchema = z.object({
  url: z
    .string()
    .max(2048, "URL is too long (maximum 2048 characters)")
    .url("Must be a valid URL")
    .refine(
      (url) => {
        try {
          const urlObj = new URL(url)
          return urlObj.protocol === "http:" || urlObj.protocol === "https:"
        } catch {
          return false
        }
      },
      "URL must use HTTP or HTTPS protocol"
    )
    .refine(
      (url) => !isPrivateOrLocalhost(url),
      "URL cannot point to localhost or private/internal addresses"
    ),
})

/**
 * Schema for validating API request body to extract a recipe
 */
export const extractionApiRequestSchema = z.object({
  url: recipeExtractionRequestSchema.shape.url,
})

/**
 * Schema for validating individual recipe ingredients
 */
export const ingredientSchema = z
  .string()
  .min(1, "Ingredient cannot be empty")
  .max(500, "Ingredient description too long")
  .refine(
    (ingredient) => ingredient.trim().length > 0,
    "Ingredient cannot be just whitespace"
  )

/**
 * Schema for validating individual recipe steps
 */
export const recipeStepSchema = z
  .string()
  .min(5, "Recipe step must be at least 5 characters")
  .max(2000, "Recipe step too long")
  .refine(
    (step) => step.trim().length >= 5,
    "Recipe step must contain meaningful content"
  )

/**
 * Schema for validating time strings (e.g., "30 minutes", "1 hour 15 minutes")
 */
export const timeStringSchema = z
  .string()
  .max(100, "Time description too long")
  .optional()
  .refine(
    (time) => {
      if (!time) return true
      const t = time.trim()
      const timePattern = new RegExp(
        [
          '^(?:about\\s+|approx(?:\\.|imately)?\\s+|around\\s+|~\\s*)?\\d+\\s*(?:hour|hr|minute|min|second|sec)s?(?:\\s+\\d+\\s*(?:hour|hr|minute|min|second|sec)s?)?(?:\\s+per\\s+[a-z]+(?:\\s+[a-z]+)*)?$',
          '^(?:about\\s+|approx(?:\\.|imately)?\\s+|around\\s+|~\\s*)?\\d+\\s*[-–]\\s*\\d+\\s*(?:hour|hr|minute|min|second|sec)s?(?:\\s+per\\s+[a-z]+(?:\\s+[a-z]+)*)?$',
          '^\\d+:\\d{1,2}$',
          // ISO 8601 durations like PT30M, PT1H20M, P1DT2H
          '^P(?:\\d+W)?(?:\\d+D)?(?:T(?:\\d+H)?(?:\\d+M)?(?:\\d+S)?)?$'
        ].join('|'),
        'i'
      )
      return timePattern.test(t)
    },
    "Time must be valid (e.g., '30 minutes', '10-12 minutes', '1:30', or ISO 8601 like 'PT30M')"
  )

/**
 * Schema for validating serving information
 */
export const servingsSchema = z
  .string()
  .max(100, "Servings description too long")
  .optional()
  .refine(
    (servings) => {
      if (!servings) return true
      // Allow various formats: "4 servings", "Serves 6", "Makes 12 cookies", etc.
      return servings.trim().length > 0
    },
    "Servings must contain meaningful information"
  )

/**
 * Core recipe schema matching the existing Recipe interface
 */
export const recipeSchema = z.object({
  title: z
    .string()
    .min(1, "Recipe title is required")
    .max(200, "Recipe title too long")
    .refine(
      (title) => title.trim().length > 0,
      "Recipe title cannot be just whitespace"
    ),
  
  ingredients: z
    .array(ingredientSchema)
    .min(1, "Recipe must have at least one ingredient")
    .max(50, "Too many ingredients (maximum 50)"),
  
  steps: z
    .array(recipeStepSchema)
    .min(1, "Recipe must have at least one step")
    .max(30, "Too many steps (maximum 30)")
    .refine(
      (steps) => steps.every((step, index) => 
        !step.toLowerCase().includes(`step ${index + 1}`) || 
        step.toLowerCase().includes(`step ${index + 1}:`) ||
        step.toLowerCase().includes(`${index + 1}.`)
      ),
      "Steps should not redundantly include step numbers"
    ),
  
  servings: servingsSchema,
  cookTime: timeStringSchema,
  prepTime: timeStringSchema,
  totalTime: timeStringSchema,
})

/**
 * Schema for recipe extraction API response validation
 */
export const recipeExtractionResponseSchema = z.object({
  recipe: recipeSchema.optional(),
  error: z.object({
    type: z.enum([
      "not-recipe",
      "paywall", 
      "url-inaccessible",
      "parsing-failed",
      "content-blocked"
    ]),
    message: z.string().min(1),
  }).optional(),
}).refine(
  (data) => data.recipe || data.error,
  "Response must contain either a recipe or an error"
)

/**
 * Schema for logging and monitoring data
 */
export const recipeExtractionLogSchema = z.object({
  requestId: z.string().uuid(),
  url: z.string().url(),
  timestamp: z.string().datetime(),
  duration: z.number().min(0),
  success: z.boolean(),
  model: z.string(),
  tokensUsed: z.number().min(0).optional(),
  errorType: z.string().optional(),
  errorMessage: z.string().optional(),
})

/**
 * Recipe error type matching all possible error types from the API
 */
export type RecipeError = {
  type: "invalid-url" | "not-recipe" | "paywall" | "network" | "rate-limit" | "server" | "url-inaccessible" | "parsing-failed" | "content-blocked" | "ai-unavailable" | "quota-exceeded"
  message: string
}

/**
 * Type definitions derived from schemas
 */
export type RecipeExtractionRequest = z.infer<typeof recipeExtractionRequestSchema>
export type Recipe = z.infer<typeof recipeSchema>
export type RecipeExtractionResponse = z.infer<typeof recipeExtractionResponseSchema>
export type RecipeExtractionLog = z.infer<typeof recipeExtractionLogSchema>

/**
 * Utility function to safely parse and validate recipe data
 */
export function validateRecipe(data: unknown): Recipe {
  return recipeSchema.parse(data)
}

/**
 * Utility function to safely parse and validate recipe extraction response
 */
export function validateRecipeExtractionResponse(data: unknown): RecipeExtractionResponse {
  return recipeExtractionResponseSchema.parse(data)
}

/**
 * Utility function to validate URL input
 */
export function validateRecipeUrl(url: string): string {
  const result = recipeExtractionRequestSchema.parse({ url })
  return result.url
}

/**
 * Utility function to sanitize recipe data before storing/displaying
 */
export function sanitizeRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    title: recipe.title.trim(),
    // Preserve ingredients exactly as written; do not trim or normalize
    ingredients: recipe.ingredients,
    // Keep steps readable by trimming leading/trailing whitespace only
    steps: recipe.steps.map(step => step.trim()),
    servings: recipe.servings?.trim() || undefined,
    cookTime: normalizeTime(recipe.cookTime),
    prepTime: normalizeTime(recipe.prepTime),
    totalTime: normalizeTime(recipe.totalTime),
  }
}

function normalizeTime(value?: string): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  // Humanize ISO 8601 to words
  try {
    // Lazy import to avoid circular deps in tests
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { isIso8601Duration, formatIsoDurationToHuman } = require("./utils") as {
      isIso8601Duration: (v: string) => boolean
      formatIsoDurationToHuman: (v: string) => string | null
    }
    if (isIso8601Duration(trimmed)) {
      const human = formatIsoDurationToHuman(trimmed)
      return human || trimmed
    }
  } catch {
    // ignore, fall back to trimmed
  }
  return trimmed || undefined
}

/**
 * JSON schema for recipe extraction response (structured output)
 * This is used to request strict JSON from the model.
 */
export const recipeExtractionResponseJsonSchema = {
  type: "object",
  properties: {
    recipe: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        ingredients: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 500 },
          minItems: 1,
          maxItems: 50,
        },
        steps: {
          type: "array",
          items: { type: "string", minLength: 5, maxLength: 2000 },
          minItems: 1,
          maxItems: 30,
        },
        servings: { type: "string" },
        cookTime: { type: "string" },
        prepTime: { type: "string" },
        totalTime: { type: "string" },
      },
      required: ["title", "ingredients", "steps"],
      additionalProperties: false,
    },
    error: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "not-recipe",
            "paywall",
            "url-inaccessible",
            "parsing-failed",
            "content-blocked",
          ],
        },
        message: { type: "string", minLength: 1 },
      },
      required: ["type", "message"],
      additionalProperties: false,
    },
  },
  additionalProperties: false,
  oneOf: [
    { required: ["recipe"] },
    { required: ["error"] },
  ],
} as const