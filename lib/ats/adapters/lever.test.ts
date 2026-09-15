import { afterEach, describe, expect, it, vi } from "vitest"

import { leverAdapter } from "@/lib/ats/adapters/lever"

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

describe("leverAdapter.detectPlatform", () => {
  it("recognizes jobs.lever.co URLs", () => {
    expect(leverAdapter.detectPlatform("https://jobs.lever.co/acme/abcd-1234")).toBe(true)
  })

  it("rejects URLs from other platforms", () => {
    expect(leverAdapter.detectPlatform("https://boards.greenhouse.io/acme")).toBe(false)
    expect(leverAdapter.detectPlatform("https://apply.workable.com/acme")).toBe(false)
  })

  it("returns false instead of throwing on a malformed URL", () => {
    expect(leverAdapter.detectPlatform("not a url")).toBe(false)
  })
})

describe("leverAdapter.fetchJobs", () => {
  it("maps a successful response into RawJob[]", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            id: "abcd-1234",
            text: "Backend Engineer",
            categories: { location: "Remote", team: "Engineering" },
            descriptionPlain: "Job description",
            hostedUrl: "https://jobs.lever.co/acme/abcd-1234",
            createdAt: 1735689600000, // 2025-01-01T00:00:00.000Z
          },
        ]),
    })

    const jobs = await leverAdapter.fetchJobs("acme")

    expect(jobs).toEqual([
      {
        sourceId: "abcd-1234",
        platform: "lever",
        title: "Backend Engineer",
        company: "acme",
        location: "Remote",
        department: "Engineering",
        description: "Job description",
        jobUrl: "https://jobs.lever.co/acme/abcd-1234",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ])
  })

  it("returns an empty array when the response isn't an array", async () => {
    mockFetchOnce({ ok: true, status: 200, json: () => Promise.resolve({}) })
    expect(await leverAdapter.fetchJobs("acme")).toEqual([])
  })

  it("throws a clear error on 404 (unknown board token)", async () => {
    mockFetchOnce({ ok: false, status: 404 })
    await expect(leverAdapter.fetchJobs("not-a-real-company")).rejects.toThrow(/not found/i)
  })

  it("throws a clear error on 429 (rate limited)", async () => {
    mockFetchOnce({ ok: false, status: 429 })
    await expect(leverAdapter.fetchJobs("acme")).rejects.toThrow(/rate limit/i)
  })

  it("throws a clear error on other non-OK statuses", async () => {
    mockFetchOnce({ ok: false, status: 500 })
    await expect(leverAdapter.fetchJobs("acme")).rejects.toThrow(/500/)
  })
})

describe("leverAdapter.submitApplication", () => {
  it("is a documented not-yet-implemented stub (Phase 5 scope)", async () => {
    const result = await leverAdapter.submitApplication(
      { id: "1", platform: "lever", sourceId: "abcd-1234", jobUrl: "https://x" },
      { userId: "u1" }
    )
    expect(result.status).toBe("failed")
    expect(result.message).toMatch(/not implemented/i)
  })
})

describe("leverAdapter.fetchBoardName", () => {
  const page = (html: string, status = 200) => ({ ok: status < 400, status, text: () => Promise.resolve(html) })

  it("reads the company name from the hosted board page's title", async () => {
    const fetchMock = vi.fn().mockResolvedValue(page("<html><head><title>Palantir Technologies</title></head></html>"))
    vi.stubGlobal("fetch", fetchMock)

    expect(await leverAdapter.fetchBoardName("palantir")).toBe("Palantir Technologies")
    expect(fetchMock).toHaveBeenCalledWith("https://jobs.lever.co/palantir")
  })

  it("decodes HTML entities in the title", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page("<title>Ben &amp; Jerry&#39;s</title>")))
    expect(await leverAdapter.fetchBoardName("benjerry")).toBe("Ben & Jerry's")
  })

  it("returns null for an unknown board, a page with no title, or a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page("not found", 404)))
    expect(await leverAdapter.fetchBoardName("nope")).toBeNull()

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page("<html></html>")))
    expect(await leverAdapter.fetchBoardName("acme")).toBeNull()

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))
    expect(await leverAdapter.fetchBoardName("acme")).toBeNull()
  })
})
