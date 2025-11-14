import { type NextRequest, NextResponse } from "next/server";
import { ERROR_MESSAGES, HTTP_STATUS, REQUEST_SIZE_LIMITS } from "@/lib/constants";
import { addCorsHeaders, handleCorsPreflight } from "@/lib/cors";
import { getStatusCodeForErrorType } from "@/lib/errors";
import { groqRecipeExtractionService } from "@/lib/groq-extraction";
import { logger } from "@/lib/logger";
import { checkRateLimitWithInfo, getRateLimitKey } from "@/lib/rate-limit";
import { extractionApiRequestSchema, validateRecipeUrl } from "@/lib/schemas";

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
    // Check request body size
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > REQUEST_SIZE_LIMITS.EXTRACT_RECIPE) {
      const response = NextResponse.json(
        { error: { type: "server", message: ERROR_MESSAGES.REQUEST_TOO_LARGE_EXTRACT } },
        { status: HTTP_STATUS.PAYLOAD_TOO_LARGE }
      );
      return addCorsHeaders(response, origin);
    }

    const body = await request.json();
    let url: string;
    try {
      const parsed = extractionApiRequestSchema.parse(body);
      url = parsed.url;
    } catch (_validationError) {
      const response = NextResponse.json(
        { error: { type: "invalid-url", message: ERROR_MESSAGES.INVALID_URL } },
        { status: HTTP_STATUS.BAD_REQUEST }
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
    const rateLimitInfo = checkRateLimitWithInfo(rateLimitKey);
    if (!rateLimitInfo.allowed) {
      const response = NextResponse.json(
        {
          error: {
            type: "rate-limit",
            message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
          },
        },
        { status: HTTP_STATUS.TOO_MANY_REQUESTS }
      );
      response.headers.set("X-RateLimit-Limit", rateLimitInfo.limit.toString());
      response.headers.set("X-RateLimit-Remaining", rateLimitInfo.remaining.toString());
      response.headers.set("X-RateLimit-Reset", rateLimitInfo.reset.toString());
      return addCorsHeaders(response, origin);
    }

    // Validate URL format using schema
    try {
      validateRecipeUrl(url);
    } catch (_validationError) {
      const response = NextResponse.json(
        {
          error: {
            type: "invalid-url",
            message: ERROR_MESSAGES.INVALID_URL,
          },
        },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
      return addCorsHeaders(response, origin);
    }

    if (!groqRecipeExtractionService.isReady()) {
      const response = NextResponse.json(
        {
          error: {
            type: "server",
            message: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
          },
        },
        { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
      );
      return addCorsHeaders(response, origin);
    }

    // Extract recipe using Groq API
    const result = await groqRecipeExtractionService.extractRecipe(url, { requestId });

    // Reuse rate limit info from the initial check (line 62) to avoid double-incrementing
    // The rate limit info already reflects the current state after the first check

    // Handle successful extraction
    if (result.recipe) {
      const response = NextResponse.json({
        recipe: result.recipe,
      });
      response.headers.set("X-RateLimit-Limit", rateLimitInfo.limit.toString());
      response.headers.set("X-RateLimit-Remaining", rateLimitInfo.remaining.toString());
      response.headers.set("X-RateLimit-Reset", rateLimitInfo.reset.toString());
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
      response.headers.set("X-RateLimit-Limit", rateLimitInfo.limit.toString());
      response.headers.set("X-RateLimit-Remaining", rateLimitInfo.remaining.toString());
      response.headers.set("X-RateLimit-Reset", rateLimitInfo.reset.toString());
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
          message: ERROR_MESSAGES.UNEXPECTED_ERROR,
        },
      },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
    return addCorsHeaders(response, origin);
  }
}
