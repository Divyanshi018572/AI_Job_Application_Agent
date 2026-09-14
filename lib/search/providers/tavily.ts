import type { SearchProvider, SearchResult } from "@/lib/search/types"

/**
 * Tavily Search API — used in place of the plan's original Brave Search
 * spec (documented provider swap, see AUDIT_AND_ROADMAP.md). Chosen
 * because it has a genuinely free tier with no card required at signup,
 * unlike Brave's free tier.
 * https://docs.tavily.com/documentation/api-reference/endpoint/search
 */
interface TavilyApiResult {
  title: string
  url: string
  content?: string
}

interface TavilyApiResponse {
  results?: TavilyApiResult[]
}

export const tavilyProvider: SearchProvider = {
  async search(query: string): Promise<SearchResult[]> {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      throw new Error("Missing TAVILY_API_KEY in environment variables (.env.local)")
    }

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
      }),
    })

    if (res.status === 401) {
      throw new Error("Tavily API rejected the request — check TAVILY_API_KEY")
    }
    if (res.status === 429) {
      throw new Error("Tavily rate limit hit")
    }
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Tavily API error (${res.status}): ${body}`)
    }

    const data = (await res.json()) as TavilyApiResponse
    if (!Array.isArray(data.results)) return []

    return data.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }))
  },
}
