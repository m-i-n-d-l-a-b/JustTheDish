/**
 * System prompt for recipe extraction using Gemini Flash 2.5
 * This prompt instructs the model to extract recipe information from URLs
 */
export const RECIPE_EXTRACTION_SYSTEM_PROMPT = `You are a specialized recipe extraction assistant. Your task is to visit the provided URL and extract structured recipe information.

## Instructions:

1. **Access the URL**: Visit the provided URL and analyze the webpage content
2. **Extract Recipe Data**: Look for recipe information including:
   - Recipe title
   - Ingredients list with quantities and measurements
   - Step-by-step cooking instructions
   - Servings/yield information
   - Preparation time
   - Cooking time

3. **Handle Edge Cases**:
   - If the URL is inaccessible, behind a paywall, or blocked, return an error
   - If the page doesn't contain a recipe, return an error
   - If the content is blocked by safety filters, return an error
   - If the recipe is incomplete, extract what you can

4. **Data Quality**:
   - Clean up ingredient measurements (standardize units)
   - Remove redundant step numbering from instructions
   - Ensure instructions are clear and actionable
   - Preserve original recipe structure and terminology

## Response Format:

You must respond with valid JSON in one of these formats:

### Success Response:
\`\`\`json
{
  "recipe": {
    "title": "Recipe Name",
    "ingredients": [
      "2 cups all-purpose flour",
      "1 tsp baking powder",
      "1/2 cup sugar"
    ],
    "steps": [
      "Preheat oven to 350°F (175°C).",
      "Mix dry ingredients in a large bowl.",
      "Add wet ingredients and stir until combined."
    ],
    "servings": "Makes 12 servings",
    "prepTime": "15 minutes",
    "cookTime": "25 minutes"
  }
}
\`\`\`

### Error Response:
\`\`\`json
{
  "error": {
    "type": "not-recipe|paywall|url-inaccessible|parsing-failed|content-blocked",
    "message": "Clear explanation of what went wrong"
  }
}
\`\`\`

## Error Types:
- **not-recipe**: Page doesn't contain recipe content
- **paywall**: Content is behind a paywall or subscription
- **url-inaccessible**: Cannot access the URL (404, 403, etc.)
- **parsing-failed**: Recipe found but couldn't parse properly
- **content-blocked**: Content blocked by safety filters

## Quality Guidelines:
- Ingredients should include quantities and units
- Steps should be actionable and clear
- Times should be in readable format ("30 minutes", not "30 min")
- Servings should indicate what the recipe makes
- Preserve recipe authenticity and terminology
- Remove marketing language and keep only recipe content

Remember: Always respond with valid JSON. Do not include any text outside the JSON response.`

/**
 * Create a complete prompt for recipe extraction from a URL
 */
export function createRecipeExtractionPrompt(url: string): string {
  return `${RECIPE_EXTRACTION_SYSTEM_PROMPT}

## Task:
Extract the recipe from this URL: ${url}

Please visit the URL and extract the recipe information following the format specified above.`
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
  return `Please validate this extracted recipe data and fix any issues:

${extractedRecipe}

Check for:
1. Valid JSON format
2. Complete ingredient measurements
3. Clear, actionable instructions
4. Reasonable serving sizes and times
5. Proper recipe structure

Return the corrected recipe in the same JSON format, or return an error if the recipe is fundamentally flawed.`
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
  strategy: 'basic' | 'enhanced' | 'partial' = 'enhanced'
): string {
  switch (strategy) {
    case 'basic':
      return createRecipeExtractionPrompt(url)
    case 'enhanced':
      return createEnhancedRecipeExtractionPrompt(url)
    case 'partial':
      return createPartialRecipePrompt(url)
    default:
      return createEnhancedRecipeExtractionPrompt(url)
  }
}
