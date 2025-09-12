import { describe, it, expect, vi, beforeEach } from "vitest"
import { GroqClient } from "../lib/groq-client"
import * as envMod from "../lib/env"

describe("GroqClient", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(envMod, "getEnv").mockReturnValue({
      GROQ_API_KEY: "test",
      GROQ_MODEL: "groq/compound-mini",
      GROQ_REQUEST_TIMEOUT: 100,
      GROQ_MAX_RETRIES: 1,
      GROQ_RETRY_DELAY: 10,
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      GEMINI_MODEL: "gemini-2.0-flash-exp",
      GEMINI_REQUEST_TIMEOUT: 30000,
      GEMINI_MAX_RETRIES: 2,
      GEMINI_RETRY_DELAY: 1000,
      EXTRACTION_PROVIDER: "groq",
    } as any)
  })

  it("constructs successfully with API key", () => {
    const client = new GroqClient()
    expect(client).toBeTruthy()
  })
})





