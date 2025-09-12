import { getEnv } from "./env"
import { GroqError, GroqRateLimitError, GroqQuotaError, parseGroqError } from "./groq-errors"
import Groq from "groq-sdk"

function addJitter(delay: number, jitterFactor: number = 0.1): number {
  const jitter = delay * jitterFactor * Math.random()
  return delay + jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class GroqClient {
  private requestTimeout: number
  private maxRetries: number
  private baseRetryDelay: number
  private sdk: Groq

  constructor() {
    const env = getEnv()
    if (!env.GROQ_API_KEY || env.GROQ_API_KEY.trim().length === 0) {
      throw new Error("Groq API key is missing. Set GROQ_API_KEY in your .env.local.")
    }
    this.requestTimeout = env.GROQ_REQUEST_TIMEOUT
    this.maxRetries = env.GROQ_MAX_RETRIES
    this.baseRetryDelay = env.GROQ_RETRY_DELAY
    this.sdk = new Groq({
      apiKey: env.GROQ_API_KEY,
      defaultHeaders: { "Groq-Model-Version": "2025-07-23" },
    })
  }

  private async withTimeout<T>(op: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          const e = new Error("Request timed out")
          ;(e as Error).name = "AbortError"
          reject(e)
        }, timeoutMs)
      })
      const result = await Promise.race([op(), timeoutPromise])
      if (timeoutId) clearTimeout(timeoutId)
      return result as T
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId)
      throw error
    }
  }

  private async withRetry<T>(op: () => Promise<T>, opName: string): Promise<T> {
    let lastError: GroqError | null = null
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.withTimeout(op, this.requestTimeout)
        if (attempt > 0) {
          console.log(`✅ ${opName} succeeded on attempt ${attempt + 1}`)
        }
        return result
      } catch (error) {
        lastError = parseGroqError(error)
        if (!lastError.retryable || attempt === this.maxRetries) {
          break
        }

        if (lastError instanceof GroqRateLimitError && lastError.retryAfter) {
          const delay = lastError.retryAfter * 1000
          console.warn(`⏳ Rate limited, retrying after ${delay}ms`)
          await sleep(delay)
          continue
        }

        const delay = addJitter(this.baseRetryDelay * Math.pow(2, attempt))
        console.warn(`⚠️  ${opName} failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${lastError.message}. Retrying in ${Math.round(delay)}ms...`)
        await sleep(delay)
      }
    }
    console.error(`❌ ${opName} failed after ${this.maxRetries + 1} attempts: ${lastError?.message ?? "Unknown"}`)
    throw (lastError ?? new GroqError("Unknown error"))
  }

  async chatCompletionsCreate(params: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
    model?: string
    requestId?: string
    userAgent?: string
  }): Promise<{ text: string; reasoning?: string; executed_tools?: unknown[] }> {
    const env = getEnv()
    const model = params.model || env.GROQ_MODEL
    const op = async () => {
      const res = await this.sdk.chat.completions.create({
        model,
        messages: params.messages,
        temperature: 0,
        // headers handled via defaultHeaders in client
      } as any)
      const message = (res as any)?.choices?.[0]?.message
      const text: string = message?.content ?? ""
      if (!text) throw new Error("Empty response received from Groq")
      return { text, reasoning: message?.reasoning, executed_tools: message?.executed_tools }
    }
    return this.withRetry(op, "Groq chat completion")
  }
}

// fetch helpers removed since groq-sdk is used


