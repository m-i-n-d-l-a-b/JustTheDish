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
      // Basic validation for time format
      const timePattern = new RegExp(
        [
          // Single or compound duration: "1 hour", "1 hour 15 minutes", optional qualifiers and per-phrases
          '^(?:about\\s+|approx(?:\\.|imately)?\\s+|around\\s+|~\\s*)?\\d+\\s*(?:hour|hr|minute|min|second|sec)s?(?:\\s+\\d+\\s*(?:hour|hr|minute|min|second|sec)s?)?(?:\\s+per\\s+[a-z]+(?:\\s+[a-z]+)*)?$',
          // Range duration: "10-12 minutes" or with en dash and optional per-phrase
          '^(?:about\\s+|approx(?:\\.|imately)?\\s+|around\\s+|~\\s*)?\\d+\\s*[-–]\\s*\\d+\\s*(?:hour|hr|minute|min|second|sec)s?(?:\\s+per\\s+[a-z]+(?:\\s+[a-z]+)*)?$',
          // Clock format: "1:30"
          '^\\d+:\\d{1,2}$'
        ].join('|'),
        'i'
      )
      return timePattern.test(time.trim())
    },
    "Time must be in a valid format (e.g., '30 minutes', '1 hour 15 minutes', '10-12 minutes', '1:30')"
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
    cookTime: recipe.cookTime?.trim() || undefined,
    prepTime: recipe.prepTime?.trim() || undefined,
  }
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