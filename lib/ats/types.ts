/**
 * The ATSAdapter interface (project plan Section 3 / Task 2.1). Every
 * supported job platform (Greenhouse, Lever, Workable, ...) implements this
 * once and registers itself in `lib/ats/registry.ts`. Core orchestration
 * code (job ingestion now; the Phase 5 apply-orchestrator later) only ever
 * talks to this interface — never to a specific platform's API shape —
 * so adding platform #4 means writing one new adapter file, not touching
 * shared code.
 */

/** A job posting as returned by a platform's API, before it's normalized
 * into this app's `jobs` table shape (Task 2.4/2.5 territory). Kept
 * intentionally close to "whatever the platform actually gives us" —
 * classification/enrichment happens downstream, once per job, at
 * ingestion, per the plan's cost-control rule.
 */
export interface RawJob {
  /** The platform's own id for this posting — used for de-duplication. */
  sourceId: string
  platform: "greenhouse" | "lever" | "workable"
  title: string
  company: string
  location?: string
  department?: string
  /** Raw HTML/plain-text job description as provided by the platform. */
  description?: string
  /** Canonical URL a candidate would land on to view/apply for this job. */
  jobUrl: string
  /** When the platform says this posting was last updated, if it says. */
  updatedAt?: string
}

/**
 * Minimal placeholder shapes for the apply-orchestration side of the
 * interface (`submitApplication`). These are intentionally thin — the real
 * `Job`/`Profile`/`SubmissionResult` shapes get fleshed out in Phase 3
 * (match scoring needs a richer `Job`) and Phase 5 (auto-apply needs a
 * richer `Profile` + submission tracking). Defined now so the interface
 * compiles end-to-end; adapters implement `submitApplication` as a
 * documented not-yet-implemented stub until Phase 5.
 */
export interface Job {
  id: string
  platform: RawJob["platform"]
  sourceId: string
  jobUrl: string
}

export interface Profile {
  userId: string
}

export interface SubmissionResult {
  status: "submitted" | "needs_review" | "manual_action_required" | "failed"
  message?: string
}

export interface ATSAdapter {
  /** True if this adapter knows how to handle the given job/board URL. */
  detectPlatform(url: string): boolean
  /** Fetch every open posting for a given company token/board id. */
  fetchJobs(token: string): Promise<RawJob[]>
  /** Phase 5 scope — submits an application through this platform. */
  submitApplication(job: Job, profile: Profile): Promise<SubmissionResult>
}
