import { afterEach, describe, expect, it, vi } from "vitest"

import { workableAdapter } from "@/lib/ats/adapters/workable"

function mockFetchOnce(response: { ok: boolean; status: number; json?: () => Promise<unknown> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValueOnce({
      ok: response.ok,
      status: response.status,
      json: response.json ?? (() => Promise.resolve({})),
    })
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("workableAdapter.detectPlatform", () => {
  it("recognizes apply.workable.com URLs", () => {
    expect(workableAdapter.detectPlatform("https://apply.workable.com/acme/j/ABCD1234/")).toBe(
      true
    )
  })

  it("rejects URLs from other platforms", () => {
    expect(workableAdapter.detectPlatform("https://boards.greenhouse.io/acme")).toBe(false)
    expect(workableAdapter.detectPlatform("https://jobs.lever.co/acme")).toBe(false)
  })

  it("returns false instead of throwing on a malformed URL", () => {
    expect(workableAdapter.detectPlatform("not a url")).toBe(false)
  })
})

describe("workableAdapter.fetchJobs", () => {
  it("maps a successful response into RawJob[], using the real company name when present", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          name: "Acme Inc.",
          jobs: [
            {
              title: "Backend Engineer",
              shortcode: "ABCD1234",
              department: "Engineering",
              url: "https://apply.workable.com/acme/j/ABCD1234/",
              created_at: "2025-01-01T00:00:00.000Z",
              city: "San Francisco",
              state: "California",
              country: "United States",
            },
          ],
        }),
    })

    const jobs = await workableAdapter.fetchJobs("acme")

    expect(jobs).toEqual([
      {
        sourceId: "ABCD1234",
        platform: "workable",
        title: "Backend Engineer",
        company: "Acme Inc.",
        location: "San Francisco, California, United States",
        department: "Engineering",
        description: undefined,
        jobUrl: "https://apply.workable.com/acme/j/ABCD1234/",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ])
  })

  it("falls back to the account token as company name when the API doesn't return one", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          jobs: [
            {
              title: "Designer",
              shortcode: "XYZ999",
              url: "https://apply.workable.com/acme/j/XYZ999/",
            },
          ],
        }),
    })

    const jobs = await workableAdapter.fetchJobs("acme")
    expect(jobs[0].company).toBe("acme")
    expect(jobs[0].location).toBeUndefined()
  })

  it("returns an empty array when the response has no jobs field", async () => {
    mockFetchOnce({ ok: true, status: 200, json: () => Promise.resolve({ name: "Acme" }) })
    expect(await workableAdapter.fetchJobs("acme")).toEqual([])
  })

  it("throws a clear error on 404 (unknown account token)", async () => {
    mockFetchOnce({ ok: false, status: 404 })
    await expect(workableAdapter.fetchJobs("not-a-real-company")).rejects.toThrow(/not found/i)
  })

  it("throws a clear error on 429 (rate limited)", async () => {
    mockFetchOnce({ ok: false, status: 429 })
    await expect(workableAdapter.fetchJobs("acme")).rejects.toThrow(/rate limit/i)
  })

  it("throws a clear error on other non-OK statuses", async () => {
    mockFetchOnce({ ok: false, status: 500 })
    await expect(workableAdapter.fetchJobs("acme")).rejects.toThrow(/500/)
  })
})

describe("workableAdapter.submitApplication", () => {
  it("is a documented not-yet-implemented stub (Phase 5 scope)", async () => {
    const result = await workableAdapter.submitApplication(
      { id: "1", platform: "workable", sourceId: "ABCD1234", jobUrl: "https://x" },
      { userId: "u1" }
    )
    expect(result.status).toBe("failed")
    expect(result.message).toMatch(/not implemented/i)
  })
})
