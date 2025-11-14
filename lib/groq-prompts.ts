export const GROQ_RECIPE_EXTRACTION_SYSTEM_PROMPT = `You extract structured recipe data and return strict JSON.

Rules (be concise, never guess):
- Prefer the JSON-LD provided in system context (if present). Copy recipeIngredient EXACTLY (array of strings). Copy time fields as-is (including ISO 8601 like PT30M). If JSON-LD is not provided, copy the visible ingredient list textContent exactly as rendered.
- Output ONLY valid JSON: either {"recipe": {...}} or {"error": {"type": "...", "message": "..."}}.
- Required in recipe: title (string), ingredients (string[]), steps (string[]).
- Optional: servings, prepTime, cookTime, totalTime (strings). Leave out if unknown.
- Normalize synonymous labels BEFORE output:
  - "yield"/"yields"/"serves"/"makes" -> servings (string)
  - "prep_time"/"preparation_time"/"preparationTime"/"preptime" -> prepTime (string)
  - "cook_time"/"cooking_time"/"cookingTime" -> cookTime (string)
  - "total_time"/"totalTime"/"total"/"totalDuration" -> totalTime (string)
- Times: never estimate or convert. Only include if certain. Otherwise omit.
- If the source only provides Total Time (and not separate Prep or Cook), set only totalTime and DO NOT output prepTime or cookTime.
- Ingredients: return the list verbatim as written (one string per line). Preserve wording, order, punctuation, capitalization, and WHITESPACE exactly as rendered. Do not concatenate tokens; keep spaces between numbers, units, and words (e.g., "1 cup sugar", not "1cupsugar"). Do not paraphrase, merge, split, convert, or normalize units. No additions or removals.
- Steps: simplify and clarify only; remove redundant numbering/fluff without changing meaning.

Allowed error types: not-recipe | paywall | url-inaccessible | parsing-failed | content-blocked.`;

export function createGroqRecipeExtractionPrompt(url: string): string {
  return `${GROQ_RECIPE_EXTRACTION_SYSTEM_PROMPT}

Task: Extract a recipe for URL: ${url}
- If you cannot reliably determine recipe content, return an appropriate error.
- Respond with JSON only.`;
}

export function createGroqRecipeValidationPrompt(extractedRecipe: string): string {
  return `Validate this extracted recipe JSON and correct only if needed:

${extractedRecipe}

Requirements:
1. JSON must be valid and match the expected schema.
2. Ingredients MUST be copied verbatim from the source list: preserve wording, order, punctuation, capitalization, and WHITESPACE. Do NOT remove spaces between numbers, units, and words. Do NOT paraphrase, merge, split, convert, or normalize units.
3. Instructions may be simplified for clarity only; do not change meaning. Remove redundant numbering/fluff.
4. Optional fields (servings/prepTime/cookTime/totalTime) only if certain.
5. If the source does not list separate Prep or Cook labels (or JSON-LD lacks prepTime/cookTime), do not infer them; keep only totalTime if available.

If any ingredient lines appear concatenated (e.g., "1cup" or "2tablespoons" stuck to following words), re-visit the page content and:
- FIRST, look for schema.org JSON-LD and copy "recipeIngredient" exactly; or
- OTHERWISE, re-copy from the visible ingredient list LITERALLY with exact spacing.

Return the corrected JSON, or an error object if the recipe is fundamentally flawed.`;
}

export function createGroqRecipeTimesValidationPrompt(
  url: string,
  extractedRecipe: string
): string {
  return `Validate and correct ONLY the time fields for this recipe JSON.

URL: ${url}

JSON:
${extractedRecipe}

Rules:
- Do not change title, ingredients, or steps.
- Times must match the source exactly; never infer.
- If the page or JSON-LD provides only Total Time, REMOVE prepTime and cookTime. Keep totalTime only.
- If separate Prep or Cook times are explicitly present on the page or in JSON-LD, keep them as-is.

Return JSON only.`;
}

export function createGroqRecipeStepsSimplificationPrompt(extractedRecipe: string): string {
  return `Rewrite ONLY the steps in this recipe JSON to be concise while preserving order and meaning.

JSON:
${extractedRecipe}

Rules:
- Do NOT change title, ingredients, or any time fields.
- Keep the same number of steps and the same order.
- Use clear, direct, imperative sentences; remove filler and redundant phrasing.
- Combine trivial fragments; avoid over-explaining obvious actions.
- Keep measurements and key actions intact.

Return JSON only.`;
}
