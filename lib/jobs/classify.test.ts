import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { classificationModels, classifyJob, normalizeClassification } from "@/lib/jobs/classify"
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

  it("sends plain text to the model, not Greenhouse's escaped HTML, and caps its length", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '{"experienceLevel":null,"employmentType":null,"workMode":null}' } }],
        }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await classifyJob({
      ...sampleJob,
      description:
        "&lt;p&gt;&lt;strong&gt;5+ years&lt;/strong&gt; required.&lt;/p&gt;" + " filler".repeat(3000),
    })

    const sentPrompt: string = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content
    expect(sentPrompt).toContain("5+ years required.")
    expect(sentPrompt).not.toContain("&lt;")
    expect(sentPrompt).not.toContain("<strong>")
    // 6000-char cap on the description, plus the fixed instructions around it
    expect(sentPrompt.length).toBeLessThan(8000)
  })

  it("extracts the JSON object when the model wraps it in prose", async () => {
    mockNvidiaResponse(
      'Here is the classification: {"experienceLevel":"1-3","employmentType":"Contract","workMode":"Hybrid"} Hope that helps!'
    )

    const result = await classifyJob(sampleJob)
    expect(result).toEqual({
      experienceLevel: "1-3",
      employmentType: "Contract",
      workMode: "Hybrid",
    })
  })
})

describe("classifyJob — retries and model fallback", () => {
  const originalKey = process.env.NVIDIA_API_KEY
  const originalModel = process.env.NVIDIA_CLASSIFICATION_MODEL
  const noSleep = () => Promise.resolve()

  const okReply = (content: object) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ choices: [{ message: { content: JSON.stringify(content) } }] }),
  })
  const errorReply = (status: number) => ({
    ok: false,
    status,
    text: () => Promise.resolve(`error ${status}`),
    json: () => Promise.resolve({}),
  })
  const modelsCalled = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).model)

  beforeEach(() => {
    process.env.NVIDIA_API_KEY = "test-key"
    delete process.env.NVIDIA_CLASSIFICATION_MODEL
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env.NVIDIA_API_KEY = originalKey
    if (originalModel === undefined) delete process.env.NVIDIA_CLASSIFICATION_MODEL
    else process.env.NVIDIA_CLASSIFICATION_MODEL = originalModel
  })

  it("defaults to nemotron-3-super first, gpt-oss-20b as fallback", () => {
    expect(classificationModels()).toEqual([
      "nvidia/nemotron-3-super-120b-a12b",
      "openai/gpt-oss-20b",
    ])
  })

  it("puts NVIDIA_CLASSIFICATION_MODEL first and keeps the defaults as fallbacks", () => {
    process.env.NVIDIA_CLASSIFICATION_MODEL = "some/new-model"
    expect(classificationModels()).toEqual([
      "some/new-model",
      "nvidia/nemotron-3-super-120b-a12b",
      "openai/gpt-oss-20b",
    ])
  })

  it("doesn't list a default twice when it's also the override", () => {
    process.env.NVIDIA_CLASSIFICATION_MODEL = "openai/gpt-oss-20b"
    expect(classificationModels()).toEqual([
      "openai/gpt-oss-20b",
      "nvidia/nemotron-3-super-120b-a12b",
    ])
  })

  it("retries a transient 503 on the same model before succeeding", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorReply(503))
      .mockResolvedValueOnce(okReply({ experienceLevel: "5+", employmentType: null, workMode: null }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await classifyJob(sampleJob, { sleep: noSleep })

    expect(result.experienceLevel).toBe("5+")
    expect(modelsCalled(fetchMock)).toEqual([
      "nvidia/nemotron-3-super-120b-a12b",
      "nvidia/nemotron-3-super-120b-a12b",
    ])
  })

  it("moves to the fallback model immediately when the primary is retired (410), without retrying it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorReply(410))
      .mockResolvedValueOnce(okReply({ experienceLevel: null, employmentType: "Full-time", workMode: null }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await classifyJob(sampleJob, { sleep: noSleep })

    expect(result.employmentType).toBe("Full-time")
    expect(modelsCalled(fetchMock)).toEqual([
      "nvidia/nemotron-3-super-120b-a12b",
      "openai/gpt-oss-20b",
    ])
  })

  it("moves to the fallback model once retries on the primary are exhausted", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorReply(503))
      .mockResolvedValueOnce(errorReply(503))
      .mockResolvedValueOnce(errorReply(503))
      .mockResolvedValueOnce(okReply({ experienceLevel: null, employmentType: null, workMode: "Onsite" }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await classifyJob(sampleJob, { sleep: noSleep })

    expect(result.workMode).toBe("Onsite")
    expect(modelsCalled(fetchMock).slice(-1)).toEqual(["openai/gpt-oss-20b"])
  })

  it("throws (rather than returning all-null) when every model fails, so ingestion can report it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorReply(410)))

    await expect(classifyJob(sampleJob, { sleep: noSleep })).rejects.toThrow(/410/)
  })

  it("surfaces a missing API key without ever calling the API", async () => {
    delete process.env.NVIDIA_API_KEY
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(classifyJob(sampleJob, { sleep: noSleep })).rejects.toThrow(/NVIDIA_API_KEY/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
