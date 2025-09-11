import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('GOOGLE') || key.includes('GEMINI')),
    // Don't expose the actual key value for security
  })
}
