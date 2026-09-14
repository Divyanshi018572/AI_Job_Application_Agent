import { afterEach, describe, expect, it, vi } from "vitest"

import { ingestJobsForCompany, isRecentlyFetched } from "@/lib/jobs/ingest"
import type { RawJob } from "@/lib/ats/types"
import type { createClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

const fetchJobsMock = vi.fn<() => Promise<RawJob[]>>()
const classifyJobMock = vi.fn()

vi.mock("@/lib/ats/registry", () => ({
  getAdapter: () => ({
    detectPlatform: () => true,
    fetchJobs: fetchJobsMock,
    submitApplication: vi.fn(),
  }),
}))

vi.mock("@/lib/jobs/classify", () => ({
  classifyJob: (...args: unknown[]) => classifyJobMock(...args),
}))

afterEach(() => {
  vi.clearAllMocks()
})

/** Minimal fake Supabase query-builder: every chained method returns the
 * same object, so `.from(...).select(...).eq(...).eq(...).eq(...).order(...).limit(...).maybeSingle()`
 * and `.from(...).upsert(...)` both resolve through it. */
function fakeSupabase(options: {
  recentFetchedAt?: string | null
  upsertError?: { message: string } | null
}) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  const chain = () => builder as unknown
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.limit = vi.fn(chain)
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve({
      data: options.recentFetchedAt ? { fetched_at: options.recentFetchedAt } : null,
    })
  )
  builder.upsert = vi.fn(() => Promise.resolve({ error: options.upsertError ?? null }))

  const from = vi.fn(() => builder)
  return { from, builder } as unknown as SupabaseServerClient & { builder: typeof builder }
}

const rawJob = (overrides: Partial<RawJob> = {}): RawJob => ({
  sourceId: "1",
  platform: "greenhouse",
  title: "Backend Engineer",
  company: "acme",
  jobUrl: "https://boards.greenhouse.io/acme/jobs/1",
  ...overrides,
})

const emptyClassification = { experienceLevel: null, employmentType: null, workMode: null }

describe("isRecentlyFetched", () => {
  it("returns false when there's no prior fetch", async () => {
    const supabase = fakeSupabase({ recentFetchedAt: null })
    const result = await isRecentlyFetched(supabase, {
      userId: "u1",
      platform: "greenhouse",
      boardToken: "acme",
    })
    expect(result).toBe(false)
  })

  it("returns true when the last fetch is within the cache window", async () => {
    const supabase = fakeSupabase({ recentFetchedAt: new Date().toISOString() })
    const result = await isRecentlyFetched(supabase, {
      userId: "u1",
      platform: "greenhouse",
      boardToken: "acme",
    })
    expect(result).toBe(true)
  })

  it("returns false when the last fetch is older than the cache window", async () => {
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
    const supabase = fakeSupabase({ recentFetchedAt: eightHoursAgo })
    const result = await isRecentlyFetched(supabase, {
      userId: "u1",
      platform: "greenhouse",
      boardToken: "acme",
      cacheWindowHours: 6,
    })
    expect(result).toBe(false)
  })

  it("respects a custom cacheWindowHours", async () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const supabase = fakeSupabase({ recentFetchedAt: thirtyMinAgo })
    const result = await isRecentlyFetched(supabase, {
      userId: "u1",
      platform: "greenhouse",
      boardToken: "acme",
      cacheWindowHours: 0.1, // 6 minutes
    })
    expect(result).toBe(false)
  })
})

