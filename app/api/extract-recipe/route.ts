import { type NextRequest, NextResponse } from "next/server"
import { recipeExtractionService } from "@/lib/recipe-extraction"
import { validateRecipeUrl } from "@/lib/schemas"

// Simple in-memory rate limiting (in production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0] : request.ip || "unknown"
  return ip
}

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 60 * 1000 // 1 hour
  const maxRequests = 10

  const current = rateLimitMap.get(key)

  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (current.count >= maxRequests) {
    return false
  }

  current.count++
  return true
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || undefined
  
  try {
    const { url } = await request.json()

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
            message: "Rate limit exceeded. You can extract up to 10 recipes per hour. Please try again later.",
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

    // Check if extraction service is available
    if (!recipeExtractionService.isReady()) {
      return NextResponse.json(
        {
          error: {
            type: "server",
            message: "Recipe extraction service is temporarily unavailable. Please try again later.",
          },
        },
        { status: 503 },
      )
    }

    // Extract recipe using Gemini API
    const result = await recipeExtractionService.extractRecipe(url, { requestId })

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
