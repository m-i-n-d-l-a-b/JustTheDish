import { v4 as uuidv4 } from "uuid";
import { getEnv } from "./env";
import { GroqClient } from "./groq-client";
import {
  GroqContentBlockedError,
  GroqError,
  GroqQuotaError,
  GroqRateLimitError,
} from "./groq-errors";
import {
  createGroqRecipeExtractionPrompt,
  createGroqRecipeStepsSimplificationPrompt,
  createGroqRecipeTimesValidationPrompt,
  createGroqRecipeValidationPrompt,
} from "./groq-prompts";
import { parseGroqRecipeResponse } from "./groq-response";
import { logger } from "./logger";
import {
  type Recipe,
  type RecipeExtractionLog,
  type RecipeExtractionResponse,
  sanitizeRecipe,
  validateRecipeUrl,
} from "./schemas";

class GroqRecipeExtractionError extends Error {
  constructor(
    message: string,
    public type:
      | "invalid-url"
      | "not-recipe"
      | "paywall"
      | "url-inaccessible"
      | "parsing-failed"
      | "content-blocked"
      | "ai-unavailable"
      | "quota-exceeded"
      | "server",
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "GroqRecipeExtractionError";
  }
}

interface ExtractionConfig {
  strategy?: "basic";
  requestId?: string;
}

interface ExtractionResult {
  recipe?: Recipe;
  error?: {
    type: GroqRecipeExtractionError["type"];
    message: string;
  };
  metadata: {
    requestId: string;
    url: string;
    duration: number;
    model: string;
    timestamp: string;
    provider: "groq";
  };
}

/**
 * Service for extracting recipes from URLs using Groq AI.
 * Orchestrates the full extraction pipeline: fetching content, building prompts,
 * calling Groq API, parsing responses, and sanitizing results.
 */
export class GroqRecipeExtractionService {
  private client!: GroqClient;
  private isInitialized = false;

  /**
   * Creates a new GroqRecipeExtractionService instance.
   * Initializes the Groq client and handles initialization errors gracefully.
   */
  constructor() {
    try {
      this.client = new GroqClient();
      this.isInitialized = true;
    } catch (error) {
      logger.error("Failed to initialize Groq client:", error);
      this.isInitialized = false;
    }
  }

