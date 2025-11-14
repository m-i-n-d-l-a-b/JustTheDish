import Groq from "groq-sdk";
import { getEnv } from "./env";
import { GroqError, GroqQuotaError, GroqRateLimitError, parseGroqError } from "./groq-errors";
import { logger } from "./logger";

/**
 * Groq SDK chat completion message structure
 */
interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string | null;
  reasoning?: string;
  executed_tools?: unknown[];
}

/**
 * Groq SDK chat completion choice structure
 */
interface GroqChatChoice {
  index: number;
  message: GroqChatMessage;
  finish_reason?: string;
}

/**
 * Groq SDK chat completion response structure
 */
interface GroqChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GroqChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function addJitter(delay: number, jitterFactor: number = 0.1): number {
  const jitter = delay * jitterFactor * Math.random();
  return delay + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Client for interacting with the Groq AI API.
 * Handles authentication, timeouts, retries with exponential backoff, and error parsing.
 * Automatically retries on retryable errors (rate limits, temporary failures).
 */
export class GroqClient {
  private requestTimeout: number;
  private maxRetries: number;
  private baseRetryDelay: number;
  private sdk: Groq;

  /**
   * Creates a new GroqClient instance.
   * Validates that GROQ_API_KEY is set in environment variables.
   *
   * @throws {Error} If GROQ_API_KEY is missing or empty
   */
  constructor() {
    const env = getEnv();
    if (!env.GROQ_API_KEY || env.GROQ_API_KEY.trim().length === 0) {
      throw new Error("Groq API key is missing. Set GROQ_API_KEY in your .env.local.");
    }
    this.requestTimeout = env.GROQ_REQUEST_TIMEOUT;
    this.maxRetries = env.GROQ_MAX_RETRIES;
    this.baseRetryDelay = env.GROQ_RETRY_DELAY;
    this.sdk = new Groq({
      apiKey: env.GROQ_API_KEY,
      defaultHeaders: { "Groq-Model-Version": "2025-07-23" },
    });
  }

  private async withTimeout<T>(op: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          const e = new Error("Request timed out");
          (e as Error).name = "AbortError";
          reject(e);
        }, timeoutMs);
      });
      const result = await Promise.race([op(), timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      return result as T;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      throw error;
    }
  }

  private async withRetry<T>(op: () => Promise<T>, opName: string): Promise<T> {
    let lastError: GroqError | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.withTimeout(op, this.requestTimeout);
        if (attempt > 0) {
          logger.log(`${opName} succeeded on attempt ${attempt + 1}`);
        }
        return result;
      } catch (error) {
        lastError = parseGroqError(error);
        if (!lastError.retryable || attempt === this.maxRetries) {
          break;
        }

        if (lastError instanceof GroqRateLimitError && lastError.retryAfter) {
          const delay = lastError.retryAfter * 1000;
          logger.warn(`Rate limited, retrying after ${delay}ms`);
          await sleep(delay);
          continue;
        }

        const delay = addJitter(this.baseRetryDelay * 2 ** attempt);
        logger.warn(
          `${opName} failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. Retrying in ${Math.round(delay)}ms...`
        );
        await sleep(delay);
      }
    }
    logger.error(
      `${opName} failed after ${this.maxRetries + 1} attempts: ${lastError?.message ?? "Unknown"}`
    );
    throw lastError ?? new GroqError("Unknown error");
  }

  /**
   * Creates a chat completion request to Groq AI.
   * Automatically handles timeouts, retries, and error parsing.
   * Uses exponential backoff with jitter for retries.
   *
   * @param params - Chat completion parameters
   * @param params.messages - Array of chat messages (system, user, assistant)
   * @param params.model - Optional model name (defaults to GROQ_MODEL env var)
   * @param params.requestId - Optional request ID for tracking
   * @param params.userAgent - Optional user agent string
   * @returns Promise resolving to the completion response with text, reasoning, and tools
   * @throws {GroqError} If the request fails after all retries
   *
   * @example
   * ```typescript
   * const client = new GroqClient();
   * const result = await client.chatCompletionsCreate({
   *   messages: [
   *     { role: "system", content: "You are a helpful assistant" },
   *     { role: "user", content: "Extract recipe from this URL..." }
   *   ]
   * });
   * console.log(result.text);
   * ```
   */
  async chatCompletionsCreate(params: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    model?: string;
    requestId?: string;
    userAgent?: string;
  }): Promise<{ text: string; reasoning?: string; executed_tools?: unknown[] }> {
    const env = getEnv();
    const model = params.model || env.GROQ_MODEL;
    const op = async () => {
      const res = await this.sdk.chat.completions.create({
        model,
        messages: params.messages,
        temperature: 0,
        // headers handled via defaultHeaders in client
      });
      const typedRes = res as unknown as GroqChatCompletionResponse;
      const firstChoice = typedRes.choices?.[0];
      if (!firstChoice) {
        throw new Error("No choices in Groq response");
      }
      const message = firstChoice.message;
      const content = message.content;
      const text: string = typeof content === "string" ? content : "";
      if (!text) throw new Error("Empty response received from Groq");
      return { text, reasoning: message.reasoning, executed_tools: message.executed_tools };
    };
    return this.withRetry(op, "Groq chat completion");
  }
}

// fetch helpers removed since groq-sdk is used
