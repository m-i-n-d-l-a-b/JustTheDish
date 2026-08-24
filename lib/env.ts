import { z } from "zod";
import { logger } from "./logger";

/**
 * Environment variables schema for validation
 * Ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Groq API Configuration
  GROQ_API_KEY: z.string().optional().describe("Groq API key for recipe extraction"),
  GROQ_MODEL: z
    .string()
    .default("qwen/qwen3.6-27b")
    .describe("Groq model to use for recipe extraction"),
  GROQ_REQUEST_TIMEOUT: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(1000).max(120000))
    .default("30000")
    .describe("Groq request timeout in milliseconds (1-120 seconds)"),
  GROQ_MAX_RETRIES: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(0).max(5))
    .default("2")
    .describe("Groq maximum number of retries for failed requests"),
  GROQ_RETRY_DELAY: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(z.number().min(100).max(10000))
    .default("1000")
    .describe("Groq base delay between retries in milliseconds"),

  // Groq feature flags
  GROQ_REPAIR_INGREDIENT_SPACING: z
    .string()
    .transform(v => String(v ?? "").toLowerCase() === "true")
    .default("false")
    .describe(
      "If true, apply minimal spacing repair on ingredients when obvious concatenation is detected"
    ),

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

  // CORS Configuration
  ALLOWED_ORIGINS: z
    .string()
    .default("*")
    .describe("Comma-separated list of allowed CORS origins, or * for all"),
});

/**
 * Cached validated environment variables
 */
let _env: z.infer<typeof envSchema> | null = null;

/**
 * Get validated environment variables with lazy loading
 * Use this instead of process.env directly to ensure type safety
 */
/**
 * Gets validated environment variables.
 * Validates all environment variables against the schema and caches the result.
 * Throws a descriptive error if validation fails.
 *
 * @returns A validated environment variables object
 * @throws {Error} If environment variables are missing or invalid
 *
 * @example
 * ```typescript
 * try {
 *   const env = getEnv();
 *   const apiKey = env.GROQ_API_KEY;
 * } catch (error) {
 *   console.error("Environment validation failed:", error.message);
 * }
 * ```
 */
export function getEnv(): z.infer<typeof envSchema> {
  if (_env) {
    return _env;
  }

  try {
    _env = envSchema.parse({
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      GROQ_MODEL: process.env.GROQ_MODEL,
      GROQ_REQUEST_TIMEOUT: process.env.GROQ_REQUEST_TIMEOUT,
      GROQ_MAX_RETRIES: process.env.GROQ_MAX_RETRIES,
      GROQ_RETRY_DELAY: process.env.GROQ_RETRY_DELAY,
      GROQ_REPAIR_INGREDIENT_SPACING: process.env.GROQ_REPAIR_INGREDIENT_SPACING,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    });
    return _env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map(err => `${err.path.join(".")}: ${err.message}`)
        .join("\n");

      throw new Error(
        `❌ Invalid environment variables:\n${missingVars}\n\n` +
          `Please check your .env.local file and ensure all required variables are set.`
      );
    }
    throw error;
  }
}


/**
 * Type definition for validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

