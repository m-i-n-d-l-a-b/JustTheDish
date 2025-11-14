import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../lib/env";
import * as envMod from "../lib/env";
import { GroqClient } from "../lib/groq-client";

describe("GroqClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const mockEnv: Env = {
      GROQ_API_KEY: "test",
      GROQ_MODEL: "groq/compound-mini",
      GROQ_REQUEST_TIMEOUT: 100,
      GROQ_MAX_RETRIES: 1,
      GROQ_RETRY_DELAY: 10,
      GROQ_REPAIR_INGREDIENT_SPACING: false,
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      ALLOWED_ORIGINS: "*",
    };
    vi.spyOn(envMod, "getEnv").mockReturnValue(mockEnv);
  });

  it("constructs successfully with API key", () => {
    const client = new GroqClient();
    expect(client).toBeTruthy();
  });
});
