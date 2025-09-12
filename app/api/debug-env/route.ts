import { NextResponse } from "next/server"
import { getEnv } from "@/lib/env"

export async function GET() {
  const env = getEnv()
  return NextResponse.json({
    nodeEnv: env.NODE_ENV,
    hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
    hasGroqApiKey: !!process.env.GROQ_API_KEY,
    defaultProvider: env.EXTRACTION_PROVIDER,
    geminiModel: env.GEMINI_MODEL,
    groqModel: env.GROQ_MODEL,
  })
}
