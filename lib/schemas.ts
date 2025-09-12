import { z } from "zod"

/**
 * Schema for validating recipe extraction request input
 */
export const recipeExtractionRequestSchema = z.object({
  url: z
    .string()
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
      (url) => {
        // Basic validation to prevent obvious malicious URLs
        const lowerUrl = url.toLowerCase()
        return !lowerUrl.includes("localhost") && !lowerUrl.includes("127.0.0.1")
      },
      "URL cannot point to localhost or internal addresses"
    ),
})

/**
 * Provider selection for extraction API
 */
export const extractionProviderSchema = z.enum(["gemini", "groq"]).optional()

/**
 * Schema for validating API request body to extract a recipe
 */
export const extractionApiRequestSchema = z.object({
  url: recipeExtractionRequestSchema.shape.url,
  provider: extractionProviderSchema,
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
 * Schema for Gemini API response validation
 */
export const geminiRecipeResponseSchema = z.object({
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
 * Schema for validating Gemini API error responses
 */
export const geminiErrorSchema = z.object({
  error: z.object({
    code: z.number().optional(),
    message: z.string(),
    status: z.string().optional(),
    details: z.array(z.unknown()).optional(),
  }),
})

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
 * Type definitions derived from schemas
 */
export type RecipeExtractionRequest = z.infer<typeof recipeExtractionRequestSchema>
export type Recipe = z.infer<typeof recipeSchema>
export type GeminiRecipeResponse = z.infer<typeof geminiRecipeResponseSchema>
export type GeminiError = z.infer<typeof geminiErrorSchema>
export type RecipeExtractionLog = z.infer<typeof recipeExtractionLogSchema>

/**
 * Utility function to safely parse and validate recipe data
 */
export function validateRecipe(data: unknown): Recipe {
  return recipeSchema.parse(data)
}

/**
 * Utility function to safely parse and validate Gemini response
 */
export function validateGeminiResponse(data: unknown): GeminiRecipeResponse {
  return geminiRecipeResponseSchema.parse(data)
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
 * JSON schema (for Gemini structured output) mirroring geminiRecipeResponseSchema
 * This is used to request strict JSON from the model.
 */
export const geminiResponseJsonSchema = {
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