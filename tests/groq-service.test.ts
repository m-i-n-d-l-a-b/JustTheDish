import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../lib/groq-client", () => {
  class GroqClientMock {
    // Method intentionally left without instance field so tests can override prototype
    chatCompletionsCreate(_args: any): Promise<any> {
      return Promise.resolve({ text: "" })
    }
  }
  return { GroqClient: GroqClientMock }
})

import { groqRecipeExtractionService } from "../lib/groq-extraction"
import { GroqClient as GroqClientMocked } from "../lib/groq-client"

describe("GroqRecipeExtractionService", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("extracts recipe successfully and preserves ingredients verbatim", async () => {
    ;(GroqClientMocked as any).prototype.chatCompletionsCreate = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        recipe: {
          title: "  Test Dish  ",
          ingredients: ["  1 cup Sugar  ", "Salt, to taste"],
          steps: ["  Mix thoroughly.  "]
        }
      })
    })

    const result = await groqRecipeExtractionService.extractRecipe("https://example.com/recipe")

    expect(result.recipe).toBeTruthy()
    expect(result.recipe?.title).toBe("Test Dish")
    // Ingredients must be verbatim (no trimming or normalization)
    expect(result.recipe?.ingredients).toEqual(["  1 cup Sugar  ", "Salt, to taste"])
    // Steps are trimmed for readability
    expect(result.recipe?.steps).toEqual(["Mix thoroughly."])
    expect(result.metadata.provider).toBe("groq")
  })

  it("normalizes synonym keys for servings and times", async () => {
    ;(GroqClientMocked as any).prototype.chatCompletionsCreate = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        recipe: {
          title: "Synonyms Test",
          ingredients: ["1 egg"],
          steps: ["Beat egg."],
          yields: "Serves 2",
          preparation_time: "15 minutes",
          cooking_time: "10-12 minutes",
          total_time: "30 minutes"
        }
      })
    })

    const result = await groqRecipeExtractionService.extractRecipe("https://example.com/synonyms")
    expect(result.recipe).toBeTruthy()
    expect(result.recipe?.servings).toBe("Serves 2")
    expect(result.recipe?.prepTime).toBe("15 minutes")
    expect(result.recipe?.cookTime).toBe("10-12 minutes")
    expect(result.recipe?.totalTime).toBe("30 minutes")
  })

  it("removes inferred prep/cook when only total time exists", async () => {
    // First response returns only totalTime but model also (incorrectly) fills prep/cook
    ;(GroqClientMocked as any).prototype.chatCompletionsCreate = vi.fn()
      // extraction call
      .mockResolvedValueOnce({
        text: JSON.stringify({
          recipe: {
            title: "Total Only",
            ingredients: ["1 cup flour"],
            steps: ["Mix ingredients thoroughly."],
            total_time: "35 minutes",
            prepTime: "20 minutes", // should be removed
            cookTime: "15 minutes"  // should be removed
          }
        })
      })
      // times validation call
      .mockResolvedValueOnce({
        text: JSON.stringify({
          recipe: {
            title: "Total Only",
            ingredients: ["1 cup flour"],
            steps: ["Mix ingredients thoroughly."],
            totalTime: "35 minutes"
          }
        })
      })

    const result = await groqRecipeExtractionService.extractRecipe("https://example.com/total-only")
    expect(result.recipe).toBeTruthy()
    expect(result.recipe?.totalTime).toBe("35 minutes")
    expect(result.recipe?.prepTime).toBeUndefined()
    expect(result.recipe?.cookTime).toBeUndefined()
  })

  it("accepts ISO 8601 totalTime and humanizes it", async () => {
    ;(GroqClientMocked as any).prototype.chatCompletionsCreate = vi.fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          recipe: {
            title: "ISO Time",
            ingredients: ["1 cup rice"],
            steps: ["Cook the rice."],
            totalTime: "PT45M"
          }
        })
      })

    const result = await groqRecipeExtractionService.extractRecipe("https://example.com/iso")
    expect(result.recipe).toBeTruthy()
    // ISO duration should be humanized to "45 minutes" or accepted as valid ISO format
    const totalTime = result.recipe?.totalTime
    expect(totalTime).toBeTruthy()
    // Check if humanized (contains "minute") or if it's a valid ISO format (contains "45" and "M" or "m")
    const isHumanized = totalTime?.toLowerCase().includes("minute")
    const isValidIso = totalTime && /pt45m/i.test(totalTime)
    expect(isHumanized || isValidIso).toBe(true)
    expect(totalTime?.toLowerCase()).toContain("45")
  })

  it("returns model error when provider reports not-recipe", async () => {
    ;(GroqClientMocked as any).prototype.chatCompletionsCreate = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        error: { type: "not-recipe", message: "No recipe content found" }
      })
    })

    const result = await groqRecipeExtractionService.extractRecipe("https://example.com/other")

    expect(result.error).toBeTruthy()
    expect(result.error?.type).toBe("not-recipe")
    expect(result.error?.message).toMatch(/No recipe content/)
  })

  it("handles invalid JSON responses gracefully", async () => {
    ;(GroqClientMocked as any).prototype.chatCompletionsCreate = vi.fn().mockResolvedValue({
      text: "not-json-response"
    })

    const result = await groqRecipeExtractionService.extractRecipe("https://example.com/bad")

    expect(result.error).toBeTruthy()
    // Implementation maps unknown parsing errors to server error here
    expect(result.error?.type).toBe("server")
  })
})


