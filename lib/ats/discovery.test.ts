import { afterEach, describe, expect, it, vi } from "vitest"

import { discoverCompanyToken } from "@/lib/ats/discovery"
import type { CuratedCompany } from "@/lib/ats/curated-companies"
import type { SearchProvider } from "@/lib/search/types"

afterEach(() => {
  vi.unstubAllGlobals()
})

function fakeSearchProvider(urls: string[]): SearchProvider {
  return {
    search: vi.fn().mockResolvedValue(urls.map((url) => ({ title: "result", url }))),
  }
}

function mockAdapterFetchOk() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ jobs: [] }),
    })
  )
}

function mockAdapterFetch404() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) })
  )
}

describe("discoverCompanyToken", () => {
  it("returns a curated match without calling the search provider at all", async () => {
    const curatedList: CuratedCompany[] = [
      { name: "Acme", platform: "greenhouse", token: "acme" },
    ]
    const search = fakeSearchProvider([])

    const result = await discoverCompanyToken("Acme", {
      curatedList,
      searchProvider: search,
    })

    expect(result).toEqual({ status: "found_curated", platform: "greenhouse", token: "acme" })
    expect(search.search).not.toHaveBeenCalled()
  })

  it("matches the curated list case-insensitively", async () => {
    const curatedList: CuratedCompany[] = [
      { name: "Acme", platform: "greenhouse", token: "acme" },
    ]
    const result = await discoverCompanyToken("aCME", {
      curatedList,
      searchProvider: fakeSearchProvider([]),
    })
    expect(result.status).toBe("found_curated")
  })

  it("falls back to search when not in the curated list, and verifies via a live adapter call", async () => {
    mockAdapterFetchOk()
    const search = fakeSearchProvider(["https://boards.greenhouse.io/newco/jobs/1"])

    const result = await discoverCompanyToken("NewCo", {
      curatedList: [],
      searchProvider: search,
    })

    expect(result).toEqual({
      status: "found_via_search",
      platform: "greenhouse",
      token: "newco",
      sourceUrl: "https://boards.greenhouse.io/newco/jobs/1",
    })
  })

  it("extracts the token from the subdomain for {token}.workable.com URLs", async () => {
    mockAdapterFetchOk()
    const search = fakeSearchProvider(["https://newco.workable.com/j/ABCD1234"])

    const result = await discoverCompanyToken("NewCo", {
      curatedList: [],
      searchProvider: search,
    })

    expect(result).toEqual({
      status: "found_via_search",
      platform: "workable",
      token: "newco",
      sourceUrl: "https://newco.workable.com/j/ABCD1234",
    })
  })

  it("skips a search result whose URL doesn't match any registered platform", async () => {
    mockAdapterFetchOk()
    const search = fakeSearchProvider([
      "https://example.com/careers",
      "https://boards.greenhouse.io/newco/jobs/1",
    ])

    const result = await discoverCompanyToken("NewCo", {
      curatedList: [],
      searchProvider: search,
    })
    expect(result.status).toBe("found_via_search")
  })

  it("skips a candidate token that fails live verification and tries the next result", async () => {
    let call = 0
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        call++
        if (call === 1) {
          return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ jobs: [] }) })
      })
    )

    const search = fakeSearchProvider([
      "https://boards.greenhouse.io/wrong-token/jobs/1",
      "https://boards.greenhouse.io/right-token/jobs/1",
    ])

    const result = await discoverCompanyToken("NewCo", {
      curatedList: [],
      searchProvider: search,
    })

    expect(result).toEqual({
      status: "found_via_search",
      platform: "greenhouse",
      token: "right-token",
      sourceUrl: "https://boards.greenhouse.io/right-token/jobs/1",
    })
  })

  it("returns not_found when no search result verifies", async () => {
    mockAdapterFetch404()
    const search = fakeSearchProvider(["https://boards.greenhouse.io/nobody/jobs/1"])

    const result = await discoverCompanyToken("NewCo", {
      curatedList: [],
      searchProvider: search,
    })

    expect(result.status).toBe("not_found")
  })

  it("returns not_found (not a thrown error) when the search provider itself fails", async () => {
    const search: SearchProvider = {
      search: vi.fn().mockRejectedValue(new Error("Tavily rate limit hit")),
    }

    const result = await discoverCompanyToken("NewCo", {
      curatedList: [],
      searchProvider: search,
    })

    expect(result.status).toBe("not_found")
    if (result.status === "not_found") {
      expect(result.reason).toContain("Tavily rate limit hit")
    }
  })

  it("returns not_found when the search provider returns no results", async () => {
    const result = await discoverCompanyToken("NewCo", {
      curatedList: [],
      searchProvider: fakeSearchProvider([]),
    })
    expect(result.status).toBe("not_found")
  })
})
