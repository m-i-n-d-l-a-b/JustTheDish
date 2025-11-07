import { validateRecipeExtractionResponse } from "./schemas"

/**
 * Type guard to check if a value is a record (object with string keys)
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Type guard to check if parsed response has a recipe property
 */
function hasRecipeProperty(parsed: unknown): parsed is { recipe: unknown } & Record<string, unknown> {
  return isRecord(parsed) && "recipe" in parsed
}

/**
 * Type guard to check if recipe has steps array
 */
function hasStepsArray(recipe: unknown): recipe is { steps: unknown[] } & Record<string, unknown> {
  return isRecord(recipe) && "steps" in recipe && Array.isArray(recipe.steps)
}

/**
 * Type guard to check if recipe object exists and is a record
 */
function isRecipeRecord(recipe: unknown): recipe is Record<string, unknown> {
  return isRecord(recipe)
}

export function parseGroqRecipeResponse(responseText: string) {
  try {
    const text = responseText.trim()

    let parsed: unknown
    const firstBrace = text.indexOf("{")
    const lastBrace = text.lastIndexOf("}")
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1)
      try {
        parsed = JSON.parse(candidate)
      } catch {
        const unfenced = text
          .replace(/^```json\s*/i, "")
          .replace(/^```/i, "")
          .replace(/```\s*$/i, "")
          .trim()
        parsed = JSON.parse(unfenced)
      }
    } else {
      parsed = JSON.parse(text)
    }

    // Normalize steps if objects returned; do NOT modify ingredients
    if (hasRecipeProperty(parsed) && parsed.recipe && hasStepsArray(parsed.recipe)) {
      const steps = parsed.recipe.steps
      if (steps.length > 0 && typeof steps[0] === "object" && steps[0] !== null) {
        parsed.recipe.steps = steps.map((s: unknown) => {
          if (typeof s === "string") {
            return s
          }
          if (isRecord(s) && typeof s.step === "string") {
            return s.step
          }
          return JSON.stringify(s)
        })
      }
    }

    // Coerce null optional fields to undefined so schema optional() passes
    if (hasRecipeProperty(parsed) && parsed.recipe && isRecipeRecord(parsed.recipe)) {
      const r = parsed.recipe
      if (r && (r.servings === null || r.servings === "null")) delete r.servings
      if (r && (r.prepTime === null || r.prepTime === "null")) delete r.prepTime
      if (r && (r.cookTime === null || r.cookTime === "null")) delete r.cookTime
      if (r && (r.totalTime === null || r.totalTime === "null")) delete r.totalTime

      // Normalize common synonym keys emitted by models/sites
      // Map yield/yields/serves/makes -> servings (prefer original string form)
      if (r && r.servings == null) {
        const synonymServings = r.yield ?? r.yields ?? r.serves ?? r.makes ?? r.yieldCount
        if (typeof synonymServings === "string" && synonymServings.trim().length > 0) {
          r.servings = synonymServings
        } else if (typeof synonymServings === "number") {
          r.servings = String(synonymServings)
        }
      }

      // Map prep time variants -> prepTime
      if (r && r.prepTime == null) {
        const synonymPrep = r.prep_time ?? r.preparation_time ?? r.preparationTime ?? r.preptime
        if (typeof synonymPrep === "string" && synonymPrep.trim().length > 0) {
          r.prepTime = synonymPrep
        }
      }

      // Map cook time variants -> cookTime
      if (r && r.cookTime == null) {
        const synonymCook = r.cook_time ?? r.cooking_time ?? r.cookingTime
        if (typeof synonymCook === "string" && synonymCook.trim().length > 0) {
          r.cookTime = synonymCook
        }
      }

      // Map total time variants -> totalTime
      if (r && r.totalTime == null) {
        const synonymTotal = r.total_time ?? r.totaltime ?? r.total ?? r.totalDuration ?? r.total_duration
        if (typeof synonymTotal === "string" && synonymTotal.trim().length > 0) {
          r.totalTime = synonymTotal
        }
      }

      // Remove known synonym keys to avoid leaking extra properties before validation
      if (r) {
        delete r.yield
        delete r.yields
        delete r.yieldCount
        delete r.serves
        delete r.makes
        delete r.prep_time
        delete r.preparation_time
        delete r.preparationTime
        delete r.preptime
        delete r.cook_time
        delete r.cooking_time
        delete r.cookingTime
        delete r.total_time
        delete r.total_duration
        delete r.totalDuration
        delete r.totaltime
        delete r.total
      }
    }

    return validateRecipeExtractionResponse(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse Groq response: ${message}`)
  }
}



