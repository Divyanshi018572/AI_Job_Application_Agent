/**
 * A generic web-search provider interface — same reasoning as ATSAdapter
 * (lib/ats/types.ts): the plan originally specified Brave Search for this,
 * but "which search API" is exactly the kind of swappable external
 * integration the plan's Section 3 adapter pattern is meant for. Company
 * token discovery (lib/ats/discovery.ts) depends on this interface, never
 * on a specific provider — switching from Tavily to something else later
 * means one new file + one registry line, not touching discovery logic.
 */
export interface SearchResult {
  title: string
  url: string
  snippet?: string
}

export interface SearchProvider {
  search(query: string): Promise<SearchResult[]>
}
