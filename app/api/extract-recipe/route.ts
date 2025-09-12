import { type NextRequest, NextResponse } from "next/server"
import { recipeExtractionService } from "@/lib/recipe-extraction"
import { groqRecipeExtractionService } from "@/lib/groq-extraction"
import { extractionApiRequestSchema, validateRecipeUrl } from "@/lib/schemas"
import { getEnv } from "@/lib/env"
import { getRateLimitKey, checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || undefined
  
  try {
    const body = await request.json()
    let url: string
    let provider: "gemini" | "groq" | undefined
    try {
      const parsed = extractionApiRequestSchema.parse(body)
      url = parsed.url
      provider = parsed.provider
    } catch (validationError) {
      return NextResponse.json(
        { error: { type: "invalid-url", message: "Please provide a valid URL." } },
        { status: 400 },
      )
    }

    // Validate URL input
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        {
          error: {
            type: "invalid-url",
            message: "Please provide a valid URL.",
          },
        },
        { status: 400 },
      )
    }

    // Check rate limit
    const rateLimitKey = getRateLimitKey(request)
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        {
          error: {
            type: "rate-limit",
            message: "Rate limit exceeded. You can extract one recipe per minute. Please try again later.",
          },
        },
        { status: 429 },
      )
    }

    // Validate URL format using schema
    try {
      validateRecipeUrl(url)
    } catch (validationError) {
      return NextResponse.json(
        {
          error: {
            type: "invalid-url",
            message: "Please enter a valid URL starting with http:// or https://.",
          },
        },
        { status: 400 },
      )
    }

    const env = getEnv()
    const selectedProvider: "gemini" | "groq" = provider ?? env.EXTRACTION_PROVIDER
    const service = selectedProvider === "groq" ? groqRecipeExtractionService : recipeExtractionService

    if (!service.isReady()) {
      return NextResponse.json(
        { error: { type: "server", message: "Recipe extraction service is temporarily unavailable. Please try again later." } },
        { status: 503 },
      )
    }

    // Extract recipe using Gemini API
    const result = await service.extractRecipe(url, { requestId })

    // Handle successful extraction
    if (result.recipe) {
      return NextResponse.json({ 
        recipe: result.recipe 
      })
    }

    // Handle extraction errors
    if (result.error) {
      const statusCode = getStatusCodeForErrorType(result.error.type)
      
      return NextResponse.json(
        {
          error: {
            type: result.error.type,
            message: result.error.message,
          },
        },
        { status: statusCode },
      )
    }

    // Should not reach here, but handle just in case
    throw new Error("Invalid extraction result")

  } catch (error) {
    console.error("Recipe extraction API error:", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: {
          type: "server",
          message: "An unexpected error occurred while processing the recipe. Please try again.",
        },
      },
      { status: 500 },
    )
  }
}

/**
 * Map error types to appropriate HTTP status codes
 */
function getStatusCodeForErrorType(errorType: string): number {
  switch (errorType) {
    case "invalid-url":
      return 400
    case "not-recipe":
      return 404
    case "paywall":
    case "content-blocked":
      return 403
    case "url-inaccessible":
      return 404
    case "parsing-failed":
      return 422
    case "ai-unavailable":
      return 503
    case "quota-exceeded":
      return 429
    case "server":
    default:
      return 500
  }
}
