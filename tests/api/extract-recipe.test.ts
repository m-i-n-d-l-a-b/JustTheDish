import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPTIONS, POST } from "../../app/api/extract-recipe/route";
import { groqRecipeExtractionService } from "../../lib/groq-extraction";
import { checkRateLimitWithInfo, getRateLimitKey } from "../../lib/rate-limit";

// Mock dependencies
vi.mock("../../lib/groq-extraction", () => ({
  groqRecipeExtractionService: {
    isReady: vi.fn(),
    extractRecipe: vi.fn(),
  },
}));

vi.mock("../../lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(),
  checkRateLimitWithInfo: vi.fn(),
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("POST /api/extract-recipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset rate limit state
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: true,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });
    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
  });

  function createMockRequest(
    body: unknown,
    options?: {
      origin?: string;
      requestId?: string;
      contentLength?: string;
      ip?: string;
    }
  ): NextRequest {
    const headers = new Headers();
    if (options?.origin) {
      headers.set("origin", options.origin);
    }
    if (options?.requestId) {
      headers.set("x-request-id", options.requestId);
    }
    if (options?.contentLength) {
      headers.set("content-length", options.contentLength);
    }

    const request = new NextRequest("http://localhost:3000/api/extract-recipe", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    // Mock IP if provided
    if (options?.ip) {
      Object.defineProperty(request, "ip", {
        value: options.ip,
        writable: false,
      });
    }

    return request;
  }

  it("should successfully extract a recipe", async () => {
    const mockRecipe = {
      title: "Test Recipe",
      ingredients: ["1 cup flour", "2 eggs"],
      steps: ["Mix ingredients", "Bake at 350F"],
    };

    vi.mocked(groqRecipeExtractionService.isReady).mockReturnValue(true);
    vi.mocked(groqRecipeExtractionService.extractRecipe).mockResolvedValue({
      recipe: mockRecipe,
      metadata: {
        requestId: "test-id",
        url: "https://example.com/recipe",
        duration: 1000,
        model: "test-model",
        timestamp: new Date().toISOString(),
        provider: "groq",
      },
    });

    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: true,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const request = createMockRequest(
      { url: "https://example.com/recipe" },
      { origin: "https://example.com" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.recipe).toEqual(mockRecipe);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined();
    expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
  });

  it("should return 413 when request body is too large", async () => {
    const largeSize = (1024 * 1024 + 1).toString(); // 1MB + 1 byte
    const request = createMockRequest(
      { url: "https://example.com/recipe" },
      { origin: "https://example.com", contentLength: largeSize }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(413);
    expect(data.error.type).toBe("server");
    expect(data.error.message).toContain("too large");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
  });

  it("should return 500 when request body is invalid JSON", async () => {
    // Create request with invalid JSON body
    const invalidRequest = new NextRequest("http://localhost:3000/api/extract-recipe", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.com" },
      body: "invalid json",
    });

    const response = await POST(invalidRequest);
    const data = await response.json();

    expect(response.status).toBe(500); // JSON parse error becomes 500
    expect(data.error.type).toBe("server");
  });

  it("should return 400 when URL is missing", async () => {
    const request = createMockRequest({}, { origin: "https://example.com" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.type).toBe("invalid-url");
  });

  it("should return 400 when URL is not a string", async () => {
    const request = createMockRequest({ url: 123 }, { origin: "https://example.com" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.type).toBe("invalid-url");
  });

  it("should return 400 when URL is invalid format", async () => {
    const request = createMockRequest({ url: "not-a-url" }, { origin: "https://example.com" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.type).toBe("invalid-url");
  });

  it("should return 429 when rate limit is exceeded", async () => {
    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: false,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const request = createMockRequest(
      { url: "https://example.com/recipe" },
      { origin: "https://example.com" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error.type).toBe("rate-limit");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
  });

  it("should return 503 when service is not ready", async () => {
    vi.mocked(groqRecipeExtractionService.isReady).mockReturnValue(false);
    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: true,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const request = createMockRequest(
      { url: "https://example.com/recipe" },
      { origin: "https://example.com" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error.type).toBe("server");
    expect(data.error.message).toContain("unavailable");
  });

  it("should return 404 when recipe is not found", async () => {
    vi.mocked(groqRecipeExtractionService.isReady).mockReturnValue(true);
    vi.mocked(groqRecipeExtractionService.extractRecipe).mockResolvedValue({
      error: {
        type: "not-recipe",
        message: "No recipe found at this URL",
      },
      metadata: {
        requestId: "test-id",
        url: "https://example.com/not-recipe",
        duration: 1000,
        model: "test-model",
        timestamp: new Date().toISOString(),
        provider: "groq",
      },
    });

    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: true,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const request = createMockRequest(
      { url: "https://example.com/not-recipe" },
      { origin: "https://example.com" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.type).toBe("not-recipe");
    expect(response.headers.get("X-RateLimit-Limit")).toBe("1");
  });

  it("should return 422 when parsing fails", async () => {
    vi.mocked(groqRecipeExtractionService.isReady).mockReturnValue(true);
    vi.mocked(groqRecipeExtractionService.extractRecipe).mockResolvedValue({
      error: {
        type: "parsing-failed",
        message: "Failed to parse recipe",
      },
      metadata: {
        requestId: "test-id",
        url: "https://example.com/recipe",
        duration: 1000,
        model: "test-model",
        timestamp: new Date().toISOString(),
        provider: "groq",
      },
    });

    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: true,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const request = createMockRequest(
      { url: "https://example.com/recipe" },
      { origin: "https://example.com" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.type).toBe("parsing-failed");
  });

  it("should return 403 when paywall is detected", async () => {
    vi.mocked(groqRecipeExtractionService.isReady).mockReturnValue(true);
    vi.mocked(groqRecipeExtractionService.extractRecipe).mockResolvedValue({
      error: {
        type: "paywall",
        message: "Content behind paywall",
      },
      metadata: {
        requestId: "test-id",
        url: "https://example.com/paywall",
        duration: 1000,
        model: "test-model",
        timestamp: new Date().toISOString(),
        provider: "groq",
      },
    });

    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: true,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const request = createMockRequest(
      { url: "https://example.com/paywall" },
      { origin: "https://example.com" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.type).toBe("paywall");
  });

  it("should return 503 when AI service is unavailable", async () => {
    vi.mocked(groqRecipeExtractionService.isReady).mockReturnValue(true);
    vi.mocked(groqRecipeExtractionService.extractRecipe).mockResolvedValue({
      error: {
        type: "ai-unavailable",
        message: "AI service temporarily unavailable",
      },
      metadata: {
        requestId: "test-id",
        url: "https://example.com/recipe",
        duration: 1000,
        model: "test-model",
        timestamp: new Date().toISOString(),
        provider: "groq",
      },
    });

    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: true,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const request = createMockRequest(
      { url: "https://example.com/recipe" },
      { origin: "https://example.com" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error.type).toBe("ai-unavailable");
  });

  it("should return 429 when quota is exceeded", async () => {
    vi.mocked(groqRecipeExtractionService.isReady).mockReturnValue(true);
    vi.mocked(groqRecipeExtractionService.extractRecipe).mockResolvedValue({
      error: {
        type: "quota-exceeded",
        message: "API quota exceeded",
      },
      metadata: {
        requestId: "test-id",
        url: "https://example.com/recipe",
        duration: 1000,
        model: "test-model",
        timestamp: new Date().toISOString(),
        provider: "groq",
      },
    });

    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: true,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const request = createMockRequest(
      { url: "https://example.com/recipe" },
      { origin: "https://example.com" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error.type).toBe("quota-exceeded");
  });

  it("should return 500 when unexpected error occurs", async () => {
    vi.mocked(groqRecipeExtractionService.isReady).mockReturnValue(true);
    vi.mocked(groqRecipeExtractionService.extractRecipe).mockRejectedValue(
      new Error("Unexpected error")
    );

    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: true,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const request = createMockRequest(
      { url: "https://example.com/recipe" },
      { origin: "https://example.com" }
    );
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.type).toBe("server");
  });

  it("should include request ID in extraction call when provided", async () => {
    const mockRecipe = {
      title: "Test Recipe",
      ingredients: ["1 cup flour"],
      steps: ["Mix"],
    };

    vi.mocked(groqRecipeExtractionService.isReady).mockReturnValue(true);
    vi.mocked(groqRecipeExtractionService.extractRecipe).mockResolvedValue({
      recipe: mockRecipe,
      metadata: {
        requestId: "custom-request-id",
        url: "https://example.com/recipe",
        duration: 1000,
        model: "test-model",
        timestamp: new Date().toISOString(),
        provider: "groq",
      },
    });

    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: true,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const request = createMockRequest(
      { url: "https://example.com/recipe" },
      { origin: "https://example.com", requestId: "custom-request-id" }
    );
    await POST(request);

    expect(groqRecipeExtractionService.extractRecipe).toHaveBeenCalledWith(
      "https://example.com/recipe",
      {
        requestId: "custom-request-id",
      }
    );
  });

  it("should handle requests without origin header", async () => {
    const mockRecipe = {
      title: "Test Recipe",
      ingredients: ["1 cup flour"],
      steps: ["Mix"],
    };

    vi.mocked(groqRecipeExtractionService.isReady).mockReturnValue(true);
    vi.mocked(groqRecipeExtractionService.extractRecipe).mockResolvedValue({
      recipe: mockRecipe,
      metadata: {
        requestId: "test-id",
        url: "https://example.com/recipe",
        duration: 1000,
        model: "test-model",
        timestamp: new Date().toISOString(),
        provider: "groq",
      },
    });

    vi.mocked(getRateLimitKey).mockReturnValue("127.0.0.1");
    vi.mocked(checkRateLimitWithInfo).mockReturnValue({
      allowed: true,
      limit: 1,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    });

    const request = createMockRequest({ url: "https://example.com/recipe" });
    const response = await POST(request);

    expect(response.status).toBe(200);
    // Should still set CORS headers (wildcard for no origin)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("OPTIONS /api/extract-recipe", () => {
  it("should handle CORS preflight requests", async () => {
    const request = new NextRequest("http://localhost:3000/api/extract-recipe", {
      method: "OPTIONS",
      headers: { origin: "https://example.com" },
    });

    const response = await OPTIONS(request);

    // Should return 200 or 403 depending on CORS config
    expect([200, 403]).toContain(response.status);
  });
});
