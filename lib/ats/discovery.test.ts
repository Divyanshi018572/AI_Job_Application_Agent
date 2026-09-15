import { afterEach, describe, expect, it, vi } from "vitest"

import {
  boardNameMatches,
  discoverCompanyToken,
  findCuratedCompany,
  normalizeCompanyName,
  parseBoardUrl,
} from "@/lib/ats/discovery"
import type { CuratedCompany } from "@/lib/ats/curated-companies"
import { stubJobBoards } from "@/lib/ats/testing/fake-job-boards"
import type { SearchProvider } from "@/lib/search/types"

afterEach(() => {
  vi.unstubAllGlobals()
})

function fakeSearchProvider(urls: string[]): SearchProvider {
  return {
    search: vi.fn().mockResolvedValue(urls.map((url) => ({ title: "result", url }))),
  }
}

const search = (companyName: string, urls: string[]) =>
  discoverCompanyToken(companyName, { curatedList: [], searchProvider: fakeSearchProvider(urls) })

describe("discoverCompanyToken - curated list", () => {
  it("returns a curated match without calling the search provider at all", async () => {
    const curatedList: CuratedCompany[] = [{ name: "Acme", platform: "greenhouse", token: "acme" }]
    const provider = fakeSearchProvider([])

    const result = await discoverCompanyToken("Acme", { curatedList, searchProvider: provider })

    expect(result).toEqual({ status: "found_curated", platform: "greenhouse", token: "acme" })
    expect(provider.search).not.toHaveBeenCalled()
  })

  it("matches curated names ignoring case, punctuation, spacing and legal suffixes", () => {
    const curatedList: CuratedCompany[] = [{ name: "Scale AI", platform: "greenhouse", token: "scaleai" }]
    for (const typed of ["scale ai", "Scale-AI", "SCALEAI", "Scale AI, Inc."]) {
      expect(findCuratedCompany(typed, curatedList)?.token).toBe("scaleai")
    }
    expect(findCuratedCompany("Scale", curatedList)).toBeNull()
    expect(findCuratedCompany("   ", curatedList)).toBeNull()
  })
})