  /**
   * Checks if the service is ready to handle extraction requests.
   *
   * @returns True if the Groq client was successfully initialized, false otherwise
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Performs a health check by making a simple request to Groq API.
   *
   * @returns True if the API is accessible and responding, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isInitialized) return false;
    try {
      await this.client.chatCompletionsCreate({
        messages: [{ role: "user", content: "Respond with: OK" }],
        userAgent: "just-the-dish/healthcheck",
      });
      return true;
    } catch {
      return false;
    }
  }

  getServiceInfo(): { initialized: boolean; model?: string } {
    return { initialized: this.isInitialized, model: undefined };
  }

  private createMetadata(
    requestId: string,
    url: string,
    start: number
  ): ExtractionResult["metadata"] {
    return {
      requestId,
      url,
      duration: Date.now() - start,
      model: "groq-model",
      timestamp: new Date().toISOString(),
      provider: "groq",
    };
  }

  private mapGroqError(error: GroqError): GroqRecipeExtractionError {
    if (error instanceof GroqContentBlockedError) {
      return new GroqRecipeExtractionError(
        "The content at this URL was blocked by safety filters. Please try a different recipe URL.",
        "content-blocked",
        false
      );
    }
    if (error instanceof GroqQuotaError) {
      return new GroqRecipeExtractionError(
        "API quota exceeded. Please try again later or contact support.",
        "quota-exceeded",
        false
      );
    }
    if (error instanceof GroqRateLimitError) {
      return new GroqRecipeExtractionError(
        "Too many requests. Please wait a moment and try again.",
        "ai-unavailable",
        true
      );
    }
    const retryable = (error.code ?? 0) >= 500;
    return new GroqRecipeExtractionError(
      error.retryable
        ? "Temporary AI service error. Please try again."
        : "AI service error occurred. Please try again later.",
      "ai-unavailable",
      retryable
    );
  }

  private log(
    metadata: ExtractionResult["metadata"],
    success: boolean,
    errorType?: string,
    errorMessage?: string
  ): void {
    const logData: RecipeExtractionLog = {
      requestId: metadata.requestId,
      url: metadata.url,
      timestamp: metadata.timestamp,
      duration: metadata.duration,
      success,
      model: metadata.model,
      errorType,
      errorMessage,
    };
    if (success) {
      logger.log("Groq extraction successful:", {
        requestId: logData.requestId,
        duration: `${logData.duration}ms`,
      });
    } else {
      logger.error("Groq extraction failed:", {
        requestId: logData.requestId,
        errorType,
        errorMessage,
      });
    }
  }

  /**
   * Extracts recipe data from a given URL using Groq AI.
   * Fetches the webpage content, builds extraction prompts, calls Groq API,
   * parses and validates the response, and sanitizes the result.
   *
   * @param url - The URL of the recipe webpage to extract
   * @param config - Optional extraction configuration
   * @param config.requestId - Optional request ID for tracking and logging
   * @returns Promise resolving to an ExtractionResult with either a recipe or error
   *
   * @example
   * ```typescript
   * const service = new GroqRecipeExtractionService();
   * const result = await service.extractRecipe("https://example.com/recipe", {
   *   requestId: "req-123"
   * });
   * if (result.recipe) {
   *   console.log("Extracted recipe:", result.recipe.title);
   * } else if (result.error) {
   *   console.error("Extraction failed:", result.error.message);
   * }
   * ```
   */
  async extractRecipe(url: string, config: ExtractionConfig = {}): Promise<ExtractionResult> {
    const start = Date.now();
    const requestId = config.requestId || uuidv4();

    if (!this.isInitialized) {
      const metadata = this.createMetadata(requestId, url, start);
      this.log(metadata, false, "server", "Service not initialized");
      return {
        error: {
          type: "server",
          message: "Recipe extraction service is not available. Please try again later.",
        },
        metadata,
      };
    }

    try {
      const validatedUrl = validateRecipeUrl(url);
      // Prefetch lightweight JSON-LD (if present) to ground ingredients/times exactly
      const jsonLd = await fetchRecipeJsonLd(validatedUrl);
      const prompt = appendJsonLdToSystemPrompt(
        createGroqRecipeExtractionPrompt(validatedUrl),
        jsonLd
      );
      const response = await this.client.chatCompletionsCreate({
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: `Extract the recipe for: ${validatedUrl}` },
        ],
        requestId,
        userAgent: "just-the-dish/recipe-extraction",
      });

      const parsed: RecipeExtractionResponse = parseGroqRecipeResponse(response.text);
      const metadata = this.createMetadata(requestId, validatedUrl, start);

