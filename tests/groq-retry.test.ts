import Groq from "groq-sdk";
import { describe, expect, it, vi } from "vitest";
import * as envMod from "../lib/env";
import { GroqClient } from "../lib/groq-client";

describe("GroqClient retries", () => {
  it("retries on rate-limit with Retry-After and then succeeds", async () => {
    vi.spyOn(envMod, "getEnv").mockReturnValue({
      GROQ_API_KEY: "test",
      GROQ_REQUEST_TIMEOUT: 500,
      GROQ_MAX_RETRIES: 1,
      GROQ_RETRY_DELAY: 10,
      GROQ_MODEL: "groq/compound-mini",
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    } as ReturnType<typeof envMod.getEnv>);

    // Biome allows any in test files, but we use unknown for type safety
    const originalChat = (Groq as unknown as { prototype: { chat: unknown } }).prototype.chat;
    const createMock = vi
      .fn()
      .mockRejectedValueOnce({
        response: {
          status: 429,
          headers: { "retry-after": "0" },
          data: { error: { message: "rate limit" } },
        },
      })
      .mockResolvedValueOnce({
        choices: [
          { message: { content: '{"recipe":{"title":"x","ingredients":["a"],"steps":["b"]}}' } },
        ],
      });

    // Biome allows any in test files, but we use unknown for type safety
    (
      Groq as unknown as {
        prototype: { chat: { completions: { create: ReturnType<typeof vi.fn> } } };
      }
    ).prototype.chat = { completions: { create: createMock } };

    const client = new GroqClient();
    const res = await client.chatCompletionsCreate({ messages: [{ role: "user", content: "hi" }] });
    expect(res.text).toContain("recipe");

    // cleanup
    (Groq as unknown as { prototype: { chat: unknown } }).prototype.chat = originalChat;
  });
});
