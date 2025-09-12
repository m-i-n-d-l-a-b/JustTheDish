import { validateGeminiResponse } from "./schemas"

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
    if (
      parsed && typeof parsed === "object" &&
      "recipe" in (parsed as any) &&
      (parsed as any).recipe &&
      Array.isArray((parsed as any).recipe.steps)
    ) {
      const steps = (parsed as any).recipe.steps
      if (steps.length > 0 && typeof steps[0] === "object" && steps[0] !== null) {
        ;(parsed as any).recipe.steps = steps.map((s: any) => typeof s === "string" ? s : (typeof s?.step === "string" ? s.step : JSON.stringify(s)))
      }
    }

    // Coerce null optional fields to undefined so schema optional() passes
    if (
      parsed && typeof parsed === "object" &&
      "recipe" in (parsed as any) && (parsed as any).recipe
    ) {
      const r = (parsed as any).recipe
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

    return validateGeminiResponse(parsed)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse Groq response: ${message}`)
  }
}



