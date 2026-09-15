import { getAdapter, type ATSPlatform } from "@/lib/ats/registry"
import type { RawJob } from "@/lib/ats/types"
import { withRetry } from "@/lib/http/retry"
import { classifyJob } from "@/lib/jobs/classify"
import { mapWithConcurrency } from "@/lib/jobs/concurrency"
import type { createClient } from "@/lib/supabase/server"

const DEFAULT_CACHE_WINDOW_HOURS = 6
const CLASSIFICATION_CONCURRENCY = 3

/**
 * Jobs classified per request. Real boards run to hundreds of postings
 * (Stripe 632, Databricks 891 on 2026-09-15), so a whole board can't be
 * classified inside one request. Measured on Discord's live board with the
 * real NIM API: 5–20s per job (real ~5,000-char descriptions), 6 jobs in
 * ~25s at concurrency 3 — so 12 jobs is about 50s at worst.
 */
export const CLASSIFICATION_BATCH_SIZE = 12

/**
 * Backstop for slow responses: no new classification starts after this
 * much time in a batch. Jobs not started stay pending for the next "Tag
 * more" — not failures. Leaves room under the route's 60s maxDuration for
 * one in-flight call (slowest observed: ~20s).
 */
export const CLASSIFICATION_TIME_BUDGET_MS = 35_000

/** Rows per upsert request. A job description is ~8.7 KB on real boards,
 * so one request for a 900-job board would be several megabytes. */
const UPSERT_CHUNK_SIZE = 100

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
  batchSize?: number
  /** Injectable so tests don't wait on real backoff timers. */
  sleep?: (ms: number) => Promise<void>
}

export interface ClassificationBatchResult {
  /** Jobs tagged in this batch (including ones the model correctly left null). */
  jobsClassified: number
  /** Jobs on this board still waiting to be tagged after this batch. */
  pendingClassification: number
  /** Jobs whose classifier call failed (after retries and model fallback).
   * They stay pending and are retried next batch — distinct from a posting
   * that was classified but didn't state its level, which is a normal null. */
  classificationFailures: number
  /** First failure's message, for surfacing to the user. */
  classificationError?: string
}

export interface IngestResult extends ClassificationBatchResult {
  status: "cached" | "fetched"
  jobsFetched: number
  jobsUpserted: number
}

interface BoardScope {
  userId: string
  platform: ATSPlatform
  boardToken: string
}

/**
 * Task 2.3's cache check: has this exact user+platform+board been fetched
 * within the cache window? Exported separately so the "should we skip
 * fetching" decision is testable on its own.
 */
