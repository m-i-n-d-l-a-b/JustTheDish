import { type NextRequest, NextResponse } from "next/server";
import { groqRecipeExtractionService } from "@/lib/groq-extraction";
import { extractionApiRequestSchema, validateRecipeUrl } from "@/lib/schemas";
import { getRateLimitKey, checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { addCorsHeaders, handleCorsPreflight } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const response = handleCorsPreflight(origin);
  return response ?? new NextResponse(null, { status: 403 });
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || undefined;
  const origin = request.headers.get("origin");

  try {
    // Check request body size (1MB limit)
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 1024 * 1024) {
      const response = NextResponse.json(
        { error: { type: "server", message: "Request body too large (maximum 1MB)" } },
        { status: 413 }
      );
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    let url: string;
    try {
      const parsed = extractionApiRequestSchema.parse(body);
      url = parsed.url;
    } catch (validationError) {
      const response = NextResponse.json(
        { error: { type: "invalid-url", message: "Please provide a valid URL." } },
        { status: 400 }
      );
      return addCorsHeaders(response, origin);
    }

    // Validate URL input
    if (!url || typeof url !== "string") {
      const response = NextResponse.json(
        {
          error: {
            type: "invalid-url",
            message: "Please provide a valid URL.",
          },
        },
        { status: 400 }
      );
      return addCorsHeaders(response, origin);
    }

    // Check rate limit
    const rateLimitKey = getRateLimitKey(request);
    if (!checkRateLimit(rateLimitKey)) {
      const response = NextResponse.json(
        {
          error: {
            type: "rate-limit",
            message:
              "Rate limit exceeded. You can extract one recipe per minute. Please try again later.",
          },
        },
        { status: 429 }
      );
      return addCorsHeaders(response, origin);
    }

    // Validate URL format using schema
    try {
      validateRecipeUrl(url);
    } catch (validationError) {
      const response = NextResponse.json(
        {
          error: {
            type: "invalid-url",
            message: "Please enter a valid URL starting with http:// or https://.",
          },
        },
        { status: 400 }
      );
      return addCorsHeaders(response, origin);
    }

    if (!groqRecipeExtractionService.isReady()) {
      const response = NextResponse.json(
        {
          error: {
            type: "server",
            message:
              "Recipe extraction service is temporarily unavailable. Please try again later.",
          },
        },
        { status: 503 }
      );
      return addCorsHeaders(response, origin);
    }

    // Extract recipe using Groq API
    const result = await groqRecipeExtractionService.extractRecipe(url, { requestId });

    // Handle successful extraction
    if (result.recipe) {
      const response = NextResponse.json({
        recipe: result.recipe,
      });
      return addCorsHeaders(response, origin);
    }

    // Handle extraction errors
    if (result.error) {
      const statusCode = getStatusCodeForErrorType(result.error.type);

      const response = NextResponse.json(
        {
          error: {
            type: result.error.type,
            message: result.error.message,
          },
        },
        { status: statusCode }
      );
      return addCorsHeaders(response, origin);
    }

    // Should not reach here, but handle just in case
    throw new Error("Invalid extraction result");
  } catch (error) {
    logger.error("Recipe extraction API error:", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const response = NextResponse.json(
      {
        error: {
          type: "server",
          message: "An unexpected error occurred while processing the recipe. Please try again.",
        },
      },
      { status: 500 }
    );
    return addCorsHeaders(response, origin);
  }
}

/**
 * Map error types to appropriate HTTP status codes
 */
function getStatusCodeForErrorType(errorType: string): number {
  switch (errorType) {
    case "invalid-url":
      return 400;
    case "not-recipe":
      return 404;
    case "paywall":
    case "content-blocked":
      return 403;
    case "url-inaccessible":
      return 404;
    case "parsing-failed":
      return 422;
    case "ai-unavailable":
      return 503;
    case "quota-exceeded":
      return 429;
    case "server":
    default:
      return 500;
  }
}
