import { HttpError } from "@/lib/http/retry"
import type { ATSAdapter, Job, Profile, RawJob, SubmissionResult } from "@/lib/ats/types"

/**
 * Greenhouse Job Board API — public, no auth required.
 * https://developers.greenhouse.io/job-board.html
 */
const GREENHOUSE_API_BASE = "https://boards-api.greenhouse.io/v1/boards"

interface GreenhouseJob {
  id: number
  title: string
  updated_at?: string
  location?: { name?: string }
  content?: string
  absolute_url: string
  departments?: { name?: string }[]
}

interface GreenhouseJobsResponse {
  jobs: GreenhouseJob[]
}

function mapGreenhouseJob(job: GreenhouseJob, companyToken: string): RawJob {
  return {
    sourceId: String(job.id),
    platform: "greenhouse",
    title: job.title,
    // Greenhouse's job-list endpoint doesn't return a display company name,
    // only the board token used in the URL — fall back to it until Task 2.5
    // (Company Metadata Table) can map tokens to real display names.
    company: companyToken,
    location: job.location?.name,
    department: job.departments?.[0]?.name,
    description: job.content,
    jobUrl: job.absolute_url,
    updatedAt: job.updated_at,
  }
}

export const greenhouseAdapter: ATSAdapter = {
  detectPlatform(url: string): boolean {
    try {
      const host = new URL(url).hostname
      return host === "boards.greenhouse.io" || host.endsWith(".greenhouse.io")
    } catch {
      return false
    }
  },

  async fetchJobs(token: string): Promise<RawJob[]> {
    const res = await fetch(
      `${GREENHOUSE_API_BASE}/${encodeURIComponent(token)}/jobs?content=true`
    )

    if (res.status === 404) {
      throw new HttpError(`Greenhouse board not found for token "${token}"`, res.status)
    }
    if (res.status === 429) {
      throw new HttpError(`Greenhouse rate limit hit while fetching board "${token}"`, res.status)
    }
    if (!res.ok) {
      throw new HttpError(
        `Greenhouse API error (${res.status}) fetching board "${token}"`
      , res.status)
    }

    const data = (await res.json()) as GreenhouseJobsResponse
    if (!Array.isArray(data.jobs)) return []

    return data.jobs.map((job) => mapGreenhouseJob(job, token))
  },

  async submitApplication(_job: Job, _profile: Profile): Promise<SubmissionResult> {
    // Phase 5 (AI Auto-Apply) scope. Greenhouse does have a real Job Board
    // API for application submission (POST /v1/boards/{token}/jobs/{id}),
    // but wiring it up belongs with the rest of the apply-orchestration
    // work (submission-path decision, form field detection, the human
    // confirmation gate) — not bolted on here ahead of that design.
    return {
      status: "failed",
      message:
        "submitApplication is not implemented yet — this is Phase 5 (AI Auto-Apply) scope.",
    }
  },
}
