import type { ATSPlatform } from "@/lib/ats/registry"
import { SEED_COMPANIES } from "@/lib/companies/seed-data"

export interface CuratedCompany {
  /** Canonical display name, matched case-insensitively against user input. */
  name: string
  platform: ATSPlatform
  token: string
}

/**
 * Curated company → board-token list (plan Task 2.2: "check curated token
 * list first" before falling back to search). Derived from Task 2.5's seed
 * data: only companies whose board was verified live — right company name
 * on the board and at least one open job — so a wrong token never silently
 * returns someone else's jobs.
 */
export const CURATED_COMPANIES: CuratedCompany[] = SEED_COMPANIES.flatMap((c) =>
  c.board ? [{ name: c.name, platform: c.board.platform, token: c.board.token }] : []
)
