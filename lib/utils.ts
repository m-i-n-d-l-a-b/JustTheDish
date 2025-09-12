import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Simple ISO 8601 duration detector (supports weeks, days, hours, minutes, seconds)
const ISO_DURATION_REGEX = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i

export function isIso8601Duration(value: string): boolean {
  return ISO_DURATION_REGEX.test(value.trim())
}

export function formatIsoDurationToHuman(value: string): string | null {
  const match = ISO_DURATION_REGEX.exec(value.trim())
  if (!match) return null
  const weeks = match[1] ? parseInt(match[1], 10) : 0
  const days = match[2] ? parseInt(match[2], 10) : 0
  const hours = match[3] ? parseInt(match[3], 10) : 0
  const minutes = match[4] ? parseInt(match[4], 10) : 0
  const seconds = match[5] ? parseInt(match[5], 10) : 0

  const parts: string[] = []
  if (weeks) parts.push(`${weeks} week${weeks === 1 ? "" : "s"}`)
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`)
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`)
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`)
  if (seconds && parts.length === 0) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`)

  if (parts.length === 0) return null
  return parts.join(" ")
}
