import { vi } from "vitest"

// Mock groq-sdk to avoid live network calls
vi.mock("groq-sdk", () => {
  class GroqMock {
    public chat: any
    constructor(_opts?: any) {
      // Instances read the shared prototype chat by default
      this.chat = (GroqMock as any).prototype.chat
    }
  }
  ;(GroqMock as any).prototype.chat = {
    completions: {
      create: vi.fn(async (_args: any) => {
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
        }
      }),
    },
  }
  return { default: GroqMock }
})


