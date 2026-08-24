import { describe, expect, it } from "vitest";
import { parseGroqRecipeResponse } from "../lib/groq-response";

describe("parseGroqRecipeResponse", () => {
  it("should parse plain JSON response", () => {
    const response = JSON.stringify({
      recipe: {
        title: "Test Recipe",
        ingredients: ["ingredient 1", "ingredient 2"],
        steps: ["Mix ingredients", "Cook for 30 minutes"],
      },
    });
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe).toBeDefined();
    expect(result.recipe?.title).toBe("Test Recipe");
  });

  it("should parse code-fenced JSON response", () => {
    const response =
      "```json\n" +
      JSON.stringify({
        recipe: {
          title: "Fenced Recipe",
          ingredients: ["ingredient 1"],
          steps: ["Mix and cook"],
        },
      }) +
      "\n```";
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.title).toBe("Fenced Recipe");
  });

  it("should normalize step objects to strings", () => {
    const response = JSON.stringify({
      recipe: {
        title: "Test",
        ingredients: ["ingredient 1"],
        steps: [{ step: "Mix the ingredients" }, { step: "Cook for 30 minutes" }, "Serve hot"],
      },
    });
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.steps).toEqual([
      "Mix the ingredients",
      "Cook for 30 minutes",
      "Serve hot",
    ]);
  });

  it("should handle steps with different object structures", () => {
    const response = JSON.stringify({
      recipe: {
        title: "Test",
        ingredients: ["ingredient 1"],
        steps: [{ step: "Mix ingredients" }, { text: "Cook mixture" }, "Serve immediately"],
      },
    });
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.steps).toHaveLength(3);
    expect(result.recipe?.steps?.[0]).toBe("Mix ingredients");
  });

  it("should normalize synonym keys (yield -> servings)", () => {
    const response = JSON.stringify({
      recipe: {
        title: "Test",
        ingredients: ["ingredient 1"],
        steps: ["Mix and cook"],
        yield: "4 servings",
      },
    });
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.servings).toBe("4 servings");
    expect((result.recipe as Record<string, unknown>).yield).toBeUndefined();
  });

  it("should normalize prep_time -> prepTime", () => {
    const response = JSON.stringify({
      recipe: {
        title: "Test",
        ingredients: ["ingredient 1"],
        steps: ["Mix and cook"],
        prep_time: "15 minutes",
      },
    });
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.prepTime).toBe("15 minutes");
    expect((result.recipe as Record<string, unknown>).prep_time).toBeUndefined();
  });

  it("should normalize cook_time -> cookTime", () => {
    const response = JSON.stringify({
      recipe: {
        title: "Test",
        ingredients: ["ingredient 1"],
        steps: ["Mix and cook"],
        cook_time: "30 minutes",
      },
    });
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.cookTime).toBe("30 minutes");
  });

  it("should coerce null fields to undefined", () => {
    const response = JSON.stringify({
      recipe: {
        title: "Test",
        ingredients: ["ingredient 1"],
        steps: ["Mix and cook"],
        servings: null,
        prepTime: null,
        cookTime: "null",
      },
    });
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.servings).toBeUndefined();
    expect(result.recipe?.prepTime).toBeUndefined();
    expect(result.recipe?.cookTime).toBeUndefined();
  });

  it("should handle error responses", () => {
    const response = JSON.stringify({
      error: {
        type: "not-recipe",
        message: "No recipe found",
      },
    });
    const result = parseGroqRecipeResponse(response);
    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe("not-recipe");
    expect(result.error?.message).toBe("No recipe found");
  });

  it("should throw on invalid JSON", () => {
    const response = "invalid json {";
    expect(() => parseGroqRecipeResponse(response)).toThrow();
  });

  it("should handle JSON with extra text", () => {
    const response =
      "Some text before\n" +
      JSON.stringify({
        recipe: {
          title: "Test",
          ingredients: ["ingredient 1"],
          steps: ["Mix and cook"],
        },
      }) +
      "\nSome text after";
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.title).toBe("Test");
  });
  it("should strip a <think> reasoning block preceding the JSON", () => {
    // Reproduces the production failure: qwen/qwen3.6-27b prefixes its answer
    // with a reasoning block whose braces derail brace-scanning for the payload.
    const response =
      "<think>\nThe user wants JSON like {recipe: ...}. Let me check the ingredients.\n</think>\n" +
      JSON.stringify({
        recipe: {
          title: "Simple White Cake",
          ingredients: ["1 cup white sugar"],
          steps: ["Preheat the oven"],
        },
      });
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.title).toBe("Simple White Cake");
    expect(result.recipe?.ingredients).toEqual(["1 cup white sugar"]);
  });

  it("should strip a reasoning block that is fenced as well", () => {
    const response =
      "<think>Considering {a} and {b}</think>\n```json\n" +
      JSON.stringify({
        recipe: { title: "Fenced", ingredients: ["salt"], steps: ["Stir the mixture"] },
      }) +
      "\n```";
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.title).toBe("Fenced");
  });

  it("should recover when only a closing </think> tag is present", () => {
    const response =
      "Reasoning about {this} first.</think>\n" +
      JSON.stringify({
        recipe: { title: "Unpaired", ingredients: ["water"], steps: ["Boil the water"] },
      });
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.title).toBe("Unpaired");
  });

  it("should strip a reasoning block preceding an error payload", () => {
    const response =
      "<think>This page has no {recipe} on it.</think>\n" +
      JSON.stringify({ error: { type: "not-recipe", message: "No recipe found" } });
    const result = parseGroqRecipeResponse(response);
    expect(result.error?.type).toBe("not-recipe");
  });

  it("should leave responses without reasoning blocks unchanged", () => {
    const response = JSON.stringify({
      recipe: { title: "Plain", ingredients: ["flour"], steps: ["Bake until golden"] },
    });
    const result = parseGroqRecipeResponse(response);
    expect(result.recipe?.title).toBe("Plain");
  });
});
