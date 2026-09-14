import { generateTextWithNvidia } from "@/lib/ai/nvidia"
import type { RawJob } from "@/lib/ats/types"
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  WORK_MODES,
  type JobClassification,
} from "@/lib/jobs/types"

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

  const description = job.description
    ? `\n\n<untrusted_job_description>\n${job.description}\n</untrusted_job_description>`
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

function cleanJsonString(raw: string): string {
  let cleaned = raw.trim()
  if (cleaned.startsWith("```json")) cleaned = cleaned.replace(/^```json/, "").trim()
  else if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```/, "").trim()
  if (cleaned.endsWith("```")) cleaned = cleaned.replace(/```$/, "").trim()
  return cleaned
}

/**
 * Classifies one job. Per the plan: runs once per job at ingestion, result
 * cached on the row — this function itself doesn't cache anything (that's
 * the ingestion pipeline's job, Task 2.3), it's the pure "given a job,
 * return a classification" step so it's independently testable.
 */
export async function classifyJob(job: RawJob): Promise<JobClassification> {
  const responseText = await generateTextWithNvidia({
    prompt: buildClassificationPrompt(job),
    temperature: 0.1,
    maxTokens: 200,
    jsonMode: true,
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(cleanJsonString(responseText))
  } catch {
    // A malformed response is a "couldn't classify" outcome, not a crash —
    // ingestion should still show the job, just without filter tags.
    return { experienceLevel: null, employmentType: null, workMode: null }
  }

  return normalizeClassification(parsed)
}
