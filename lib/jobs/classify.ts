import { generateTextWithNvidia } from "@/lib/ai/nvidia"
import type { RawJob } from "@/lib/ats/types"
import { withRetry } from "@/lib/http/retry"
import { htmlToPlainText, truncateForPrompt } from "@/lib/jobs/text"
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  WORK_MODES,
  type JobClassification,
} from "@/lib/jobs/types"

/** Descriptions are converted to plain text and capped before prompting —
 * enough to cover a posting's requirements section without paying for
 * every word of benefits boilerplate on each of hundreds of jobs. */
const MAX_DESCRIPTION_CHARS = 6000

/**
 * Models tried in order. Both were verified on 2026-09-15 against the real
 * NIM API with this exact prompt: correct on an explicit posting, all-null
 * on a vague one (the "don't guess" rule). nemotron-3-super averaged ~3s,
 * gpt-oss-20b ~7.6s but went 6/6 — hence primary + fallback.
 *
 * NVIDIA retires hosted models on a schedule (the plan-era choice,
 * meta/llama-3.3-70b-instruct, went end-of-life 2026-08-26 and returns
 * 410), so NVIDIA_CLASSIFICATION_MODEL in .env.local can put a different
 * model first without a code change.
 */
const DEFAULT_CLASSIFICATION_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b",
  "openai/gpt-oss-20b",
]

export function classificationModels(): string[] {
  const override = process.env.NVIDIA_CLASSIFICATION_MODEL?.trim()
  if (!override) return DEFAULT_CLASSIFICATION_MODELS
  return [override, ...DEFAULT_CLASSIFICATION_MODELS.filter((m) => m !== override)]
}

const CLASSIFICATION_PROMPT = `You are classifying a job posting into three fixed categories. Read the job title, description, and location below, then respond with ONLY a JSON object in exactly this shape — no markdown, no explanation:

{
  "experienceLevel": one of ${JSON.stringify(EXPERIENCE_LEVELS)} or null,
  "employmentType": one of ${JSON.stringify(EMPLOYMENT_TYPES)} or null,
  "workMode": one of ${JSON.stringify(WORK_MODES)} or null
}

Rules:
- Use null for any field the posting genuinely doesn't give you enough information to determine. Do not guess — an unclassified field is far better than a wrong one, since these drive job-search filters a candidate relies on.
- "experienceLevel" is about years of experience required, not seniority of title alone (e.g. a "Senior" title with no experience requirement stated could still be null).
- "workMode" should only be "Remote" if the posting is explicit about it — a job with no location mentioned is not automatically Remote.`

/**
 * Untrusted-data framing for job posting text, same reasoning as the resume
 * parser (see lib/ai/gemini.ts / SECURITY.md Section 5) — a job description
 * is third-party content (from the employer's ATS, not this app's user),
 * still not something to treat as instructions to the model.
 */
function buildClassificationPrompt(job: RawJob): string {
  const details = [
    `Title: ${job.title}`,
    job.location ? `Location: ${job.location}` : null,
    job.department ? `Department: ${job.department}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const plainDescription = job.description
    ? truncateForPrompt(htmlToPlainText(job.description), MAX_DESCRIPTION_CHARS)
    : ""
  const description = plainDescription
    ? `\n\n<untrusted_job_description>\n${plainDescription}\n</untrusted_job_description>`
    : ""

  return `${CLASSIFICATION_PROMPT}\n\n${details}${description}`
}

function isValidEnumValue<T extends readonly string[]>(
  allowed: T,
  value: unknown
): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
}

/**
 * Validates raw (untrusted) model output against the fixed enums. Anything
 * that isn't exactly one of the allowed values — including a hallucinated
 * new category, wrong casing, or explanatory text instead of a bare value
 * — becomes null rather than being passed through. Exported so the
 * "reject invalid, keep valid, missing stays null" behavior is unit
 * testable without needing a real model call (plan Task 2.4's own testing
 * requirement: "classification prompt output schema validation").
 */
export function normalizeClassification(raw: unknown): JobClassification {
  if (!raw || typeof raw !== "object") {
    return { experienceLevel: null, employmentType: null, workMode: null }
  }

  const obj = raw as Record<string, unknown>

  return {
    experienceLevel: isValidEnumValue(EXPERIENCE_LEVELS, obj.experienceLevel)
      ? obj.experienceLevel
      : null,
    employmentType: isValidEnumValue(EMPLOYMENT_TYPES, obj.employmentType)
      ? obj.employmentType
      : null,
    workMode: isValidEnumValue(WORK_MODES, obj.workMode) ? obj.workMode : null,
  }
}

/**
 * Parses the model's reply. Tries the whole reply first (after stripping
 * markdown fences), then falls back to the outermost {...} span — some
 * models put a sentence before or after the JSON even when told not to.
 */
function parseJsonReply(raw: string): unknown {
  let cleaned = raw.trim()
  if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json/, "").trim()
  else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```/, "").trim()
  if (cleaned.endsWith("```")) cleaned = cleaned.replace(/```$/, "").trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start === -1 || end <= start) throw new Error("No JSON object in reply")
    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

export interface ClassifyDeps {
  /** Injectable so tests don't wait on real backoff timers. */
  sleep?: (ms: number) => Promise<void>
}

/**
 * Classifies one job. Per the plan: runs once per job at ingestion, result
 * cached on the row — this function itself doesn't cache anything (that's
 * the ingestion pipeline's job, Task 2.3), it's the pure "given a job,
 * return a classification" step so it's independently testable.
 *
 * Transient API failures (429/5xx) are retried with backoff on the same
 * model. An unavailable model (404/410 — withRetry doesn't retry those) or
 * exhausted retries move on to the next model in classificationModels().
 * If every model fails, this throws —
 * the ingestion pipeline counts those and reports them, rather than the job
 * silently landing unclassified.
 *
 * A reply that arrives but isn't usable JSON is different: that's a
 * "couldn't classify this posting" outcome, returned as all-null.
 */
export async function classifyJob(
  job: RawJob,
  deps: ClassifyDeps = {}
): Promise<JobClassification> {
  const prompt = buildClassificationPrompt(job)
  let lastError: unknown

  for (const model of classificationModels()) {
    let responseText: string
    try {
      responseText = await withRetry(
        () =>
          generateTextWithNvidia({
            prompt,
            model,
            temperature: 0.1,
            // Reasoning models spend tokens thinking before they answer; a
            // tight cap can cut the answer off. Billing is per token used,
            // not per token allowed.
            maxTokens: 800,
            jsonMode: true,
          }),
        { retries: 2, sleep: deps.sleep }
      )
    } catch (err) {
      lastError = err
      continue
    }

    try {
      return normalizeClassification(parseJsonReply(responseText))
    } catch {
      return { experienceLevel: null, employmentType: null, workMode: null }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Job classification failed on every configured model")
}
