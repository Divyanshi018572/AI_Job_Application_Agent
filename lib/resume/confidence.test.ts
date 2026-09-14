import { describe, expect, it } from "vitest"

import {
  getFieldConfidence,
  isFieldLowConfidence,
  isLowConfidence,
  LOW_CONFIDENCE_THRESHOLD,
  normalizeFieldConfidence,
} from "@/lib/resume/confidence"

describe("normalizeFieldConfidence", () => {
  it("keeps only known confidence fields with valid numeric scores", () => {
    const result = normalizeFieldConfidence({
      "profile.fullName": 0.95,
      summary: 0.3,
      skills: 1,
    })
    expect(result).toEqual({
      "profile.fullName": 0.95,
      summary: 0.3,
      skills: 1,
    })
  })

  it("drops unknown keys the model might hallucinate", () => {
    const result = normalizeFieldConfidence({
      "profile.fullName": 0.9,
      "profile.madeUpField": 0.9,
      somethingElse: 0.5,
    })
    expect(result).toEqual({ "profile.fullName": 0.9 })
  })

  it("drops non-numeric or out-of-range-but-uncoercible values rather than guessing", () => {
    const result = normalizeFieldConfidence({
      "profile.fullName": "high",
      "profile.email": NaN,
      "profile.phone": null,
      summary: 0.5,
    })
    expect(result).toEqual({ summary: 0.5 })
  })

  it("clamps out-of-range numeric scores into [0, 1]", () => {
    const result = normalizeFieldConfidence({
      "profile.fullName": 1.5,
      summary: -0.2,
    })
    expect(result).toEqual({ "profile.fullName": 1, summary: 0 })
  })

  it("returns undefined for missing, empty, or non-object input", () => {
    expect(normalizeFieldConfidence(undefined)).toBeUndefined()
    expect(normalizeFieldConfidence(null)).toBeUndefined()
    expect(normalizeFieldConfidence("not an object")).toBeUndefined()
    expect(normalizeFieldConfidence({})).toBeUndefined()
    expect(normalizeFieldConfidence({ unknownOnly: 0.9 })).toBeUndefined()
  })
})

describe("isLowConfidence", () => {
  it("flags scores below the threshold", () => {
    expect(isLowConfidence(0)).toBe(true)
    expect(isLowConfidence(LOW_CONFIDENCE_THRESHOLD - 0.01)).toBe(true)
  })

  it("does not flag scores at or above the threshold", () => {
    expect(isLowConfidence(LOW_CONFIDENCE_THRESHOLD)).toBe(false)
    expect(isLowConfidence(1)).toBe(false)
  })

  it("treats a missing score as 'not assessed', not 'low' — critical for backward compatibility with resumes parsed before this feature existed", () => {
    expect(isLowConfidence(undefined)).toBe(false)
  })
})

describe("getFieldConfidence / isFieldLowConfidence", () => {
  const map = { "profile.fullName": 0.4, summary: 0.9 }

  it("reads a known field's score", () => {
    expect(getFieldConfidence(map, "profile.fullName")).toBe(0.4)
    expect(getFieldConfidence(map, "summary")).toBe(0.9)
  })

  it("returns undefined for a field with no reported score, not zero", () => {
    expect(getFieldConfidence(map, "skills")).toBeUndefined()
  })

  it("flags only fields whose reported score is actually low", () => {
    expect(isFieldLowConfidence(map, "profile.fullName")).toBe(true)
    expect(isFieldLowConfidence(map, "summary")).toBe(false)
    expect(isFieldLowConfidence(map, "skills")).toBe(false)
  })

  it("never flags anything when the whole map is undefined (old resumes)", () => {
    expect(isFieldLowConfidence(undefined, "profile.fullName")).toBe(false)
  })
})
