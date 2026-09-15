import {
  findCuratedCompany,
  normalizeCompanyName,
  parseBoardUrl,
  searchForCompanyBoard,
  verifyBoard,
} from "@/lib/ats/discovery"
import type { ATSPlatform } from "@/lib/ats/registry"
import type { SearchProvider } from "@/lib/search/types"
import type { createClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Web searches + link checks per user per hour. Tavily's free tier is
 * 1,000 searches a month; curated and cached hits don't count. */
export const MAX_DISCOVERIES_PER_HOUR = 10

export type CompanyDiscoveryOutcome =
  | {
      status: "found"
      /** curated: the verified seed list; cache: this user's earlier
       * verified result; search: a fresh web search; manual: a pasted link. */
      source: "curated" | "cache" | "search" | "manual"
      companyName: string
      platform: ATSPlatform
      token: string
    }
  | { status: "not_found"; companyName: string; reason: string }
  | { status: "invalid_url"; reason: string }
  | { status: "rate_limited"; reason: string }

interface DiscoverOptions {
  userId: string
  companyName: string
  /** A board link the user pasted after a search came up empty. */
  careersUrl?: string
  searchProvider?: SearchProvider
}

async function countRecent(supabase: SupabaseServerClient, userId: string) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from("company_discoveries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo)
  return count ?? 0
}

/** Recording is for review and the cache; a failed insert must never cost
 * the user the board they just found. */
async function record(
  supabase: SupabaseServerClient,
  row: {
    user_id: string
    query: string
    query_key: string
    status: "found_via_search" | "manual" | "not_found"
    ats_platform?: ATSPlatform
    board_token?: string
    source_url?: string
  }
) {
  await supabase.from("company_discoveries").insert(row)
}

const rateLimited = (): CompanyDiscoveryOutcome => ({
  status: "rate_limited",
  reason: `Search limit reached (${MAX_DISCOVERIES_PER_HOUR} company searches per hour). Try again later, or enter a board token directly.`,
})

/**
 * Finds a company's job board by name (plan Task 2.2), in cost order:
 * the curated list, this user's earlier verified result, then a web search
 * with live verification. With careersUrl, checks the pasted link instead.
 * Searches and pasted links are recorded for review (the plan's "add to
 * curated list" / "flagged for review"); curated and cached hits aren't.
 */
export async function discoverCompanyBoard(
  supabase: SupabaseServerClient,
  options: DiscoverOptions
): Promise<CompanyDiscoveryOutcome> {
  const { userId, companyName } = options
  const queryKey = normalizeCompanyName(companyName)

  if (options.careersUrl !== undefined) {
    const board = parseBoardUrl(options.careersUrl)
    if (!board) {
      return {
        status: "invalid_url",
        reason: "That link isn't a Greenhouse, Lever or Workable job board. Open one of the company's job postings and copy its address.",
      }
    }
    if ((await countRecent(supabase, userId)) >= MAX_DISCOVERIES_PER_HOUR) return rateLimited()
    if (!(await verifyBoard(board))) {
      return {
        status: "invalid_url",
        reason: "Couldn't find open jobs on that board. Check the link, or the company may not be hiring right now.",
      }
    }
    await record(supabase, {
      user_id: userId,
      query: companyName,
      query_key: queryKey,
      status: "manual",
      ats_platform: board.platform,
      board_token: board.token,
      source_url: options.careersUrl,
    })
    return { status: "found", source: "manual", companyName, ...board }
  }

  const curated = findCuratedCompany(companyName)
  if (curated) {
    return { status: "found", source: "curated", companyName: curated.name, platform: curated.platform, token: curated.token }
  }

  const { data: cached } = await supabase
    .from("company_discoveries")
    .select("ats_platform, board_token")
    .eq("user_id", userId)
    .eq("query_key", queryKey)
    .in("status", ["found_via_search", "manual"])
    .neq("review_status", "rejected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (cached?.ats_platform && cached.board_token) {
    return {
      status: "found",
      source: "cache",
      companyName,
      platform: cached.ats_platform as ATSPlatform,
      token: cached.board_token,
    }
  }

  if ((await countRecent(supabase, userId)) >= MAX_DISCOVERIES_PER_HOUR) return rateLimited()

  const result = await searchForCompanyBoard(companyName, options.searchProvider)

  if (result.status === "found_via_search") {
    await record(supabase, {
      user_id: userId,
      query: companyName,
      query_key: queryKey,
      status: "found_via_search",
      ats_platform: result.platform,
      board_token: result.token,
      source_url: result.sourceUrl.slice(0, 500),
    })
    return { status: "found", source: "search", companyName, platform: result.platform, token: result.token }
  }

  if (result.status === "not_found" && result.searchFailed) {
    // The search service is down or out of quota — not evidence about the
    // company, so nothing is flagged.
    return {
      status: "not_found",
      companyName,
      reason: "Company search is unavailable right now. Paste a link to one of the company's job postings instead.",
    }
  }

  await record(supabase, { user_id: userId, query: companyName, query_key: queryKey, status: "not_found" })
  return {
    status: "not_found",
    companyName,
    reason: `Couldn't find a Greenhouse, Lever or Workable job board for "${companyName}". Paste a link to one of its job postings instead.`,
  }
}
