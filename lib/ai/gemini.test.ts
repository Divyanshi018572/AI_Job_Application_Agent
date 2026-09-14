import { describe, expect, it } from "vitest"

import { normalizeParsedResume } from "@/lib/ai/gemini"
import type { ParsedResume } from "@/types/resume"

describe("normalizeParsedResume", () => {
  it("fills in every field with a safe default when the model returns an empty object", () => {
    const result = normalizeParsedResume({})

    expect(result.profile.fullName).toBe("")
    expect(result.profile.links?.linkedin).toBe("")
    expect(result.summary).toBe("")
    expect(result.skills).toEqual([])
    expect(result.workExperience).toEqual([])
    expect(result.education).toEqual([])
    expect(result.projects).toEqual([])
    expect(result.certifications).toEqual([])
  })

  it("preserves genuine values and assigns stable ids to list items missing one", () => {
    const result = normalizeParsedResume({
      profile: {
        fullName: "Jane Doe",
        email: "jane@example.com",
        phone: "",
        location: "",
        links: { linkedin: "", github: "", portfolio: "", twitter: "", other: "" },
      },
      skills: ["TypeScript", "SQL"],
      workExperience: [
        {
          company: "Acme",
          title: "Engineer",
          duration: "2020-2024",
          startDate: "2020",
          endDate: "2024",
          location: "Remote",
          responsibilities: ["Shipped things"],
        },
      ],
    })

    expect(result.profile.fullName).toBe("Jane Doe")
    expect(result.skills).toEqual(["TypeScript", "SQL"])
    expect(result.workExperience).toHaveLength(1)
    expect(result.workExperience[0].id).toBe("exp-0")
    expect(result.workExperience[0].company).toBe("Acme")
  })

  it("coerces non-array list fields to empty arrays instead of throwing", () => {
    // Guards against a malformed/partial LLM response taking down the whole
    // upload route — normalizeParsedResume is the last line of defense
    // before parsed data is written into profiles.
    const result = normalizeParsedResume({
      skills: "not-an-array" as unknown as string[],
      education: undefined,
    })

    expect(result.skills).toEqual([])
    expect(result.education).toEqual([])
  })

  it("normalizes fieldConfidence from the model response (Plan Task 1.3)", () => {
    // LLM output isn't type-checked at the source — build the raw payload
    // as untyped JSON (as a real model response would arrive) rather than
    // through the strict ParsedResume type, so this actually exercises the
    // "the model hallucinated a field we didn't ask for" path.
    const rawModelResponse = JSON.parse(
      JSON.stringify({
        fieldConfidence: {
          "profile.fullName": 0.95,
          summary: 0.4,
          "profile.notARealField": 0.9,
        },
      })
    ) as Partial<ParsedResume>

    const result = normalizeParsedResume(rawModelResponse)

    expect(result.fieldConfidence).toEqual({
      "profile.fullName": 0.95,
      summary: 0.4,
    })
  })

  it("omits fieldConfidence entirely when the model didn't return one", () => {
    const result = normalizeParsedResume({})
    expect(result.fieldConfidence).toBeUndefined()
  })
})
