/**
 * Classification enums straight from the plan's filter set (Section 7.2).
 * Kept as const arrays (not just TS union types) so validation code can
 * check "is this actually one of the allowed values" at runtime against
 * LLM output, not just at compile time against hand-written code.
 */
export const EXPERIENCE_LEVELS = [
  "Fresher",
  "0-1",
  "1-3",
  "3-5",
  "5+",
  "Senior-Lead",
] as const
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]

export const EMPLOYMENT_TYPES = ["Internship", "Full-time", "Contract", "Part-time"] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const WORK_MODES = ["Remote", "Hybrid", "Onsite"] as const
export type WorkMode = (typeof WORK_MODES)[number]

/**
 * Result of classifying one job. Each field is nullable — a job that
 * genuinely can't be classified (e.g. no location info in the posting at
 * all) gets `null`, never a guessed value. Matches the plan's own principle
 * for Task 2.5 ("unclassified company → no tag shown, not a guess")
 * applied to job classification too: a missing filter tag is honest, a
 * wrong one actively misleads a job search.
 */
export interface JobClassification {
  experienceLevel: ExperienceLevel | null
  employmentType: EmploymentType | null
  workMode: WorkMode | null
}
