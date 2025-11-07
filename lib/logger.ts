/**
 * Simple logger utility for development and production
 * In production, only errors are logged to avoid noise
 */

type LogLevel = "log" | "warn" | "error"

function shouldLog(level: LogLevel): boolean {
  if (process.env.NODE_ENV === "production") {
    return level === "error"
  }
  return true
}

export const logger = {
  log: (...args: unknown[]) => {
    if (shouldLog("log")) {
      console.log(...args)
    }
  },
  warn: (...args: unknown[]) => {
    if (shouldLog("warn")) {
      console.warn(...args)
    }
  },
  error: (...args: unknown[]) => {
    if (shouldLog("error")) {
      console.error(...args)
    }
  },
}

