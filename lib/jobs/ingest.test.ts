import { afterEach, describe, expect, it, vi } from "vitest"

import {
  CLASSIFICATION_BATCH_SIZE,
  classifyPendingJobs,
  ingestJobsForCompany,
  isRecentlyFetched,
} from "@/lib/jobs/ingest"
import type { RawJob } from "@/lib/ats/types"
import { HttpError } from "@/lib/http/retry"
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

type Row = Record<string, unknown> & { id: string; job_url: string; classified_at: string | null }

/**
 * In-memory stand-in for the `jobs` table, just rich enough for the query
 * shapes ingest.ts uses: the cache lookup (.maybeSingle), the pending batch
 * (.is(...).limit(n)), the pending count ({ head: true }), upsert on
 * (user_id, job_url) that only overwrites the columns it's given — which is
 * how Supabase/PostgREST upsert behaves — and update-by-id.
 * Single user, single board, so user/platform/board filters are ignored.
 */
function fakeSupabase(options: {
  recentFetchedAt?: string | null
  upsertError?: { message: string } | null
  seed?: Partial<Row>[]
  /** Reuse another fake's table — simulates a second request against the same data. */
  table?: Row[]
} = {}) {
  let nextId = 1
  const table: Row[] =
    options.table ??
    (options.seed ?? []).map((r) => ({
      id: `seed-${nextId++}`,
      job_url: `https://seed/${nextId}`,
      classified_at: null,
      ...r,
    }))
  const upsertCalls: Record<string, unknown>[][] = []

  function query() {
    const q: Record<string, unknown> = {}
    let op: "select" | "upsert" | "update" = "select"
    let head = false
    let limit = Infinity
    let values: Record<string, unknown> = {}
    let payload: Record<string, unknown>[] = []
    const eqs: Record<string, unknown> = {}
    const self = () => q

    q.select = (_cols: string, opts?: { head?: boolean }) => {
      head = !!opts?.head
      return q
    }
    q.eq = (col: string, val: unknown) => {
      eqs[col] = val
      return q
    }
    q.is = self
    q.order = self
    q.limit = (n: number) => {
      limit = n
      return q
    }
    q.maybeSingle = () =>
      Promise.resolve({
        data: options.recentFetchedAt ? { fetched_at: options.recentFetchedAt } : null,
      })
    q.upsert = (rows: Record<string, unknown>[]) => {
      op = "upsert"
      payload = rows
      return q
    }
    q.update = (v: Record<string, unknown>) => {
      op = "update"
      values = v
      return q
    }
    q.then = (resolve: (v: unknown) => void) => {
      if (op === "upsert") {
        upsertCalls.push(payload)
        if (options.upsertError) return resolve({ error: options.upsertError })
        for (const incoming of payload) {
          const existing = table.find((r) => r.job_url === incoming.job_url)
          if (existing) Object.assign(existing, incoming)
          else table.push({ id: `row-${nextId++}`, classified_at: null, ...incoming } as Row)
        }
        return resolve({ error: null })
      }
      if (op === "update") {
        const row = table.find((r) => r.id === eqs.id)
        if (row) Object.assign(row, values)
        return resolve({ error: null })
      }
      const pending = table.filter((r) => r.classified_at === null)
      if (head) return resolve({ count: pending.length, error: null })
      return resolve({ data: pending.slice(0, limit), error: null })
    }
    return q
  }

  const client = { from: vi.fn(() => query()) }
  return {
    supabase: client as unknown as SupabaseServerClient,
    table,
    upsertCalls,
  }
}

const rawJob = (n: number, overrides: Partial<RawJob> = {}): RawJob => ({
  sourceId: String(n),
  platform: "greenhouse",
  title: `Engineer ${n}`,
  company: "acme",
  jobUrl: `https://boards.greenhouse.io/acme/jobs/${n}`,
  ...overrides,
})