      if (parsed.recipe) {
        const firstPass = sanitizeRecipe(parsed.recipe);
        const env = getEnv();
        // Detect likely spacing issues like "1cupsugar" and try a focused second pass
        if (
          hasIngredientSpacingIssues(firstPass.ingredients) &&
          getEnv().GROQ_REPAIR_INGREDIENT_SPACING
        ) {
          try {
            const validationPrompt = createGroqRecipeValidationPrompt(
              JSON.stringify({ recipe: firstPass })
            );
            const validationResponse = await this.client.chatCompletionsCreate({
              messages: [
                { role: "system", content: validationPrompt },
                {
                  role: "user",
                  content: `URL: ${validatedUrl}\nFix only ingredient spacing as per instructions. Return JSON only.`,
                },
              ],
              userAgent: "just-the-dish/recipe-extraction-validate",
            });
            const reparsed: RecipeExtractionResponse = parseGroqRecipeResponse(
              validationResponse.text
            );
            if (reparsed.recipe) {
              const secondPass = sanitizeRecipe(reparsed.recipe);
              // Optional minimal, deterministic repair: insert a space between digits and letters when missing
              if (env.GROQ_REPAIR_INGREDIENT_SPACING) {
                secondPass.ingredients = repairIngredientSpacing(secondPass.ingredients);
              }
              this.log(metadata, true);
              return { recipe: secondPass, metadata };
            }
          } catch (e) {
            // Ignore and fall back to first pass
          }
          // If second pass is enabled but didn't yield better result, optionally apply minimal repair to first pass
          if (env.GROQ_REPAIR_INGREDIENT_SPACING) {
            firstPass.ingredients = repairIngredientSpacing(firstPass.ingredients);
          }
        }
        // Times validation pass: if totalTime exists and prep/cook are missing in source, remove inferred ones
        try {
          if (firstPass.totalTime) {
            const timesPrompt = createGroqRecipeTimesValidationPrompt(
              validatedUrl,
              JSON.stringify({ recipe: firstPass })
            );
            const timesResponse = await this.client.chatCompletionsCreate({
              messages: [
                { role: "system", content: timesPrompt },
                {
                  role: "user",
                  content: `Ensure time fields reflect the page or JSON-LD exactly. Return JSON only.`,
                },
              ],
              userAgent: "just-the-dish/recipe-extraction-validate-times",
              requestId,
            });
            const timesParsed: RecipeExtractionResponse = parseGroqRecipeResponse(
              timesResponse.text
            );
            if (timesParsed.recipe) {
              const timesFixed = sanitizeRecipe(timesParsed.recipe);
              // Steps simplification pass: rewrite ONLY steps to be concise, preserving order and meaning
              try {
                const stepsPrompt = createGroqRecipeStepsSimplificationPrompt(
                  JSON.stringify({ recipe: timesFixed })
                );
                const stepsResponse = await this.client.chatCompletionsCreate({
                  messages: [
                    { role: "system", content: stepsPrompt },
                    {
                      role: "user",
                      content: `Rewrite steps only. Keep order and meaning. Return JSON only.`,
                    },
                  ],
                  userAgent: "just-the-dish/recipe-extraction-simplify-steps",
                });
                const stepsParsed: RecipeExtractionResponse = parseGroqRecipeResponse(
                  stepsResponse.text
                );
                if (stepsParsed.recipe) {
                  const stepsFixed = sanitizeRecipe(stepsParsed.recipe);
                  this.log(metadata, true);
                  return { recipe: stepsFixed, metadata };
                }
              } catch {
                // ignore and return timesFixed
              }
              this.log(metadata, true);
              return { recipe: timesFixed, metadata };
            }
          }
        } catch {
          // ignore and use first pass
        }

        // Steps simplification pass when no times fix was applied
        try {
          const stepsPrompt = createGroqRecipeStepsSimplificationPrompt(
            JSON.stringify({ recipe: firstPass })
          );
          const stepsResponse = await this.client.chatCompletionsCreate({
            messages: [
              { role: "system", content: stepsPrompt },
              {
                role: "user",
                content: `Rewrite steps only. Keep order and meaning. Return JSON only.`,
              },
            ],
            userAgent: "just-the-dish/recipe-extraction-simplify-steps",
          });
          const stepsParsed: RecipeExtractionResponse = parseGroqRecipeResponse(stepsResponse.text);
          if (stepsParsed.recipe) {
            const stepsFixed = sanitizeRecipe(stepsParsed.recipe);
            this.log(metadata, true);
            return { recipe: stepsFixed, metadata };
          }
        } catch {
          // ignore
        }
        this.log(metadata, true);
        return { recipe: firstPass, metadata };
      }

      if (parsed.error) {
        this.log(metadata, false, parsed.error.type, parsed.error.message);
        return { error: { type: parsed.error.type, message: parsed.error.message }, metadata };
      }

      throw new GroqRecipeExtractionError(
        "Invalid response format from AI service",
        "parsing-failed",
        true
      );
    } catch (error) {
      const metadata = this.createMetadata(requestId, url, start);

      if (error instanceof Error && error.name === "ZodError") {
        this.log(metadata, false, "invalid-url", error.message);
        return {
          error: {
            type: "invalid-url",
            message: "Please provide a valid URL starting with http:// or https://.",
          },
          metadata,
        };
      }
      if (error instanceof GroqError) {
        const mapped = this.mapGroqError(error);
        this.log(metadata, false, mapped.type, mapped.message);
        return { error: { type: mapped.type, message: mapped.message }, metadata };
      }
      if (error instanceof GroqRecipeExtractionError) {
        this.log(metadata, false, error.type, error.message);
        return { error: { type: error.type, message: error.message }, metadata };
      }

      logger.error("Unexpected error during Groq extraction:", error);
      const message = error instanceof Error ? error.message : String(error);
      this.log(metadata, false, "server", message);
      return {
        error: {
          type: "server",
          message: "An unexpected error occurred while processing the recipe. Please try again.",
        },
        metadata,
      };
    }
  }
}