describe("ingestJobsForCompany", () => {
  it("skips fetching entirely when the board was recently fetched (cache hit)", async () => {
    const supabase = fakeSupabase({ recentFetchedAt: new Date().toISOString() })

    const result = await ingestJobsForCompany(supabase, {
      userId: "u1",
      platform: "greenhouse",
      boardToken: "acme",
    })

    expect(result).toEqual({ status: "cached", jobsFetched: 0, jobsUpserted: 0 })
    expect(fetchJobsMock).not.toHaveBeenCalled()
  })

  it("fetches, classifies, and upserts on a cache miss", async () => {
    const supabase = fakeSupabase({ recentFetchedAt: null })
    fetchJobsMock.mockResolvedValue([rawJob()])
    classifyJobMock.mockResolvedValue({
      experienceLevel: "3-5",
      employmentType: "Full-time",
      workMode: "Remote",
    })

    const result = await ingestJobsForCompany(supabase, {
      userId: "u1",
      platform: "greenhouse",
      boardToken: "acme",
    })

    expect(result).toEqual({ status: "fetched", jobsFetched: 1, jobsUpserted: 1 })
    expect(supabase.builder.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          user_id: "u1",
          platform: "greenhouse",
          board_token: "acme",
          title: "Backend Engineer",
          company: "acme",
          experience_level: "3-5",
          employment_type: "Full-time",
          work_mode: "Remote",
          job_url: "https://boards.greenhouse.io/acme/jobs/1",
        }),
      ],
      { onConflict: "user_id,job_url" }
    )
  })

  it("uses companyDisplayName to override the adapter's placeholder company field", async () => {
    const supabase = fakeSupabase({ recentFetchedAt: null })
    fetchJobsMock.mockResolvedValue([rawJob({ company: "acme" })])
    classifyJobMock.mockResolvedValue(emptyClassification)

    await ingestJobsForCompany(supabase, {
      userId: "u1",
      platform: "greenhouse",
      boardToken: "acme",
      companyDisplayName: "Acme Inc.",
    })

    const upsertedRows = supabase.builder.upsert.mock.calls[0][0]
    expect(upsertedRows[0].company).toBe("Acme Inc.")
  })

  it("returns zero counts without calling upsert when the board has no jobs", async () => {
    const supabase = fakeSupabase({ recentFetchedAt: null })
    fetchJobsMock.mockResolvedValue([])

    const result = await ingestJobsForCompany(supabase, {
      userId: "u1",
      platform: "greenhouse",
      boardToken: "acme",
    })

    expect(result).toEqual({ status: "fetched", jobsFetched: 0, jobsUpserted: 0 })
    expect(supabase.builder.upsert).not.toHaveBeenCalled()
  })

  it("falls back to an unclassified result for a job whose classification call fails, instead of failing the whole batch", async () => {
    const supabase = fakeSupabase({ recentFetchedAt: null })
    fetchJobsMock.mockResolvedValue([rawJob()])
    classifyJobMock.mockRejectedValue(new Error("NIM API down"))

    const result = await ingestJobsForCompany(supabase, {
      userId: "u1",
      platform: "greenhouse",
      boardToken: "acme",
    })

    expect(result.jobsUpserted).toBe(1)
    const upsertedRows = supabase.builder.upsert.mock.calls[0][0]
    expect(upsertedRows[0].experience_level).toBeNull()
  })

  it("throws a descriptive error when the upsert itself fails", async () => {
    const supabase = fakeSupabase({
      recentFetchedAt: null,
      upsertError: { message: "constraint violation" },
    })
    fetchJobsMock.mockResolvedValue([rawJob()])
    classifyJobMock.mockResolvedValue(emptyClassification)

    await expect(
      ingestJobsForCompany(supabase, {
        userId: "u1",
        platform: "greenhouse",
        boardToken: "acme",
      })
    ).rejects.toThrow(/constraint violation/)
  })

  it("classifies with bounded concurrency, not one unbounded Promise.all", async () => {
    const supabase = fakeSupabase({ recentFetchedAt: null })
    const jobs = Array.from({ length: 8 }, (_, i) => rawJob({ sourceId: String(i) }))
    fetchJobsMock.mockResolvedValue(jobs)

    let active = 0
    let maxActive = 0
    classifyJobMock.mockImplementation(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
      return emptyClassification
    })

    await ingestJobsForCompany(supabase, {
      userId: "u1",
      platform: "greenhouse",
      boardToken: "acme",
    })

    expect(maxActive).toBeLessThanOrEqual(3)
    expect(classifyJobMock).toHaveBeenCalledTimes(8)
  })
})
