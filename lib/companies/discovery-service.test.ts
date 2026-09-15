import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { stubJobBoards } from "@/lib/ats/testing/fake-job-boards"
import { discoverCompanyBoard, MAX_DISCOVERIES_PER_HOUR } from "@/lib/companies/discovery-service"
import type { SearchProvider } from "@/lib/search/types"
import type { createClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type Row = Record<string, unknown>

/**
 * In-memory `company_discoveries`, supporting the filters the service uses
 * (eq / gte / in / neq / order / limit / maybeSingle / head count / insert).
 */
function fakeSupabase(seed: Row[] = []) {
  const rows: Row[] = seed.map((r) => ({ review_status: "pending", created_at: new Date().toISOString(), ...r }))

  function query() {
    const filters: ((r: Row) => boolean)[] = []
    let head = false
    let limit = Infinity
    let inserted: Row | null = null
    const result = () => {
      if (inserted) {
        rows.push({ review_status: "pending", created_at: new Date().toISOString(), ...inserted })
        return { error: null }
      }
      const matched = rows
        .filter((r) => filters.every((f) => f(r)))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      return head ? { count: matched.length, error: null } : { data: matched.slice(0, limit), error: null }
    }
    const q = {
      select: (_cols: string, opts?: { head?: boolean }) => ((head = !!opts?.head), q),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), q),
      gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), q),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
      order: () => q,
      limit: (n: number) => ((limit = n), q),
      maybeSingle: () => {
        const r = result() as { data: Row[] }
        return Promise.resolve({ data: r.data[0] ?? null, error: null })
      },
      insert: (row: Row) => ((inserted = row), q),
      then: (resolve: (v: unknown) => void) => resolve(result()),
    }
    return q
  }

  return { supabase: { from: vi.fn(() => query()) } as unknown as SupabaseServerClient, rows }
}


function searchReturning(urls: string[]): SearchProvider {
  return { search: vi.fn().mockResolvedValue(urls.map((url) => ({ title: "r", url }))) }
}

const userId = "u1"