describe("discoverCompanyToken - search", () => {
  it("searches only the job-board domains", async () => {
    const provider = fakeSearchProvider([])
    await discoverCompanyToken("NewCo", { curatedList: [], searchProvider: provider })

    expect(provider.search).toHaveBeenCalledWith("NewCo jobs", {
      includeDomains: ["greenhouse.io", "lever.co", "workable.com"],
      maxResults: 10,
    })
  })

  it("returns a board that shows the company's name and has open jobs", async () => {
    stubJobBoards({ "greenhouse:newco": { name: "NewCo", jobs: 3 } })

    expect(await search("NewCo", ["https://job-boards.greenhouse.io/newco/jobs/1"])).toEqual({
      status: "found_via_search",
      platform: "greenhouse",
      token: "newco",
      sourceUrl: "https://job-boards.greenhouse.io/newco/jobs/1",
    })
  })

  it("rejects other companies' boards that merely came up in the search (live case: Chainalysis -> chainlabs)", async () => {
    stubJobBoards({
      "workable:chainlabs": { name: "Chain Labs", jobs: 4 },
      "greenhouse:customerio": { name: "Customer.io", jobs: 9 },
    })

    const result = await search("Chainalysis", [
      "https://apply.workable.com/chainlabs",
      "https://job-boards.greenhouse.io/customerio/jobs/1",
    ])

    expect(result.status).toBe("not_found")
  })

  it("keeps looking past a wrong-company board to the right one", async () => {
    stubJobBoards({
      "greenhouse:huzzle": { name: "Huzzle", jobs: 2 },
      "lever:notion": { name: "Notion", jobs: 5 },
    })

    const result = await search("Notion", ["https://job-boards.greenhouse.io/huzzle/jobs/1", "https://jobs.lever.co/notion/abc"])

    expect(result).toMatchObject({ status: "found_via_search", platform: "lever", token: "notion" })
  })

  it("reads the company name for each platform (Lever from its board page, Workable from its account)", async () => {
    stubJobBoards({
      "lever:palantir": { name: "Palantir Technologies", jobs: 1 },
      "workable:acme": { name: "Acme", jobs: 1 },
    })

    expect(await search("Palantir", ["https://jobs.lever.co/palantir"])).toMatchObject({ token: "palantir" })
    expect(await search("Acme", ["https://acme.workable.com/j/ABC"])).toMatchObject({ platform: "workable", token: "acme" })
  })

  it("does not count a board with zero open jobs (squatted Workable names answer 200)", async () => {
    stubJobBoards({ "workable:apple": { name: "Apple", jobs: 0 } })
    expect((await search("Apple", ["https://apply.workable.com/apple/"])).status).toBe("not_found")
  })

  it("skips results that aren't job boards, and boards that don't exist", async () => {
    stubJobBoards({ "greenhouse:right-token": { name: "NewCo", jobs: 1 } })

    const result = await search("NewCo", [
      "https://example.com/careers",
      "https://boards.greenhouse.io/wrong-token/jobs/1",
      "https://boards.greenhouse.io/right-token/jobs/1",
    ])

    expect(result).toMatchObject({ status: "found_via_search", token: "right-token" })
  })

  it("checks each distinct board once even if several results point at it", async () => {
    const fetchMock = stubJobBoards({})
    await search("NewCo", ["https://boards.greenhouse.io/newco/jobs/1", "https://boards.greenhouse.io/newco/jobs/2"])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("returns not_found when the search has no results", async () => {
    expect((await search("NewCo", [])).status).toBe("not_found")
  })

  it("returns not_found flagged searchFailed (not a thrown error) when the search provider fails", async () => {
    const provider: SearchProvider = { search: vi.fn().mockRejectedValue(new Error("Tavily rate limit hit")) }

    const result = await discoverCompanyToken("NewCo", { curatedList: [], searchProvider: provider })

    expect(result).toMatchObject({ status: "not_found", searchFailed: true })
    if (result.status === "not_found") expect(result.reason).toContain("Tavily rate limit hit")
  })
})

describe("boardNameMatches", () => {
  it.each([
    ["Mozilla", "Mozilla"],
    ["Oscar", "Oscar Health"],
    ["Oscar Health", "Oscar"],
    ["Gong", "Gong.io"],
    ["Palantir", "Palantir Technologies"],
    ["Chime", "Chime Financial, Inc"],
    ["ScaleAI", "Scale AI"],
    ["hudson river trading", "Hudson River Trading"],
  ])("%s matches %s", (a, b) => {
    expect(boardNameMatches(a, b)).toBe(true)
  })

  it.each([
    ["Box", "Dropbox"],
    ["Meta", "Metabase"],
    ["Chainalysis", "Chain Labs"],
    ["Remote", "General Assembly Remote Jobs"],
    ["Notion", "Huzzle"],
    ["Acme", ""],
    ["", "Acme"],
  ])("%s does not match %s", (a, b) => {
    expect(boardNameMatches(a, b)).toBe(false)
  })
})

describe("normalizeCompanyName", () => {
  it("drops a trailing legal suffix but not the same letters inside a name", () => {
    expect(normalizeCompanyName("Stripe, Inc.")).toBe("stripe")
    expect(normalizeCompanyName("Coinbase")).toBe("coinbase")
    expect(normalizeCompanyName("Incident.io")).toBe("incidentio")
  })
})

describe("parseBoardUrl", () => {
  it.each([
    ["https://boards.greenhouse.io/acme", { platform: "greenhouse", token: "acme" }],
    ["https://job-boards.greenhouse.io/acme/jobs/123?gh_src=x", { platform: "greenhouse", token: "acme" }],
    ["https://boards.greenhouse.io/embed/job_board?for=acme", { platform: "greenhouse", token: "acme" }],
    ["https://boards-api.greenhouse.io/v1/boards/acme/jobs", { platform: "greenhouse", token: "acme" }],
    ["https://jobs.lever.co/acme/abc-123", { platform: "lever", token: "acme" }],
    ["https://jobs.eu.lever.co/acme", { platform: "lever", token: "acme" }],
    ["https://api.lever.co/v0/postings/acme?mode=json", { platform: "lever", token: "acme" }],
    ["https://apply.workable.com/acme/j/ABC123/", { platform: "workable", token: "acme" }],
    ["https://acme.workable.com/", { platform: "workable", token: "acme" }],
  ])("reads %s", (url, expected) => {
    expect(parseBoardUrl(url)).toEqual(expected)
  })

  it.each([
    "https://acme.com/careers",
    "not a url",
    "javascript:alert(1)",
    "ftp://boards.greenhouse.io/acme",
    "https://boards.greenhouse.io/",
    "https://boards.greenhouse.io/embed/job_board",
    "https://jobs.workable.com/view/123",
    "https://www.workable.com/",
    "https://boards.greenhouse.io/<script>",
    "https://evil.com/?u=https://boards.greenhouse.io/acme",
  ])("rejects %s", (url) => {
    expect(parseBoardUrl(url)).toBeNull()
  })
})
