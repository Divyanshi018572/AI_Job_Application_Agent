import { HttpError } from "@/lib/http/retry"
import type { ATSAdapter, Job, Profile, RawJob, SubmissionResult } from "@/lib/ats/types"

/**
 * Lever Postings API — public, no auth required.
 * https://github.com/lever/postings-api
 */
const LEVER_API_BASE = "https://api.lever.co/v0/postings"

interface LeverPosting {
  id: string
  text: string
  categories?: {
    location?: string
    team?: string
    department?: string
    commitment?: string
  }
  descriptionPlain?: string
  hostedUrl: string
  /** Epoch milliseconds. Lever's public postings endpoint doesn't expose a
   * separate "last updated" timestamp — this is creation time, used as the
   * closest available signal. */
  createdAt?: number
}

function mapLeverPosting(posting: LeverPosting, companyToken: string): RawJob {
  return {
    sourceId: posting.id,
    platform: "lever",
    title: posting.text,
    // Like Greenhouse, Lever's public postings endpoint has no company
    // display name field — falls back to the board token until Task 2.5.
    company: companyToken,
    location: posting.categories?.location,
    department: posting.categories?.team ?? posting.categories?.department,
    description: posting.descriptionPlain,
    jobUrl: posting.hostedUrl,
    updatedAt:
      typeof posting.createdAt === "number"
        ? new Date(posting.createdAt).toISOString()
        : undefined,
  }
}

export const leverAdapter: ATSAdapter = {
  detectPlatform(url: string): boolean {
    try {
      const host = new URL(url).hostname
      return host === "jobs.lever.co" || host.endsWith(".lever.co")
    } catch {
      return false
    }
  },

  async fetchJobs(token: string): Promise<RawJob[]> {
    const res = await fetch(
      `${LEVER_API_BASE}/${encodeURIComponent(token)}?mode=json`
    )

    if (res.status === 404) {
      throw new HttpError(`Lever board not found for token "${token}"`, res.status)
    }
    if (res.status === 429) {
      throw new HttpError(`Lever rate limit hit while fetching board "${token}"`, res.status)
    }
    if (!res.ok) {
      throw new HttpError(`Lever API error (${res.status}) fetching board "${token}"`, res.status)
    }

    const data = (await res.json()) as unknown
    if (!Array.isArray(data)) return []

    return (data as LeverPosting[]).map((posting) => mapLeverPosting(posting, token))
  },

  async submitApplication(_job: Job, _profile: Profile): Promise<SubmissionResult> {
    // Phase 5 (AI Auto-Apply) scope — same reasoning as the Greenhouse
    // adapter. Lever does have an Opportunities/Postings apply API, but
    // wiring it up belongs with the rest of the apply-orchestration design.
    return {
      status: "failed",
      message:
        "submitApplication is not implemented yet — this is Phase 5 (AI Auto-Apply) scope.",
    }
  },
}