const tagged = { experienceLevel: "3-5", employmentType: "Full-time", workMode: "Remote" }
const untaggable = { experienceLevel: null, employmentType: null, workMode: null }
const board = { userId: "u1", platform: "greenhouse" as const, boardToken: "acme" }
const noSleep = () => Promise.resolve()

describe("isRecentlyFetched", () => {
  it("returns false when there's no prior fetch", async () => {
    const { supabase } = fakeSupabase({ recentFetchedAt: null })
    expect(await isRecentlyFetched(supabase, board)).toBe(false)
  })

  it("returns true when the last fetch is within the cache window", async () => {
    const { supabase } = fakeSupabase({ recentFetchedAt: new Date().toISOString() })
    expect(await isRecentlyFetched(supabase, board)).toBe(true)
  })

  it("returns false when the last fetch is older than the cache window", async () => {
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
    const { supabase } = fakeSupabase({ recentFetchedAt: eightHoursAgo })
    expect(await isRecentlyFetched(supabase, { ...board, cacheWindowHours: 6 })).toBe(false)
  })

  it("respects a custom cacheWindowHours", async () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { supabase } = fakeSupabase({ recentFetchedAt: thirtyMinAgo })
    expect(await isRecentlyFetched(supabase, { ...board, cacheWindowHours: 0.1 })).toBe(false)
  })
})

