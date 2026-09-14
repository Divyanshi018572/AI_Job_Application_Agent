import { afterEach, describe, expect, it, vi } from "vitest"

import { greenhouseAdapter } from "@/lib/ats/adapters/greenhouse"

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

describe("greenhouseAdapter.detectPlatform", () => {
  it("recognizes boards.greenhouse.io URLs", () => {
    expect(
      greenhouseAdapter.detectPlatform("https://boards.greenhouse.io/acme/jobs/12345")
    ).toBe(true)
  })

  it("recognizes other *.greenhouse.io subdomains", () => {
    expect(
      greenhouseAdapter.detectPlatform("https://job-boards.greenhouse.io/acme")
    ).toBe(true)
  })

  it("rejects URLs from other platforms", () => {
    expect(greenhouseAdapter.detectPlatform("https://jobs.lever.co/acme/123")).toBe(false)
    expect(greenhouseAdapter.detectPlatform("https://apply.workable.com/acme")).toBe(false)
  })

  it("returns false instead of throwing on a malformed URL", () => {
    expect(greenhouseAdapter.detectPlatform("not a url")).toBe(false)
  })
})

describe("greenhouseAdapter.fetchJobs", () => {
  it("maps a successful response into RawJob[]", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          jobs: [
            {
              id: 12345,
              title: "Backend Engineer",
              updated_at: "2026-01-01T00:00:00Z",
              location: { name: "Remote" },
              content: "<p>Job description</p>",
              absolute_url: "https://boards.greenhouse.io/acme/jobs/12345",
              departments: [{ name: "Engineering" }],
            },
          ],
        }),
    })

    const jobs = await greenhouseAdapter.fetchJobs("acme")

    expect(jobs).toEqual([
      {
        sourceId: "12345",
        platform: "greenhouse",
        title: "Backend Engineer",
        company: "acme",
        location: "Remote",
        department: "Engineering",
        description: "<p>Job description</p>",
        jobUrl: "https://boards.greenhouse.io/acme/jobs/12345",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ])
  })

  it("returns an empty array when the response has no jobs field", async () => {
    mockFetchOnce({ ok: true, status: 200, json: () => Promise.resolve({}) })
    expect(await greenhouseAdapter.fetchJobs("acme")).toEqual([])
  })

  it("throws a clear error on 404 (unknown board token)", async () => {
    mockFetchOnce({ ok: false, status: 404 })
    await expect(greenhouseAdapter.fetchJobs("not-a-real-company")).rejects.toThrow(
      /not found/i
    )
  })

  it("throws a clear error on 429 (rate limited)", async () => {
    mockFetchOnce({ ok: false, status: 429 })
    await expect(greenhouseAdapter.fetchJobs("acme")).rejects.toThrow(/rate limit/i)
  })

  it("throws a clear error on other non-OK statuses", async () => {
    mockFetchOnce({ ok: false, status: 500 })
    await expect(greenhouseAdapter.fetchJobs("acme")).rejects.toThrow(/500/)
  })
})

describe("greenhouseAdapter.submitApplication", () => {
  it("is a documented not-yet-implemented stub (Phase 5 scope), not silently 'successful'", async () => {
    const result = await greenhouseAdapter.submitApplication(
      { id: "1", platform: "greenhouse", sourceId: "12345", jobUrl: "https://x" },
      { userId: "u1" }
    )
    expect(result.status).toBe("failed")
    expect(result.message).toMatch(/not implemented/i)
  })
})
