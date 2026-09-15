import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { tavilyProvider } from "@/lib/search/providers/tavily"

const originalEnv = process.env.TAVILY_API_KEY

beforeEach(() => {
  process.env.TAVILY_API_KEY = "test-key"
})

afterEach(() => {
  vi.unstubAllGlobals()
  process.env.TAVILY_API_KEY = originalEnv
})

describe("tavilyProvider.search", () => {
  it("throws a clear error when TAVILY_API_KEY is missing", async () => {
    delete process.env.TAVILY_API_KEY
    await expect(tavilyProvider.search("acme careers")).rejects.toThrow(
      /TAVILY_API_KEY/
    )
  })

  it("maps a successful response into SearchResult[]", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            results: [
              {
                title: "Acme Careers",
                url: "https://boards.greenhouse.io/acme",
                content: "Join Acme...",
              },
            ],
          }),
      })
    )

    const results = await tavilyProvider.search("acme careers")
    expect(results).toEqual([
      {
        title: "Acme Careers",
        url: "https://boards.greenhouse.io/acme",
        snippet: "Join Acme...",
      },
    ])
  })

  it("returns an empty array when the response has no results field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) })
    )
    expect(await tavilyProvider.search("acme careers")).toEqual([])
  })

  it("throws a clear error on 401 (bad key)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve("") })
    )
    await expect(tavilyProvider.search("acme careers")).rejects.toThrow(/rejected/i)
  })

  it("throws a clear error on 429 (rate limited)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 429, text: () => Promise.resolve("") })
    )
    await expect(tavilyProvider.search("acme careers")).rejects.toThrow(/rate limit/i)
  })

  it("sends the query and api_key in the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await tavilyProvider.search("acme careers greenhouse OR lever OR workable")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.tavily.com/search")
    const body = JSON.parse(init.body)
    expect(body.api_key).toBe("test-key")
    expect(body.query).toBe("acme careers greenhouse OR lever OR workable")
  })

  it("passes a domain filter and result count through to Tavily", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ results: [] }) })
    vi.stubGlobal("fetch", fetchMock)

    await tavilyProvider.search("acme jobs", { includeDomains: ["greenhouse.io", "lever.co"], maxResults: 10 })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({ query: "acme jobs", include_domains: ["greenhouse.io", "lever.co"], max_results: 10 })
  })

  it("sends no domain filter when none is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ results: [] }) })
    vi.stubGlobal("fetch", fetchMock)

    await tavilyProvider.search("acme careers")

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).not.toHaveProperty("include_domains")
    expect(body.max_results).toBe(5)
  })
})
