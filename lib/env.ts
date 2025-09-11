import { z } from "zod"

/**
 * Environment variables schema for validation
 * Ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Google Gemini API Configuration
  GOOGLE_API_KEY: z
    .string()
    .min(1, "Google API key is required")
    .optional()
    .transform(val => val || "")
    .describe("Google Gemini API key for recipe extraction"),

  // Optional Gemini Configuration
  GEMINI_MODEL: z
    .string()
    .default("gemini-2.0-flash-exp")
    .describe("Gemini model to use for recipe extraction"),

  GEMINI_REQUEST_TIMEOUT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1000).max(120000))
    .default("30000")
    .describe("Request timeout in milliseconds (1-120 seconds)"),

  GEMINI_MAX_RETRIES: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(0).max(5))
    .default("2")
    .describe("Maximum number of retries for failed requests"),

  GEMINI_RETRY_DELAY: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(100).max(10000))
    .default("1000")
    .describe("Base delay between retries in milliseconds"),

  // Next.js Environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development")
    .describe("Node.js environment"),

  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000")
    .describe("Public URL of the application"),
})

/**
 * Cached validated environment variables
 */
let _env: z.infer<typeof envSchema> | null = null

/**
 * Get validated environment variables with lazy loading
 * Use this instead of process.env directly to ensure type safety
 */
export function getEnv(): z.infer<typeof envSchema> {
  if (_env) {
    return _env
  }

  try {
    // TEMPORARY FIX: Add your API key here if .env.local isn't working
    const TEMP_API_KEY = "AIzaSyAND5TH5ptXAUbJWr9AnThKiy5hOba3Egw";
    
    
    _env = envSchema.parse({
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || TEMP_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      GEMINI_REQUEST_TIMEOUT: process.env.GEMINI_REQUEST_TIMEOUT,
      GEMINI_MAX_RETRIES: process.env.GEMINI_MAX_RETRIES,
      GEMINI_RETRY_DELAY: process.env.GEMINI_RETRY_DELAY,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    })
    return _env
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join("\n")

      throw new Error(
        `❌ Invalid environment variables:\n${missingVars}\n\n` +
          `Please check your .env.local file and ensure all required variables are set.`
      )
    }
    throw error
  }
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use getEnv() instead for better error handling
 */
export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(target, prop) {
    const envVars = getEnv()
    return envVars[prop as keyof typeof envVars]
  }
})

/**
 * Type definition for validated environment variables
 */
export type Env = z.infer<typeof envSchema>

/**
 * Runtime check to ensure environment is properly configured
 * Call this during application startup
 */
export function validateEnvironment(): void {
  try {
    const envVars = getEnv()
    console.log(`✅ Environment validated for ${envVars.NODE_ENV} mode`)
    
    if (envVars.NODE_ENV === "development") {
      console.log(`🔧 Using Gemini model: ${envVars.GEMINI_MODEL}`)
      console.log(`⏱️  Request timeout: ${envVars.GEMINI_REQUEST_TIMEOUT}ms`)
      console.log(`🔄 Max retries: ${envVars.GEMINI_MAX_RETRIES}`)
    }
  } catch (error) {
    console.error("❌ Environment validation failed:", error instanceof Error ? error.message : String(error))
    throw error
  }
}