function hasIngredientSpacingIssues(ingredients: string[]): boolean {
  const suspicious = /\d+[a-zA-Z]/; // digit immediately followed by a letter
  return ingredients.some(line => suspicious.test(line));
}

function repairIngredientSpacing(ingredients: string[]): string[] {
  // Insert a space between a digit and a following letter when there is none
  // e.g., "2cups" -> "2 cups" ; "1tablespoon" -> "1 tablespoon"
  return ingredients.map(line => line.replace(/(\d)(?=[a-zA-Z])/g, "$1 "));
}

export const groqRecipeExtractionService = new GroqRecipeExtractionService();

// --- Internal helpers to lightly ground the model with page JSON-LD ---

async function fetchRecipeJsonLd(url: string): Promise<unknown | null> {
  try {
    const env = getEnv();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.GROQ_REQUEST_TIMEOUT);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "just-the-dish/recipe-extraction (+github.com)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const html = await res.text();
    const scripts = Array.from(
      html.matchAll(
        /<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi
      )
    );
    for (const match of scripts) {
      const raw = match[1]?.trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(sanitizePotentiallyCommentedJson(raw));
        const candidate = findRecipeObjectInJsonLd(parsed);
        if (candidate) return candidate;
      } catch {
        // ignore malformed blocks
      }
    }
    return null;
  } catch {
    return null;
  }
}

function sanitizePotentiallyCommentedJson(text: string): string {
  // Remove HTML entities and stray tags inside JSON blocks, and strip BOM
  return text
    .replace(/^\uFEFF/, "")
    .replace(/&quot;/g, '"')
    .replace(/<!--([\s\S]*?)-->/g, "");
}

/**
 * JSON-LD node structure that may contain recipe data
 */
interface JsonLdNode extends Record<string, unknown> {
  "@type"?: string | string[];
  type?: string | string[];
  "@graph"?: JsonLdNode[];
  recipeIngredient?: unknown[];
}

/**
 * Type guard to check if a value is a JSON-LD node
 */
function isJsonLdNode(value: unknown): value is JsonLdNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a node is a Recipe type
 */
function isRecipeType(node: JsonLdNode): boolean {
  const type = node["@type"] ?? node.type;
  if (typeof type === "string" && /Recipe/i.test(type)) {
    return true;
  }
  if (Array.isArray(type) && type.some(t => /Recipe/i.test(String(t)))) {
    return true;
  }
  return false;
}

function findRecipeObjectInJsonLd(json: unknown): JsonLdNode | null {
  // JSON-LD may be an object, an array, or have @graph
  const candidates: JsonLdNode[] = [];
  const pushIfRecipe = (node: unknown): void => {
    if (!isJsonLdNode(node)) return;
    if (isRecipeType(node)) {
      candidates.push(node);
    }
  };
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    pushIfRecipe(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
    } else if (isJsonLdNode(node)) {
      if (Array.isArray(node["@graph"])) {
        walk(node["@graph"]);
      }
      for (const key of Object.keys(node)) {
        const val = node[key];
        if (val && typeof val === "object") {
          walk(val);
        }
      }
    }
  };
  walk(json);
  // Prefer nodes containing recipeIngredient
  const withIngredients = candidates.find(
    c => Array.isArray(c.recipeIngredient) && c.recipeIngredient.length > 0
  );
  return withIngredients ?? candidates[0] ?? null;
}

function appendJsonLdToSystemPrompt(basePrompt: string, jsonLd: unknown | null): string {
  if (!jsonLd) return basePrompt;
  const safe = JSON.stringify(jsonLd, null, 2);
  return `${basePrompt}

CONTEXT (PRIMARY SOURCE):
- Use the JSON-LD below as the authoritative source. Copy recipeIngredient EXACTLY (array of strings). Keep times as-is. If instructions are objects (HowToStep), convert to plain text steps preserving meaning.
- Do not guess or substitute ingredients not present in JSON-LD.

JSON_LD:
${safe}`;
}
