import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { classifyJob, normalizeClassification } from "@/lib/jobs/classify"
import type { RawJob } from "@/lib/ats/types"

const sampleJob: RawJob = {
  sourceId: "1",
  platform: "greenhouse",
  title: "Senior Backend Engineer",
  company: "Acme",
  location: "Remote (US)",
  jobUrl: "https://boards.greenhouse.io/acme/jobs/1",
  description: "5+ years of experience. Full-time. Fully remote role.",
}

describe("normalizeClassification", () => {
  it("keeps valid enum values for every field", () => {
    const result = normalizeClassification({
      experienceLevel: "5+",
      employmentType: "Full-time",
      workMode: "Remote",
    })
    expect(result).toEqual({
      experienceLevel: "5+",
      employmentType: "Full-time",
      workMode: "Remote",
    })
  })

  it("nulls out a hallucinated value that isn't one of the allowed enums", () => {
    const result = normalizeClassification({
      experienceLevel: "Staff-Principal", // not a real option
      employmentType: "Full-time",
      workMode: "Remote",
    })
    expect(result.experienceLevel).toBeNull()
    expect(result.employmentType).toBe("Full-time")
  })

  it("nulls out wrong-casing or non-string values instead of guessing", () => {
    const result = normalizeClassification({
      experienceLevel: "full-time", // wrong field's value, wrong case
      employmentType: 1,
      workMode: null,
    })
    expect(result).toEqual({
      experienceLevel: null,
      employmentType: null,
      workMode: null,
    })
  })

  it("returns all-null for missing, non-object, or empty input", () => {
    const allNull = { experienceLevel: null, employmentType: null, workMode: null }
    expect(normalizeClassification(undefined)).toEqual(allNull)
    expect(normalizeClassification(null)).toEqual(allNull)
    expect(normalizeClassification("not an object")).toEqual(allNull)
    expect(normalizeClassification({})).toEqual(allNull)
  })
})

describe("classifyJob", () => {
  const originalEnv = process.env.NVIDIA_API_KEY

  beforeEach(() => {
    process.env.NVIDIA_API_KEY = "test-key"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env.NVIDIA_API_KEY = originalEnv
  })

  function mockNvidiaResponse(content: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ choices: [{ message: { content } }] }),
      })
    )
  }

  it("classifies a job from a valid JSON response", async () => {
    mockNvidiaResponse(
      JSON.stringify({
        experienceLevel: "5+",
        employmentType: "Full-time",
        workMode: "Remote",
      })
    )

    const result = await classifyJob(sampleJob)
    expect(result).toEqual({
      experienceLevel: "5+",
      employmentType: "Full-time",
      workMode: "Remote",
    })
  })

  it("strips markdown code fences before parsing", async () => {
    mockNvidiaResponse(
      '```json\n{"experienceLevel":"Fresher","employmentType":"Internship","workMode":"Onsite"}\n```'
    )

    const result = await classifyJob(sampleJob)
    expect(result.experienceLevel).toBe("Fresher")
  })

  it("returns an all-null classification instead of throwing on malformed JSON", async () => {
    mockNvidiaResponse("not valid json at all")

    const result = await classifyJob(sampleJob)
    expect(result).toEqual({
      experienceLevel: null,
      employmentType: null,
      workMode: null,
    })
  })

  it("wraps the job description in untrusted-data delimiters in the prompt sent to the model", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  experienceLevel: null,
                  employmentType: null,
                  workMode: null,
                }),
              },
            },
          ],
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await classifyJob(sampleJob)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const sentPrompt: string = body.messages[0].content
    expect(sentPrompt).toContain("<untrusted_job_description>")
    expect(sentPrompt).toContain(sampleJob.description)
  })
})