describe("ingestJobsForCompany — fetching and saving", () => {
  it("fetches, saves, and tags on a cache miss", async () => {
    const { supabase, table } = fakeSupabase()
    fetchJobsMock.mockResolvedValue([rawJob(1)])
    classifyJobMock.mockResolvedValue(tagged)

    const result = await ingestJobsForCompany(supabase, board)

    expect(result).toEqual({
      status: "fetched",
      jobsFetched: 1,
      jobsUpserted: 1,
      jobsClassified: 1,
      pendingClassification: 0,
      classificationFailures: 0,
    })
    expect(table[0]).toMatchObject({
      board_token: "acme",
      title: "Engineer 1",
      experience_level: "3-5",
      employment_type: "Full-time",
      work_mode: "Remote",
    })
    expect(table[0].classified_at).not.toBeNull()
  })

  it("never includes classification columns in the save, so a re-fetch can't wipe existing tags", async () => {
    const { supabase, upsertCalls } = fakeSupabase()
    fetchJobsMock.mockResolvedValue([rawJob(1)])
    classifyJobMock.mockResolvedValue(tagged)

    await ingestJobsForCompany(supabase, board)

    const saved = upsertCalls[0][0]
    for (const col of ["experience_level", "employment_type", "work_mode", "classified_at"]) {
      expect(saved).not.toHaveProperty(col)
    }
  })

  it("does not re-classify jobs that were already tagged when the board is re-fetched (plan: 'cached, not recomputed')", async () => {
    const { supabase, table } = fakeSupabase({
      seed: [
        {
          job_url: "https://boards.greenhouse.io/acme/jobs/1",
          experience_level: "5+",
          classified_at: "2026-09-14T00:00:00Z",
        },
      ],
    })
    fetchJobsMock.mockResolvedValue([rawJob(1, { title: "Engineer 1 (retitled)" })])

    const result = await ingestJobsForCompany(supabase, board)

    expect(classifyJobMock).not.toHaveBeenCalled()
    expect(result.jobsClassified).toBe(0)
    expect(table).toHaveLength(1)
    // posting fields refresh...
    expect(table[0].title).toBe("Engineer 1 (retitled)")
    // ...tags survive
    expect(table[0].experience_level).toBe("5+")
    expect(table[0].classified_at).toBe("2026-09-14T00:00:00Z")
  })

  it("saves large boards in chunks of 100 rows", async () => {
    const { supabase, upsertCalls } = fakeSupabase()
    fetchJobsMock.mockResolvedValue(Array.from({ length: 250 }, (_, i) => rawJob(i)))
    classifyJobMock.mockResolvedValue(untaggable)

    const result = await ingestJobsForCompany(supabase, board)

    expect(upsertCalls.map((c) => c.length)).toEqual([100, 100, 50])
    expect(result.jobsUpserted).toBe(250)
  })

  it("uses companyDisplayName to override the adapter's placeholder company field", async () => {
    const { supabase, table } = fakeSupabase()
    fetchJobsMock.mockResolvedValue([rawJob(1)])
    classifyJobMock.mockResolvedValue(untaggable)

    await ingestJobsForCompany(supabase, { ...board, companyDisplayName: "Acme Inc." })

    expect(table[0].company).toBe("Acme Inc.")
  })

  it("handles a board with no open jobs", async () => {
    const { supabase, upsertCalls } = fakeSupabase()
    fetchJobsMock.mockResolvedValue([])

    const result = await ingestJobsForCompany(supabase, board)

    expect(result).toMatchObject({ status: "fetched", jobsFetched: 0, jobsUpserted: 0, jobsClassified: 0 })
    expect(upsertCalls).toHaveLength(0)
  })

  it("throws a descriptive error when saving fails", async () => {
    const { supabase } = fakeSupabase({ upsertError: { message: "constraint violation" } })
    fetchJobsMock.mockResolvedValue([rawJob(1)])

    await expect(ingestJobsForCompany(supabase, board)).rejects.toThrow(/constraint violation/)
  })

  it("retries the board fetch on a transient 503 (Task 2.3 backoff)", async () => {
    const { supabase } = fakeSupabase()
    fetchJobsMock
      .mockRejectedValueOnce(new HttpError("Greenhouse API error (503)", 503))
      .mockResolvedValueOnce([rawJob(1)])
    classifyJobMock.mockResolvedValue(untaggable)
    const sleep = vi.fn().mockResolvedValue(undefined)

    const result = await ingestJobsForCompany(supabase, { ...board, sleep })

    expect(result.jobsFetched).toBe(1)
    expect(fetchJobsMock).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it("does not retry a 404 (wrong board token)", async () => {
    const { supabase } = fakeSupabase()
    fetchJobsMock.mockRejectedValue(new HttpError('Greenhouse board not found for token "nope"', 404))
    const sleep = vi.fn().mockResolvedValue(undefined)

    await expect(ingestJobsForCompany(supabase, { ...board, sleep })).rejects.toThrow(/not found/)
    expect(fetchJobsMock).toHaveBeenCalledTimes(1)
    expect(sleep).not.toHaveBeenCalled()
  })
})

describe("ingestJobsForCompany — batched tagging", () => {
  it(`tags at most ${CLASSIFICATION_BATCH_SIZE} jobs per call and reports how many remain`, async () => {
    const { supabase } = fakeSupabase()
    fetchJobsMock.mockResolvedValue(Array.from({ length: 30 }, (_, i) => rawJob(i)))
    classifyJobMock.mockResolvedValue(tagged)

    const result = await ingestJobsForCompany(supabase, board)

    expect(result.jobsUpserted).toBe(30)
    expect(result.jobsClassified).toBe(CLASSIFICATION_BATCH_SIZE)
    expect(result.pendingClassification).toBe(30 - CLASSIFICATION_BATCH_SIZE)
  })

  it("a second call inside the cache window skips the fetch and tags the next batch ('Tag more')", async () => {
    const { supabase, table } = fakeSupabase()
    const total = CLASSIFICATION_BATCH_SIZE + 5
    fetchJobsMock.mockResolvedValue(Array.from({ length: total }, (_, i) => rawJob(i)))
    classifyJobMock.mockResolvedValue(tagged)

    const first = await ingestJobsForCompany(supabase, board)
    expect(first.pendingClassification).toBe(5)

    // Second request: same data, and the board now counts as freshly fetched.
    const { supabase: second } = fakeSupabase({ table, recentFetchedAt: new Date().toISOString() })
    const result = await ingestJobsForCompany(second, board)

    expect(fetchJobsMock).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("cached")
    expect(result.jobsClassified).toBe(5)
    expect(result.pendingClassification).toBe(0)
  })

  it("marks a job the model left all-null as classified, so it isn't re-sent forever", async () => {
    const { supabase, table } = fakeSupabase()
    fetchJobsMock.mockResolvedValue([rawJob(1)])
    classifyJobMock.mockResolvedValue(untaggable)

    const result = await ingestJobsForCompany(supabase, board)

    expect(result.jobsClassified).toBe(1)
    expect(result.pendingClassification).toBe(0)
    expect(table[0].classified_at).not.toBeNull()
    expect(table[0].experience_level).toBeNull()
  })

  it("leaves a job pending (to retry next batch) and reports it when its classification fails", async () => {
    const { supabase, table } = fakeSupabase()
    fetchJobsMock.mockResolvedValue([rawJob(1), rawJob(2), rawJob(3)])
    classifyJobMock
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValueOnce(tagged)
      .mockRejectedValueOnce(new Error("second failure"))

    const result = await ingestJobsForCompany(supabase, board)

    expect(result.jobsUpserted).toBe(3)
    expect(result.jobsClassified).toBe(1)
    expect(result.classificationFailures).toBe(2)
    expect(result.classificationError).toBe("first failure")
    expect(result.pendingClassification).toBe(2)
    expect(table.filter((r) => r.classified_at === null)).toHaveLength(2)
  })

  it("classifies with bounded concurrency, not one unbounded Promise.all", async () => {
    const { supabase } = fakeSupabase()
    fetchJobsMock.mockResolvedValue(Array.from({ length: 8 }, (_, i) => rawJob(i)))

    let active = 0
    let maxActive = 0
    classifyJobMock.mockImplementation(async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
      return untaggable
    })

    await ingestJobsForCompany(supabase, board)

    expect(maxActive).toBeLessThanOrEqual(3)
    expect(classifyJobMock).toHaveBeenCalledTimes(8)
  })

  it("passes the injected sleep through to the classifier", async () => {
    const { supabase } = fakeSupabase()
    fetchJobsMock.mockResolvedValue([rawJob(1)])
    classifyJobMock.mockResolvedValue(untaggable)

    await ingestJobsForCompany(supabase, { ...board, sleep: noSleep })

    expect(classifyJobMock).toHaveBeenCalledWith(expect.anything(), { sleep: noSleep })
  })
})

describe("classifyPendingJobs", () => {
  it("stops starting new classifications once the time budget is spent, leaving the rest pending (not failed)", async () => {
    const { supabase } = fakeSupabase({
      seed: Array.from({ length: 6 }, (_, i) => ({ job_url: `https://x/${i}` })),
    })
    // Each classification "takes" 10s on a fake clock; budget is 25s.
    let clock = 0
    classifyJobMock.mockImplementation(async () => {
      clock += 10_000
      return tagged
    })

    const result = await classifyPendingJobs(supabase, {
      ...board,
      timeBudgetMs: 25_000,
      now: () => clock,
    })

    // Concurrency 3: the three workers start their first jobs at 0s, 10s
    // and 20s on the fake clock; when they come back for more it reads
    // 30s, past the 25s budget, so the other three are left for later.
    expect(result.jobsClassified).toBe(3)
    expect(result.classificationFailures).toBe(0)
    expect(result.pendingClassification).toBe(3)
  })

  it("does nothing and reports zero pending when every job is already tagged", async () => {
    const { supabase } = fakeSupabase({
      seed: [{ classified_at: "2026-09-14T00:00:00Z" }],
    })

    const result = await classifyPendingJobs(supabase, board)

    expect(classifyJobMock).not.toHaveBeenCalled()
    expect(result).toEqual({ jobsClassified: 0, pendingClassification: 0, classificationFailures: 0 })
  })
})

