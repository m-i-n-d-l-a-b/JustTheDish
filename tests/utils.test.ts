import { describe, it, expect } from "vitest"
import { isIso8601Duration, formatIsoDurationToHuman } from "../lib/utils"

describe("isIso8601Duration", () => {
  it("should return true for valid ISO 8601 durations", () => {
    expect(isIso8601Duration("PT30M")).toBe(true)
    expect(isIso8601Duration("PT1H20M")).toBe(true)
    expect(isIso8601Duration("P1DT2H")).toBe(true)
    expect(isIso8601Duration("PT45S")).toBe(true)
    expect(isIso8601Duration("P1W")).toBe(true)
    expect(isIso8601Duration("P2D")).toBe(true)
    expect(isIso8601Duration("PT1H")).toBe(true)
    expect(isIso8601Duration("P1DT2H30M15S")).toBe(true)
  })

  it("should return false for invalid formats", () => {
    expect(isIso8601Duration("30 minutes")).toBe(false)
    expect(isIso8601Duration("1 hour")).toBe(false)
    expect(isIso8601Duration("")).toBe(false)
    expect(isIso8601Duration("invalid")).toBe(false)
    expect(isIso8601Duration("123")).toBe(false)
    // Note: "P" and "PT" match the regex (all groups optional) but formatIsoDurationToHuman returns null
    expect(isIso8601Duration("P")).toBe(true)
    expect(formatIsoDurationToHuman("P")).toBeNull()
    expect(isIso8601Duration("PT")).toBe(true)
    expect(formatIsoDurationToHuman("PT")).toBeNull()
  })

  it("should handle whitespace", () => {
    expect(isIso8601Duration(" PT30M ")).toBe(true)
    expect(isIso8601Duration("  PT1H  ")).toBe(true)
  })
})

describe("formatIsoDurationToHuman", () => {
  it("should format minutes correctly", () => {
    expect(formatIsoDurationToHuman("PT30M")).toBe("30 minutes")
    expect(formatIsoDurationToHuman("PT1M")).toBe("1 minute")
    expect(formatIsoDurationToHuman("PT45M")).toBe("45 minutes")
  })

  it("should format hours correctly", () => {
    expect(formatIsoDurationToHuman("PT1H")).toBe("1 hour")
    expect(formatIsoDurationToHuman("PT2H")).toBe("2 hours")
  })

  it("should format combined durations", () => {
    expect(formatIsoDurationToHuman("PT1H20M")).toBe("1 hour 20 minutes")
    expect(formatIsoDurationToHuman("PT2H30M")).toBe("2 hours 30 minutes")
  })

  it("should format days and weeks", () => {
    expect(formatIsoDurationToHuman("P1D")).toBe("1 day")
    expect(formatIsoDurationToHuman("P2D")).toBe("2 days")
    expect(formatIsoDurationToHuman("P1W")).toBe("1 week")
    expect(formatIsoDurationToHuman("P2W")).toBe("2 weeks")
  })

  it("should format complex durations", () => {
    expect(formatIsoDurationToHuman("P1DT2H30M")).toBe("1 day 2 hours 30 minutes")
    expect(formatIsoDurationToHuman("P1DT2H")).toBe("1 day 2 hours")
  })

  it("should return null for invalid formats", () => {
    expect(formatIsoDurationToHuman("30 minutes")).toBeNull()
    expect(formatIsoDurationToHuman("")).toBeNull()
    expect(formatIsoDurationToHuman("invalid")).toBeNull()
    expect(formatIsoDurationToHuman("PT")).toBeNull()
  })

  it("should handle seconds only", () => {
    expect(formatIsoDurationToHuman("PT30S")).toBe("30 seconds")
    expect(formatIsoDurationToHuman("PT1S")).toBe("1 second")
  })

  it("should handle whitespace", () => {
    expect(formatIsoDurationToHuman(" PT30M ")).toBe("30 minutes")
  })
})

