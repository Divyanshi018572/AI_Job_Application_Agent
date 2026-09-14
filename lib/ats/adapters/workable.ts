import type { ATSAdapter, Job, Profile, RawJob, SubmissionResult } from "@/lib/ats/types"

/**
 * Workable's public job-board widget API — no auth required. This is the
 * same feed Workable's embeddable careers-page widget uses, listed in
 * Workable's own developer docs as the public/unauthenticated endpoint
 * (distinct from the authenticated Recruiting API, which needs an API key
 * and isn't what Task 2.1 — discovery from public boards — needs).
 */
const WORKABLE_API_BASE = "https://apply.workable.com/api/v1/widget/accounts"

interface WorkableJob {
  title: string
  shortcode: string
  department?: string
  url: string
  created_at?: string
  published_on?: string
  city?: string
  state?: string
  country?: string
}

interface WorkableAccountResponse {
  name?: string
  jobs?: WorkableJob[]
}

function formatWorkableLocation(job: WorkableJob): string | undefined {
  const parts = [job.city, job.state, job.country].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : undefined
}

function mapWorkableJob(job: WorkableJob, companyDisplayName: string): RawJob {
  return {
    sourceId: job.shortcode,
    platform: "workable",
    title: job.title,
    // Unlike Greenhouse/Lever, Workable's widget response does include a
    // real company display name at the account level — use it directly.
    company: companyDisplayName,
    location: formatWorkableLocation(job),
    department: job.department,
    // The widget's job-list endpoint doesn't include the full description
    // (only the per-job detail endpoint does) — left undefined here rather
    // than making N extra requests per board on every ingestion pass.
    description: undefined,
    jobUrl: job.url,
    updatedAt: job.created_at ?? job.published_on,
  }
}

export const workableAdapter: ATSAdapter = {
  detectPlatform(url: string): boolean {
    try {
      const host = new URL(url).hostname
      return host === "apply.workable.com" || host.endsWith(".workable.com")
    } catch {
      return false
    }
  },

  async fetchJobs(token: string): Promise<RawJob[]> {
    const res = await fetch(`${WORKABLE_API_BASE}/${encodeURIComponent(token)}`)

    if (res.status === 404) {
      throw new Error(`Workable account not found for token "${token}"`)
    }
    if (res.status === 429) {
      throw new Error(`Workable rate limit hit while fetching account "${token}"`)
    }
    if (!res.ok) {
      throw new Error(
        `Workable API error (${res.status}) fetching account "${token}"`
      )
    }

    const data = (await res.json()) as WorkableAccountResponse
    if (!Array.isArray(data.jobs)) return []

    const companyDisplayName = data.name ?? token
    return data.jobs.map((job) => mapWorkableJob(job, companyDisplayName))
  },

  async submitApplication(_job: Job, _profile: Profile): Promise<SubmissionResult> {
    // Phase 5 (AI Auto-Apply) scope — same reasoning as the other adapters.
    return {
      status: "failed",
      message:
        "submitApplication is not implemented yet — this is Phase 5 (AI Auto-Apply) scope.",
    }
  },
}
