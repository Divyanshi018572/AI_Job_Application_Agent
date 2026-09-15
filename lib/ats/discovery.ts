import { CURATED_COMPANIES, type CuratedCompany } from "@/lib/ats/curated-companies"
import { ATS_ADAPTERS, detectPlatform, getAdapter, type ATSPlatform } from "@/lib/ats/registry"
import { tavilyProvider } from "@/lib/search/providers/tavily"
import type { SearchProvider } from "@/lib/search/types"

export type DiscoveryResult =
  | { status: "found_curated"; platform: ATSPlatform; token: string }
  | { status: "found_via_search"; platform: ATSPlatform; token: string; sourceUrl: string }
  /** searchFailed: the search provider itself errored (missing key, quota)
   * — not evidence the company has no board. */
  | { status: "not_found"; reason: string; searchFailed?: true }

export interface BoardRef {
  platform: ATSPlatform
  token: string
}

const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

/** Workable's own subdomains, which aren't company accounts. */
const WORKABLE_RESERVED = new Set(["www", "jobs", "apply", "help", "resources", "blog", "careers"])

/**
 * Board token from a URL on one of the registered platforms, or null. Each
 * platform keeps the token somewhere different:
 * - Greenhouse: boards.greenhouse.io/{token}, job-boards.greenhouse.io/{token},
 *   …/embed/job_board?for={token}, boards-api.greenhouse.io/v1/boards/{token}
 * - Lever: jobs.lever.co/{token}, jobs.eu.lever.co/{token},
 *   api.lever.co/v0/postings/{token}
 * - Workable: apply.workable.com/{token}, {token}.workable.com
 */
function extractToken(parsed: URL, platform: ATSPlatform): string | null {
  const segments = parsed.pathname.split("/").filter(Boolean)
  let token: string | undefined

  if (platform === "greenhouse") {
    token =
      parsed.searchParams.get("for") ??
      (parsed.hostname === "boards-api.greenhouse.io"
        ? segments[segments.indexOf("boards") + 1]
        : segments[0])
  } else if (platform === "lever") {
    token = parsed.hostname === "api.lever.co" ? segments[segments.indexOf("postings") + 1] : segments[0]
  } else if (parsed.hostname === "apply.workable.com") {
    token = segments[0]
  } else {
    const subdomain = parsed.hostname.split(".")[0]
    token = WORKABLE_RESERVED.has(subdomain) ? undefined : subdomain
  }

  return token && TOKEN_PATTERN.test(token) && token !== "embed" ? token : null
}

/**
 * The job board a URL points at — for search results and for a careers
 * link the user pastes. Only recognises the registered platforms' own
 * hosts; anything else (a company's own careers page) is null.
 */
export function parseBoardUrl(url: string): BoardRef | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null

  const platform = detectPlatform(parsed.href)
  if (!platform) return null

  const token = extractToken(parsed, platform)
  return token ? { platform, token } : null
}

/**
 * Live check that a board is real and in use: the platform's API answers
 * for this token *and* lists at least one open job. The second half
 * matters — Workable answers 200 for any registered account name, and
 * squatted names like "apple" or "meta" come back with zero jobs.
 */
export async function verifyBoard(board: BoardRef): Promise<boolean> {
  try {
    const jobs = await getAdapter(board.platform).fetchJobs(board.token)
    return jobs.length > 0
  } catch {
    return false
  }
}

const LEGAL_SUFFIX = /\s+(inc|llc|ltd|limited|corp|corporation|co|plc|gmbh)$/

function nameWords(name: string): string[] {
  const words = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(LEGAL_SUFFIX, "")
  return words ? words.split(" ") : []
}

/** Lowercase, punctuation and spacing removed, common legal suffixes
 * dropped — so "Scale AI", "scale-ai" and "Stripe, Inc." match. */
export function normalizeCompanyName(name: string): string {
  return nameWords(name).join("")
}

/**
 * Does a board's displayed name belong to the company searched for? The
 * same name, or one is the other plus extra trailing words: "Oscar" ↔
 * "Oscar Health", "Gong" ↔ "Gong.io", "Palantir" ↔ "Palantir
 * Technologies". Whole words only, so "Box" ≠ "Dropbox", "Meta" ≠
 * "Metabase", "Chainalysis" ≠ "Chain Labs".
 */
export function boardNameMatches(companyName: string, boardName: string): boolean {
  const a = nameWords(companyName)
  const b = nameWords(boardName)
  if (!a.length || !b.length) return false
  if (a.join("") === b.join("")) return true
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  return shorter.every((word, i) => longer[i] === word)
}

export function findCuratedCompany(
  companyName: string,
  curatedList: CuratedCompany[] = CURATED_COMPANIES
): CuratedCompany | null {
  const key = normalizeCompanyName(companyName)
  if (!key) return null
  return curatedList.find((c) => normalizeCompanyName(c.name) === key) ?? null
}

/**
 * Searches the job-board domains for the company and returns the first
 * result whose board shows this company's name and has open jobs (plan:
 * "verify token via a live test API call"). Anything else is skipped so
 * the next result gets a chance.
 */
export async function searchForCompanyBoard(
  companyName: string,
  searchProvider: SearchProvider = tavilyProvider
): Promise<DiscoveryResult> {
  // Restricted to the job-board domains. The plan's original query
  // ("<company> careers greenhouse OR lever OR workable") returned Reddit,
  // Google and gao.gov for "Mozilla" in a live test — search APIs don't
  // honour OR — while the domain filter found Mozilla's real board first.
  let results
  try {
    results = await searchProvider.search(`${companyName} jobs`, {
      includeDomains: Object.values(ATS_ADAPTERS).map((adapter) => adapter.searchDomain),
      maxResults: 10,
    })
  } catch (err) {
    return {
      status: "not_found",
      reason: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
      searchFailed: true,
    }
  }

  const tried = new Set<string>()
  for (const result of results) {
    const board = parseBoardUrl(result.url)
    if (!board) continue

    const key = `${board.platform}:${board.token.toLowerCase()}`
    if (tried.has(key)) continue
    tried.add(key)

    // Domain-restricted results include other companies' postings that
    // merely mention this one (searching "Notion" returned boards for
    // Huzzle and Customer.io; "Chainalysis" returned "chainlabs"), and
    // those boards are real and have jobs. So the board must also be *this*
    // company's — the name it displays has to match.
    const boardName = await getAdapter(board.platform).fetchBoardName(board.token)
    if (!boardName || !boardNameMatches(companyName, boardName)) continue

    if (await verifyBoard(board)) {
      return { status: "found_via_search", ...board, sourceUrl: result.url }
    }
  }

  return {
    status: "not_found",
    reason: "No search result yielded a verifiable board token. Flagged for manual URL entry.",
  }
}

/**
 * Company token discovery (plan Task 2.2): the curated list first, then a
 * web search with live verification. On not_found the caller falls back to
 * manual URL entry. Dependencies are injectable for tests.
 */
export async function discoverCompanyToken(
  companyName: string,
  options: {
    curatedList?: CuratedCompany[]
    searchProvider?: SearchProvider
  } = {}
): Promise<DiscoveryResult> {
  const curatedMatch = findCuratedCompany(companyName, options.curatedList)
  if (curatedMatch) {
    return { status: "found_curated", platform: curatedMatch.platform, token: curatedMatch.token }
  }

  return searchForCompanyBoard(companyName, options.searchProvider)
}