beforeEach(() => {
  stubJobBoards({
    "greenhouse:newco": { name: "NewCo", jobs: 2 },
    "greenhouse:ghostcorp": { name: "Ghost Corp", jobs: 1 },
    "lever:ghost": { name: "Ghost", jobs: 1 },
    "workable:ghost": { name: "Ghost", jobs: 0 },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("discoverCompanyBoard — by name", () => {
  it("answers from the curated list without searching or recording", async () => {
    const { supabase, rows } = fakeSupabase()
    const search = searchReturning([])

    const outcome = await discoverCompanyBoard(supabase, { userId, companyName: "stripe inc", searchProvider: search })

    expect(outcome).toEqual({ status: "found", source: "curated", companyName: "Stripe", platform: "greenhouse", token: "stripe" })
    expect(search.search).not.toHaveBeenCalled()
    expect(rows).toEqual([])
  })

  it("searches, verifies, and records the find for review", async () => {
    const { supabase, rows } = fakeSupabase()
    const search = searchReturning(["https://boards.greenhouse.io/newco/jobs/9"])

    const outcome = await discoverCompanyBoard(supabase, { userId, companyName: "NewCo", searchProvider: search })

    expect(outcome).toEqual({ status: "found", source: "search", companyName: "NewCo", platform: "greenhouse", token: "newco" })
    expect(rows).toEqual([
      expect.objectContaining({
        user_id: userId,
        query: "NewCo",
        query_key: "newco",
        status: "found_via_search",
        ats_platform: "greenhouse",
        board_token: "newco",
        source_url: "https://boards.greenhouse.io/newco/jobs/9",
        review_status: "pending",
      }),
    ])
  })

  it("reuses the user's earlier verified result instead of searching again", async () => {
    const { supabase, rows } = fakeSupabase([
      { user_id: userId, query_key: "newco", status: "found_via_search", ats_platform: "lever", board_token: "newco" },
    ])
    const search = searchReturning([])

    const outcome = await discoverCompanyBoard(supabase, { userId, companyName: " NEWCO ", searchProvider: search })

    expect(outcome).toMatchObject({ status: "found", source: "cache", platform: "lever", token: "newco" })
    expect(search.search).not.toHaveBeenCalled()
    expect(rows).toHaveLength(1)
  })

  it("ignores a cached result a reviewer rejected, and another user's results", async () => {
    const { supabase } = fakeSupabase([
      { user_id: userId, query_key: "newco", status: "found_via_search", ats_platform: "lever", board_token: "bad", review_status: "rejected" },
      { user_id: "someone-else", query_key: "newco", status: "found_via_search", ats_platform: "lever", board_token: "theirs" },
    ])
    const search = searchReturning(["https://boards.greenhouse.io/newco"])

    const outcome = await discoverCompanyBoard(supabase, { userId, companyName: "NewCo", searchProvider: search })

    expect(outcome).toMatchObject({ source: "search", platform: "greenhouse", token: "newco" })
  })

  it("flags a company with no verifiable board for review", async () => {
    const { supabase, rows } = fakeSupabase()

    const outcome = await discoverCompanyBoard(supabase, {
      userId,
      companyName: "Ghost Corp",
      searchProvider: searchReturning(["https://boards.greenhouse.io/ghost"]),
    })

    expect(outcome).toMatchObject({ status: "not_found", companyName: "Ghost Corp" })
    expect(rows).toEqual([expect.objectContaining({ status: "not_found", query_key: "ghost" })])
    expect(rows[0]).not.toHaveProperty("board_token")
  })

  it("doesn't flag anything when the search service itself is down", async () => {
    const { supabase, rows } = fakeSupabase()
    const search: SearchProvider = { search: vi.fn().mockRejectedValue(new Error("Tavily rate limit hit")) }

    const outcome = await discoverCompanyBoard(supabase, { userId, companyName: "NewCo", searchProvider: search })

    expect(outcome).toMatchObject({ status: "not_found" })
    if (outcome.status === "not_found") expect(outcome.reason).toMatch(/unavailable/)
    expect(rows).toEqual([])
  })

  it(`stops searching after ${MAX_DISCOVERIES_PER_HOUR} recorded searches in an hour`, async () => {
    const { supabase } = fakeSupabase(
      Array.from({ length: MAX_DISCOVERIES_PER_HOUR }, (_, i) => ({ user_id: userId, query_key: `c${i}`, status: "not_found" }))
    )
    const search = searchReturning([])

    const outcome = await discoverCompanyBoard(supabase, { userId, companyName: "NewCo", searchProvider: search })

    expect(outcome.status).toBe("rate_limited")
    expect(search.search).not.toHaveBeenCalled()
  })

  it("still answers curated names when the search cap is reached (they cost nothing)", async () => {
    const { supabase } = fakeSupabase(
      Array.from({ length: MAX_DISCOVERIES_PER_HOUR }, (_, i) => ({ user_id: userId, query_key: `c${i}`, status: "not_found" }))
    )
    const outcome = await discoverCompanyBoard(supabase, { userId, companyName: "Figma", searchProvider: searchReturning([]) })
    expect(outcome).toMatchObject({ status: "found", source: "curated" })
  })
})

describe("discoverCompanyBoard — pasted link", () => {
  it("verifies the board from a pasted posting link and records it for review", async () => {
    const { supabase, rows } = fakeSupabase()

    const outcome = await discoverCompanyBoard(supabase, {
      userId,
      companyName: "Ghost Corp",
      careersUrl: "https://job-boards.greenhouse.io/ghostcorp/jobs/42",
    })

    expect(outcome).toEqual({ status: "found", source: "manual", companyName: "Ghost Corp", platform: "greenhouse", token: "ghostcorp" })
    expect(rows).toEqual([expect.objectContaining({ status: "manual", board_token: "ghostcorp", review_status: "pending" })])
  })

  it("rejects a link that isn't on a supported job board, without any network call", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { supabase, rows } = fakeSupabase()

    const outcome = await discoverCompanyBoard(supabase, { userId, companyName: "Ghost", careersUrl: "https://ghost.com/careers" })

    expect(outcome.status).toBe("invalid_url")
    expect(fetchMock).not.toHaveBeenCalled()
    expect(rows).toEqual([])
  })

  it("rejects a board link whose board has no open jobs", async () => {
    const { supabase, rows } = fakeSupabase()

    const outcome = await discoverCompanyBoard(supabase, { userId, companyName: "Ghost", careersUrl: "https://apply.workable.com/ghost/" })

    expect(outcome.status).toBe("invalid_url")
    expect(rows).toEqual([])
  })

  it("counts pasted links toward the hourly cap", async () => {
    const { supabase } = fakeSupabase(
      Array.from({ length: MAX_DISCOVERIES_PER_HOUR }, (_, i) => ({ user_id: userId, query_key: `c${i}`, status: "manual", ats_platform: "lever", board_token: "x" }))
    )
    const outcome = await discoverCompanyBoard(supabase, { userId, companyName: "Ghost", careersUrl: "https://jobs.lever.co/ghost" })
    expect(outcome.status).toBe("rate_limited")
  })
})
