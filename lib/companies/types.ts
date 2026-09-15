/**
 * Company size/tier tags (plan Task 2.5). Values match the
 * `companies.company_type` check constraint.
 *
 * - faang-tier: Google, Meta, Apple, Amazon, Netflix, Microsoft
 * - enterprise: roughly 5,000+ employees
 * - mid-size:   roughly 500–4,999 employees
 * - startup:    under ~500 employees, privately held
 *
 * A company with no confident classification has a null type and shows no
 * tag — the plan's "unclassified company → no tag shown, not a guess".
 */
export const COMPANY_TYPES = ["faang-tier", "enterprise", "mid-size", "startup"] as const

export type CompanyType = (typeof COMPANY_TYPES)[number]

const LABELS: Record<CompanyType, string> = {
  "faang-tier": "FAANG-tier",
  enterprise: "Enterprise",
  "mid-size": "Mid-size",
  startup: "Startup",
}

export function isCompanyType(value: unknown): value is CompanyType {
  return typeof value === "string" && (COMPANY_TYPES as readonly string[]).includes(value)
}

/** Badge text for a company type, or null when there's nothing to show. */
export function companyTypeLabel(value: string | null | undefined): string | null {
  return isCompanyType(value) ? LABELS[value] : null
}
