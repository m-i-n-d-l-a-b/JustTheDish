/**
 * System prompt for recipe extraction using Gemini Flash 2.5
 * This prompt instructs the model to extract recipe information from URLs
 */
export const RECIPE_EXTRACTION_SYSTEM_PROMPT = `You extract structured recipe data and return strict JSON.

Rules (be concise, never guess):
- Use the URL Context tool to fetch and read the page content for the provided URL. If a field is not clearly known even after visiting, omit it.
- Output ONLY valid JSON: either {"recipe": {...}} or {"error": {"type": "...", "message": "..."}}.
- Required in recipe: title (string), ingredients (string[]), steps (string[]).
- Optional: servings, prepTime, cookTime, totalTime (strings). Leave out if unknown.
- Times: never estimate or convert. Only include if certain. Otherwise omit. If the source provides only Total Time, set only totalTime and do NOT output prepTime or cookTime.
- Ingredients: return the list VERBATIM as written (one string per line). Preserve wording, order, punctuation, capitalization, and WHITESPACE exactly as rendered. Do not paraphrase, merge, split, convert, or normalize units. No additions or removals.
- Prefer schema.org JSON-LD if present: copy recipeIngredient exactly (array of strings) and time fields as-is (including ISO 8601 like PT30M). If JSON-LD is absent, copy the visible ingredient list textContent exactly.
- Steps: simplify and clarify only; remove redundant numbering/fluff without changing meaning.

Allowed error types: not-recipe | paywall | url-inaccessible | parsing-failed | content-blocked.`

/**
 * Create a complete prompt for recipe extraction from a URL
 */
export function createRecipeExtractionPrompt(url: string): string {
  return `${RECIPE_EXTRACTION_SYSTEM_PROMPT}

Task: Extract a recipe for URL: ${url}
- If you cannot reliably determine recipe content, return an appropriate error.
- Respond with JSON only.`
}

/**
 * Few-shot examples to improve extraction consistency
 */
export const RECIPE_EXTRACTION_EXAMPLES = [
  {
    description: "Successful recipe extraction",
    input: "https://example.com/chocolate-chip-cookies",
    output: {
      recipe: {
        title: "Classic Chocolate Chip Cookies",
        ingredients: [
          "2¼ cups all-purpose flour",
          "1 tsp baking soda",
          "1 tsp salt",
          "1 cup (2 sticks) butter, softened",
          "¾ cup granulated sugar",
          "¾ cup packed brown sugar",
          "2 large eggs",
          "2 tsp vanilla extract",
          "2 cups chocolate chips"
        ],
        steps: [
          "Preheat oven to 375°F (190°C).",
          "In a medium bowl, whisk together flour, baking soda, and salt. Set aside.",
          "In a large bowl, cream together softened butter and both sugars until light and fluffy, about 2-3 minutes.",
          "Beat in eggs one at a time, then add vanilla extract.",
          "Gradually mix in the flour mixture until just combined.",
          "Fold in chocolate chips with a wooden spoon or spatula.",
          "Drop rounded tablespoons of dough onto ungreased baking sheets, spacing them 2 inches apart.",
          "Bake for 9-11 minutes or until golden brown around the edges.",
          "Cool on baking sheet for 2 minutes, then transfer to a wire rack."
        ],
        servings: "Makes 48 cookies",
        prepTime: "15 minutes",
        cookTime: "9-11 minutes per batch"
      }
    }
  },
  {
    description: "Non-recipe page error",
    input: "https://example.com/cooking-blog-about-kitchen-tools",
    output: {
      error: {
        type: "not-recipe",
        message: "This page contains cooking tips and kitchen tool reviews, but no recipe with ingredients and instructions."
      }
    }
  },
  {
    description: "Paywall error",
    input: "https://premium-cooking.com/exclusive-recipe",
    output: {
      error: {
        type: "paywall",
        message: "This recipe is behind a paywall and requires a subscription to access the full content."
      }
    }
  }
]

/**
 * Enhanced prompt with few-shot examples for better performance
 */
export function createEnhancedRecipeExtractionPrompt(url: string): string {
  const examples = RECIPE_EXTRACTION_EXAMPLES
    .map(example => `
### Example:
URL: ${example.input}
Response: ${JSON.stringify(example.output, null, 2)}`)
    .join('\n')

  return `${RECIPE_EXTRACTION_SYSTEM_PROMPT}

## Examples:
${examples}

## Your Task:
Extract the recipe from this URL: ${url}

Please visit the URL and extract the recipe information following the exact format shown in the examples above.`
}

/**
 * Validation prompt to double-check extracted recipes
 */
export function createRecipeValidationPrompt(extractedRecipe: string): string {
  return `Validate this extracted recipe JSON and correct only if needed:

${extractedRecipe}

Requirements:
1. JSON must be valid and match the expected schema.
2. Ingredients MUST be copied verbatim from the source list: preserve wording, order, punctuation, and capitalization. Do NOT paraphrase, merge, split, convert, or normalize units.
3. Instructions may be simplified for clarity only; do not change meaning. Remove redundant numbering/fluff.
4. Optional fields (servings/prepTime/cookTime) only if certain.

Return the corrected JSON, or an error object if the recipe is fundamentally flawed.`
}

/**
 * Prompt for handling partial or incomplete recipes
 */
export function createPartialRecipePrompt(url: string): string {
  return `The URL ${url} appears to contain recipe information, but it may be incomplete or scattered across the page.

Please extract whatever recipe information you can find and indicate what's missing. Even partial recipe data is valuable.

If you find:
- Only ingredients: Extract them and note missing instructions
- Only instructions: Extract them and note missing ingredients  
- Partial information: Extract what's available

Use this JSON format for partial recipes:
\`\`\`json
{
  "recipe": {
    "title": "Recipe Name (if available)",
    "ingredients": ["list", "if", "available"],
    "steps": ["list", "if", "available"],
    "servings": "if available",
    "prepTime": "if available", 
    "cookTime": "if available",
    "notes": "What information is missing or unclear"
  }
}
\`\`\`

Or return an error if truly no recipe content exists.`
}

/**
 * Get the appropriate prompt based on extraction strategy
 */
export function getRecipeExtractionPrompt(
  url: string, 
  strategy: 'basic' | 'enhanced' | 'partial' = 'basic'
): string {
  switch (strategy) {
    case 'basic':
      return createRecipeExtractionPrompt(url)
    case 'enhanced':
      return createEnhancedRecipeExtractionPrompt(url)
    case 'partial':
      return createPartialRecipePrompt(url)
    default:
      return createRecipeExtractionPrompt(url)
  }
}
