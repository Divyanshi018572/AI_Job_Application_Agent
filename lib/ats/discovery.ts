import { CURATED_COMPANIES, type CuratedCompany } from "@/lib/ats/curated-companies"
import { detectPlatform, getAdapter, type ATSPlatform } from "@/lib/ats/registry"
import { tavilyProvider } from "@/lib/search/providers/tavily"
import type { SearchProvider } from "@/lib/search/types"

export type DiscoveryResult =
  | { status: "found_curated"; platform: ATSPlatform; token: string }
  | { status: "found_via_search"; platform: ATSPlatform; token: string; sourceUrl: string }
  | { status: "not_found"; reason: string }

/**
 * Extracts a board token from a URL already known to belong to one of the
 * registered platforms. Each platform's token lives in a different part of
 * the URL (a path segment for Greenhouse/Lever/Workable's apply.workable.com
 * form, a subdomain for Workable's {token}.workable.com form) — this is
 * about *where in the URL* the token is, which is different information
 * than detectPlatform() (which only says *which platform*).
 */
function extractToken(url: string, platform: ATSPlatform): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (platform === "workable" && parsed.hostname !== "apply.workable.com") {
    // {token}.workable.com form
    const token = parsed.hostname.split(".")[0]
    return token || null
  }

  const firstSegment = parsed.pathname.split("/").filter(Boolean)[0]
  return firstSegment || null
}

/**
 * Checks each search result in order, extracting a candidate token and
 * verifying it with a real (live) API call to the matching adapter — the
 * plan's explicit requirement ("verify token via a live test API call").
 * A search result whose URL doesn't map to a known platform, or whose
 * extracted token turns out not to actually exist on that platform, is
 * skipped rather than treated as a fatal error — the next result gets a
 * chance.
 */
async function verifyFirstWorkingResult(
  results: { url: string }[]
): Promise<DiscoveryResult> {
  for (const result of results) {
    const platform = detectPlatform(result.url)
    if (!platform) continue

    const token = extractToken(result.url, platform)
    if (!token) continue

    try {
      await getAdapter(platform).fetchJobs(token)
      return { status: "found_via_search", platform, token, sourceUrl: result.url }
    } catch {
      // This candidate token didn't verify — try the next search result
      // rather than giving up immediately.
      continue
    }
  }

  return {
    status: "not_found",
    reason:
      "No search result yielded a verifiable board token. Flagged for manual URL entry.",
  }
}

/**
 * Company token discovery (plan Task 2.2): check the curated list first;
 * if not found, search for the company's careers page and verify a
 * candidate token with a live API call; if that also fails, the caller
 * should fall back to manual URL entry.
 *
 * curatedList and searchProvider are injectable (default to the shared
 * seed list and Tavily) so this is unit-testable without real network
 * calls, and so Task 2.5's eventual DB-backed curated list is a drop-in
 * replacement.
 */
export async function discoverCompanyToken(
  companyName: string,
  options: {
    curatedList?: CuratedCompany[]
    searchProvider?: SearchProvider
  } = {}
): Promise<DiscoveryResult> {
  const curatedList = options.curatedList ?? CURATED_COMPANIES
  const searchProvider = options.searchProvider ?? tavilyProvider

  const curatedMatch = curatedList.find(
    (c) => c.name.toLowerCase() === companyName.toLowerCase()
  )
  if (curatedMatch) {
    return {
      status: "found_curated",
      platform: curatedMatch.platform,
      token: curatedMatch.token,
    }
  }

  let results
  try {
    results = await searchProvider.search(
      `${companyName} careers greenhouse OR lever OR workable`
    )
  } catch (err) {
    return {
      status: "not_found",
      reason: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  return verifyFirstWorkingResult(results)
}
