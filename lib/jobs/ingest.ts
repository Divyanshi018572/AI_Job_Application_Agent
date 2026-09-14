import { getAdapter, type ATSPlatform } from "@/lib/ats/registry"
import { classifyJob } from "@/lib/jobs/classify"
import { mapWithConcurrency } from "@/lib/jobs/concurrency"
import type { createClient } from "@/lib/supabase/server"

const DEFAULT_CACHE_WINDOW_HOURS = 6
const CLASSIFICATION_CONCURRENCY = 3

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface IngestOptions {
  userId: string
  platform: ATSPlatform
  boardToken: string
  /** Overrides the display name Greenhouse/Lever adapters otherwise fall
   * back to (the board token itself) — e.g. a real name resolved via
   * discovery (Task 2.2) or a curated companies entry (Task 2.5). */
  companyDisplayName?: string
  cacheWindowHours?: number
}

export interface IngestResult {
  status: "cached" | "fetched"
  jobsFetched: number
  jobsUpserted: number
}

/**
 * Task 2.3's cache check: has this exact user+platform+board been fetched
 * within the cache window? Exported separately from ingestJobsForCompany
 * so the "should we skip fetching" decision is independently testable
 * without needing to mock the ATS adapter or classifier too.
 */
export async function isRecentlyFetched(
  supabase: SupabaseServerClient,
  options: {
    userId: string
    platform: ATSPlatform
    boardToken: string
    cacheWindowHours?: number
  }
): Promise<boolean> {
  const cacheWindowHours = options.cacheWindowHours ?? DEFAULT_CACHE_WINDOW_HOURS

  const { data } = await supabase
    .from("jobs")
    .select("fetched_at")
    .eq("user_id", options.userId)
    .eq("platform", options.platform)
    .eq("board_token", options.boardToken)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.fetched_at) return false

  const ageMs = Date.now() - new Date(data.fetched_at).getTime()
  return ageMs < cacheWindowHours * 60 * 60 * 1000
}

/**
 * Fetches a company's open jobs (via the registered ATS adapter),
 * classifies each one (NVIDIA NIM, Task 2.4), and upserts the results into
 * `jobs`. Skips the fetch entirely if this exact board was fetched
 * recently for this user (Task 2.3's cache rule) — callers that already
 * know they want fresh data can pass cacheWindowHours: 0 to force a
 * re-fetch.
 *
 * Classification runs with bounded concurrency (lib/jobs/concurrency.ts)
 * rather than firing every job's classification call at once — a board
 * with 50 postings shouldn't mean 50 simultaneous NIM requests.
 */
export async function ingestJobsForCompany(
  supabase: SupabaseServerClient,
  options: IngestOptions
): Promise<IngestResult> {
  const alreadyFresh = await isRecentlyFetched(supabase, options)
  if (alreadyFresh) {
    return { status: "cached", jobsFetched: 0, jobsUpserted: 0 }
  }

  const adapter = getAdapter(options.platform)
  const rawJobs = await adapter.fetchJobs(options.boardToken)

  if (rawJobs.length === 0) {
    return { status: "fetched", jobsFetched: 0, jobsUpserted: 0 }
  }

  const classifications = await mapWithConcurrency(
    rawJobs,
    CLASSIFICATION_CONCURRENCY,
    (job) =>
      classifyJob(job).catch(() => ({
        experienceLevel: null,
        employmentType: null,
        workMode: null,
      }))
  )

  const fetchedAt = new Date().toISOString()
  const rows = rawJobs.map((job, i) => ({
    user_id: options.userId,
    platform: job.platform,
    board_token: options.boardToken,
    title: job.title,
    company: options.companyDisplayName ?? job.company,
    location: job.location ?? null,
    experience_level: classifications[i].experienceLevel,
    employment_type: classifications[i].employmentType,
    work_mode: classifications[i].workMode,
    description: job.description ?? null,
    job_url: job.jobUrl,
    source_url: job.jobUrl,
    fetched_at: fetchedAt,
  }))

  const { error } = await supabase
    .from("jobs")
    .upsert(rows, { onConflict: "user_id,job_url" })

  if (error) {
    throw new Error(`Failed to save ingested jobs: ${error.message}`)
  }

  return { status: "fetched", jobsFetched: rawJobs.length, jobsUpserted: rows.length }
}