export async function isRecentlyFetched(
  supabase: SupabaseServerClient,
  options: BoardScope & { cacheWindowHours?: number }
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

async function countPending(supabase: SupabaseServerClient, scope: BoardScope): Promise<number> {
  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", scope.userId)
    .eq("platform", scope.platform)
    .eq("board_token", scope.boardToken)
    .is("classified_at", null)
  return count ?? 0
}

/**
 * Classifies the next batch of this board's untagged jobs and writes each
 * result back with classified_at set, so it is never sent to the model
 * again (plan Task 2.4: "runs once per job... never recomputed").
 *
 * A job whose classifier call fails is left untagged (classified_at stays
 * null) so the next batch retries it, and counted so a dead model or bad
 * key is visible instead of silent.
 */
export async function classifyPendingJobs(
  supabase: SupabaseServerClient,
  options: BoardScope & {
    batchSize?: number
    timeBudgetMs?: number
    sleep?: (ms: number) => Promise<void>
    /** Injectable clock for tests. */
    now?: () => number
  }
): Promise<ClassificationBatchResult> {
  const now = options.now ?? Date.now
  const deadline = now() + (options.timeBudgetMs ?? CLASSIFICATION_TIME_BUDGET_MS)

  const { data: pending, error } = await supabase
    .from("jobs")
    .select("id, platform, title, company, location, description, job_url")
    .eq("user_id", options.userId)
    .eq("platform", options.platform)
    .eq("board_token", options.boardToken)
    .is("classified_at", null)
    .order("fetched_at", { ascending: false })
    .limit(options.batchSize ?? CLASSIFICATION_BATCH_SIZE)

  if (error) throw new Error(`Failed to load jobs to classify: ${error.message}`)

  let jobsClassified = 0
  let classificationFailures = 0
  let classificationError: string | undefined

  await mapWithConcurrency(pending ?? [], CLASSIFICATION_CONCURRENCY, async (row) => {
    // Out of time: leave this job pending for the next batch.
    if (now() >= deadline) return

    const job: RawJob = {
      sourceId: row.id,
      platform: row.platform as ATSPlatform,
      title: row.title,
      company: row.company,
      location: row.location ?? undefined,
      description: row.description ?? undefined,
      jobUrl: row.job_url,
    }

    try {
      const classification = await classifyJob(job, { sleep: options.sleep })
      const { error: updateError } = await supabase
        .from("jobs")
        .update({
          experience_level: classification.experienceLevel,
          employment_type: classification.employmentType,
          work_mode: classification.workMode,
          classified_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("user_id", options.userId)
      if (updateError) throw new Error(`Failed to save classification: ${updateError.message}`)
      jobsClassified++
    } catch (err: unknown) {
      classificationFailures++
      classificationError ??= err instanceof Error ? err.message : String(err)
    }
  })

  return {
    jobsClassified,
    pendingClassification: await countPending(supabase, options),
    classificationFailures,
    ...(classificationError ? { classificationError } : {}),
  }
}

/**
 * Fetches a company's open jobs via the registered ATS adapter, saves them,
 * then classifies the next batch of untagged ones.
 *
 * - Fetch is skipped if this board was fetched for this user within the
 *   cache window (Task 2.3). Calling again inside the window just tags the
 *   next batch — that's how the UI's "Tag more" works.
 * - The fetch retries 429/5xx with exponential backoff (Task 2.3); a 404
 *   (wrong token) fails immediately.
 * - Saving only writes the posting's own fields. Classification columns are
 *   left out of the upsert, so a re-fetch never wipes or re-pays for tags a
 *   job already has.
 */
export async function ingestJobsForCompany(
  supabase: SupabaseServerClient,
  options: IngestOptions
): Promise<IngestResult> {
  const scope: BoardScope = {
    userId: options.userId,
    platform: options.platform,
    boardToken: options.boardToken,
  }

  let status: IngestResult["status"] = "cached"
  let jobsFetched = 0
  let jobsUpserted = 0

  if (!(await isRecentlyFetched(supabase, { ...scope, cacheWindowHours: options.cacheWindowHours }))) {
    status = "fetched"
    const adapter = getAdapter(options.platform)
    const rawJobs = await withRetry(() => adapter.fetchJobs(options.boardToken), {
      sleep: options.sleep,
    })
    jobsFetched = rawJobs.length

    const fetchedAt = new Date().toISOString()
    const rows = rawJobs.map((job) => ({
      user_id: options.userId,
      platform: job.platform,
      board_token: options.boardToken,
      title: job.title,
      company: options.companyDisplayName ?? job.company,
      location: job.location ?? null,
      description: job.description ?? null,
      job_url: job.jobUrl,
      source_url: job.jobUrl,
      fetched_at: fetchedAt,
    }))

    for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE)
      const { error } = await supabase
        .from("jobs")
        .upsert(chunk, { onConflict: "user_id,job_url" })
      if (error) throw new Error(`Failed to save ingested jobs: ${error.message}`)
      jobsUpserted += chunk.length
    }
  }

  const batch = await classifyPendingJobs(supabase, {
    ...scope,
    batchSize: options.batchSize,
    sleep: options.sleep,
  })

  return { status, jobsFetched, jobsUpserted, ...batch }
}
