import { describe, it, expect } from "vitest"
import { GROQ_RECIPE_EXTRACTION_SYSTEM_PROMPT, createGroqRecipeExtractionPrompt, createGroqRecipeValidationPrompt } from "../lib/groq-prompts"

describe("groq-prompts", () => {
  it("system prompt enforces verbatim ingredients and simplified steps", () => {
    const sys = GROQ_RECIPE_EXTRACTION_SYSTEM_PROMPT
    expect(sys).toMatch(/Ingredients: return the list verbatim/i)
    expect(sys).toMatch(/Steps: simplify and clarify only/i)
  })

  it("extraction prompt includes the URL", () => {
    const p = createGroqRecipeExtractionPrompt("https://example.com/x")
    expect(p).toMatch(/https:\/\/example.com\/x/)
  })

  it("validation prompt repeats verbatim rule", () => {
    const v = createGroqRecipeValidationPrompt("{\"recipe\":{}}");
    expect(v).toMatch(/Ingredients MUST be copied verbatim/i)
  })
})





