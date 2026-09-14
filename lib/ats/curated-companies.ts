import type { ATSPlatform } from "@/lib/ats/registry"

export interface CuratedCompany {
  /** Canonical display name, matched case-insensitively against user input. */
  name: string
  platform: ATSPlatform
  token: string
}

/**
 * Curated company → board-token list (plan Task 2.2: "check curated token
 * list first" before falling back to search). Task 2.5 (Company Metadata
 * Table) is where this gets seeded with ~150-200 verified real companies
 * and moved to a real database table — deliberately left empty here rather
 * than filled with unverified guesses at real companies' board tokens,
 * which would be worse than no data (a wrong token silently returns
 * someone else's jobs or a 404, not a helpful fallback).
 *
 * discoverCompanyToken() takes this as an injectable parameter specifically
 * so Task 2.5's real (likely DB-backed) list can be passed in later without
 * changing discovery logic at all.
 */
export const CURATED_COMPANIES: CuratedCompany[] = []
