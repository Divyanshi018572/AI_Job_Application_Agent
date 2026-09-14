import type { FieldConfidenceMap } from "@/types/resume"
import { CONFIDENCE_FIELDS, type ConfidenceFieldKey } from "@/types/resume"

/**
 * Plan requirement (Task 1.3): "per-field confidence score, low-confidence
 * fields pre-flagged and editable." Gemini scores each top-level field
 * 0.0–1.0 at extraction time (see RESUME_EXTRACTION_PROMPT in
 * lib/ai/gemini.ts); this module turns that raw score into a UI-safe
 * decision, and is the one place that threshold lives so it's testable and
 * can't drift between the parser and the UI.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.6

/**
 * Clamps and validates a raw confidence map from an LLM response. Unknown
 * keys are dropped (never trust the model to only return the fields we
 * asked for), non-numeric/out-of-range values are dropped rather than
 * coerced — an absent score means "not assessed," which is treated as
 * "don't flag" (see isLowConfidence), not silently defaulted to a fake 0 or 1.
 */
export function normalizeFieldConfidence(
  raw: unknown
): FieldConfidenceMap | undefined {
  if (!raw || typeof raw !== "object") return undefined

  const result: FieldConfidenceMap = {}
  for (const key of CONFIDENCE_FIELDS) {
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      result[key] = Math.min(1, Math.max(0, value))
    }
  }

  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * A field is flagged as low-confidence only when the model actually
 * reported a score below the threshold. A missing score (older resumes
 * parsed before this feature existed, or a model response that omitted a
 * field) is treated as "unknown," not "low" — otherwise every
 * previously-uploaded resume would suddenly show every field as needing
 * review the moment this feature ships.
 */
export function isLowConfidence(score: number | undefined): boolean {
  return typeof score === "number" && score < LOW_CONFIDENCE_THRESHOLD
}

export function getFieldConfidence(
  map: FieldConfidenceMap | undefined,
  field: ConfidenceFieldKey
): number | undefined {
  return map?.[field]
}

export function isFieldLowConfidence(
  map: FieldConfidenceMap | undefined,
  field: ConfidenceFieldKey
): boolean {
  return isLowConfidence(getFieldConfidence(map, field))
}
