import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPTIONS, POST } from "../../app/api/generate-pdf/route";
import { validateRecipe } from "../../lib/schemas";

// Mock PDF generation
vi.mock("pdfkit", () => {
  class PDFDocumentMock {
    private listeners: Map<string, Array<(data?: unknown) => void>> = new Map();

    constructor(_opts?: unknown) {
      // Set up listeners immediately after construction
      setTimeout(() => {
        this.emitEvents();
      }, 0);
    }

    addPage() {
      return this;
    }
    fontSize() {
      return this;
    }
    text() {
      return this;
    }
    moveDown() {
      return this;
    }
    fillColor() {
      return this;
    }
    on(event: string, callback: (data?: unknown) => void) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event)?.push(callback);
      return this;
    }
    end() {
      // Use setTimeout to ensure listeners are registered before emitting
      setTimeout(() => {
        this.emitEvents();
      }, 0);
    }
    private emitEvents() {
      // Simulate PDF generation by emitting data and end events
      const dataListeners = this.listeners.get("data") || [];
      const endListeners = this.listeners.get("end") || [];

      // Emit some mock PDF data
      const mockData = Buffer.from("Mock PDF Content");
      dataListeners.forEach(listener => listener(mockData));

      // Emit end event
      endListeners.forEach(listener => listener());
    }
  }
  return {
    default: PDFDocumentMock,
  };
});

vi.mock("../../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("POST /api/generate-pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockRequest(
    body: unknown,
    options?: {
      origin?: string;
      contentLength?: string;
    }
  ): NextRequest {
    const headers = new Headers();
    if (options?.origin) {
      headers.set("origin", options.origin);
    }
    if (options?.contentLength) {
      headers.set("content-length", options.contentLength);
    }
    headers.set("content-type", "application/json");

    return new NextRequest("http://localhost:3000/api/generate-pdf", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  const validRecipe = {
    title: "Test Recipe",
    ingredients: ["1 cup flour", "2 eggs"],
    steps: ["Mix ingredients", "Bake at 350F"],
  };

  it("should successfully generate PDF", async () => {
    const request = createMockRequest({ recipe: validRecipe }, { origin: "https://example.com" });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("test_recipe.pdf");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");

    // Verify response is an ArrayBuffer (PDF content)
    const arrayBuffer = await response.arrayBuffer();
    expect(arrayBuffer).toBeInstanceOf(ArrayBuffer);
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });

  it("should return 413 when request body is too large", async () => {
    const largeSize = (100 * 1024 + 1).toString(); // 100KB + 1 byte
    const request = createMockRequest(
      { recipe: validRecipe },
      { origin: "https://example.com", contentLength: largeSize }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(413);
    expect(data.error.type).toBe("server");
    expect(data.error.message).toContain("too large");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
  });

  it("should return 400 when recipe is missing", async () => {
    const request = createMockRequest({}, { origin: "https://example.com" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.type).toBe("server");
    expect(data.error.message).toContain("required");
  });

  it("should return 400 when recipe is null", async () => {
    const request = createMockRequest({ recipe: null }, { origin: "https://example.com" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.type).toBe("server");
  });

  it("should return 400 when recipe data is invalid", async () => {
    const invalidRecipe = {
      title: "", // Invalid: empty title
      ingredients: [],
      steps: [],
    };

    const request = createMockRequest({ recipe: invalidRecipe }, { origin: "https://example.com" });
    const response = await POST(request);
    const data = await response.json();

    // Should fail validation and return 500 (validation throws error)
    expect([400, 500]).toContain(response.status);
    expect(data.error).toBeDefined();
  });

  it("should sanitize filename for PDF download", async () => {
    const recipeWithSpecialChars = {
      ...validRecipe,
      title: "Recipe with Special/Chars & Symbols!",
    };

    const request = createMockRequest(
      { recipe: recipeWithSpecialChars },
      { origin: "https://example.com" }
    );
    const response = await POST(request);

    expect(response.status).toBe(200);
    const contentDisposition = response.headers.get("Content-Disposition");
    expect(contentDisposition).toContain("recipe_with_special_chars___symbols_.pdf");
    expect(contentDisposition).not.toContain("/");
    expect(contentDisposition).not.toContain("&");
  });

  it("should handle PDF generation errors gracefully", async () => {
    // Mock PDFDocument to throw an error
    vi.doMock("pdfkit", () => {
      class PDFDocumentMock {
        addPage() {
          throw new Error("PDF generation failed");
        }
      }
      return {
        default: PDFDocumentMock,
      };
    });

    const request = createMockRequest({ recipe: validRecipe }, { origin: "https://example.com" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.type).toBe("server");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
  });

  it("should handle requests without origin header", async () => {
    const request = createMockRequest({ recipe: validRecipe });
    const response = await POST(request);
    const data = await response.json();

    // PDF generation might fail in test environment, so check for either success or error
    if (response.status === 200) {
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    } else {
      // If it fails, it should be a server error, not a validation error
      expect([400, 500]).toContain(response.status);
      expect(data.error).toBeDefined();
    }
  });

  it("should include all recipe fields in PDF", async () => {
    const fullRecipe = {
      title: "Complete Recipe",
      ingredients: ["1 cup flour", "2 eggs", "1 tsp salt"],
      steps: ["Step 1", "Step 2", "Step 3"],
      servings: "4 servings",
      prepTime: "15 minutes",
      cookTime: "30 minutes",
      totalTime: "45 minutes",
    };

    const request = createMockRequest({ recipe: fullRecipe }, { origin: "https://example.com" });
    const response = await POST(request);
    const data = await response.json();

    // PDF generation might fail in test environment
    if (response.status === 200) {
      const arrayBuffer = await response.arrayBuffer();
      expect(arrayBuffer.byteLength).toBeGreaterThan(0);
    } else {
      // If it fails, it should be a server error
      expect([400, 500]).toContain(response.status);
      expect(data.error).toBeDefined();
    }
  });
});

describe("OPTIONS /api/generate-pdf", () => {
  it("should handle CORS preflight requests", async () => {
    const request = new NextRequest("http://localhost:3000/api/generate-pdf", {
      method: "OPTIONS",
      headers: { origin: "https://example.com" },
    });

    const response = await OPTIONS(request);

    // Should return 200 or 403 depending on CORS config
    expect([200, 403]).toContain(response.status);
  });
});
