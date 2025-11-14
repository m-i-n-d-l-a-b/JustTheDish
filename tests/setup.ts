import { vi } from "vitest";

// Mock groq-sdk to avoid live network calls
vi.mock("groq-sdk", () => {
  interface GroqChatCompletions {
    create: ReturnType<typeof vi.fn>;
  }

  interface GroqChat {
    completions: GroqChatCompletions;
  }

  class GroqMock {
    public chat: GroqChat;
    constructor(_opts?: unknown) {
      // Instances read the shared prototype chat by default
      this.chat = (GroqMock as unknown as { prototype: { chat: GroqChat } }).prototype.chat;
    }
  }
  (GroqMock as unknown as { prototype: { chat: GroqChat } }).prototype.chat = {
    completions: {
      create: vi.fn(async (_args: unknown) => {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({ error: { type: "not-recipe", message: "mock" } }),
                reasoning: undefined,
                executed_tools: [],
              },
            },
          ],
        };
      }),
    },
  };
  return { default: GroqMock };
});
