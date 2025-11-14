import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS class names.
 * Combines clsx for conditional classes and twMerge to resolve Tailwind conflicts.
 *
 * @param inputs - Variable number of class values (strings, objects, arrays)
 * @returns A merged class string with resolved Tailwind conflicts
 *
 * @example
 * ```typescript
 * cn("px-2 py-1", "px-4", { "bg-red": isActive });
 * // Returns: "py-1 px-4 bg-red" (px-2 is overridden by px-4)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Simple ISO 8601 duration detector (supports weeks, days, hours, minutes, seconds)
const ISO_DURATION_REGEX = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i;

/**
 * Checks if a string is a valid ISO 8601 duration format.
 * Supports weeks, days, hours, minutes, and seconds (e.g., "PT15M", "P1DT2H30M").
 *
 * @param value - The string to check
 * @returns True if the string matches ISO 8601 duration format, false otherwise
 *
 * @example
 * ```typescript
 * isIso8601Duration("PT15M"); // Returns true
 * isIso8601Duration("15 minutes"); // Returns false
 * ```
 */
export function isIso8601Duration(value: string): boolean {
  return ISO_DURATION_REGEX.test(value.trim());
}

/**
 * Converts an ISO 8601 duration string to a human-readable format.
 * Returns null if the input is not a valid ISO 8601 duration.
 *
 * @param value - The ISO 8601 duration string to convert
 * @returns A human-readable duration string (e.g., "15 minutes", "1 hour 30 minutes"), or null if invalid
 *
 * @example
 * ```typescript
 * formatIsoDurationToHuman("PT15M"); // Returns "15 minutes"
 * formatIsoDurationToHuman("P1DT2H30M"); // Returns "1 day 2 hours 30 minutes"
 * formatIsoDurationToHuman("invalid"); // Returns null
 * ```
 */
export function formatIsoDurationToHuman(value: string): string | null {
  const match = ISO_DURATION_REGEX.exec(value.trim());
  if (!match) return null;
  const weeks = match[1] ? parseInt(match[1], 10) : 0;
  const days = match[2] ? parseInt(match[2], 10) : 0;
  const hours = match[3] ? parseInt(match[3], 10) : 0;
  const minutes = match[4] ? parseInt(match[4], 10) : 0;
  const seconds = match[5] ? parseInt(match[5], 10) : 0;

  const parts: string[] = [];
  if (weeks) parts.push(`${weeks} week${weeks === 1 ? "" : "s"}`);
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (seconds && parts.length === 0) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);

  if (parts.length === 0) return null;
  return parts.join(" ");
}
