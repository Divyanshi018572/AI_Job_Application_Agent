import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { CURATED_COMPANIES } from "@/lib/ats/curated-companies"
import { discoverCompanyToken } from "@/lib/ats/discovery"
import { ATS_ADAPTERS } from "@/lib/ats/registry"
import { SEED_COMPANIES } from "@/lib/companies/seed-data"
import { COMPANY_TYPES, companyTypeLabel } from "@/lib/companies/types"

const SEED_MIGRATION = path.join(
  process.cwd(),
  "supabase/migrations/20260916000000_companies_board_tokens_and_seed.sql"
)

describe("seed data integrity (Task 2.5)", () => {
  it("has the plan's ~150–200 companies", () => {
    expect(SEED_COMPANIES.length).toBeGreaterThanOrEqual(150)
    expect(SEED_COMPANIES.length).toBeLessThanOrEqual(220)
  })

  it("has no duplicate names (case-insensitive, matching the unique index)", () => {
    const names = SEED_COMPANIES.map((c) => c.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
  })

  it("has no board claimed by two companies", () => {
    const boards = SEED_COMPANIES.filter((c) => c.board).map((c) => `${c.board!.platform}:${c.board!.token}`)
    expect(new Set(boards).size).toBe(boards.length)
  })

  it("uses only known company types, or null", () => {
    for (const c of SEED_COMPANIES) {
      if (c.companyType !== null) expect(COMPANY_TYPES).toContain(c.companyType)
    }
  })

  it("uses only registered platforms and lowercase URL-safe tokens", () => {
    for (const c of SEED_COMPANIES) {
      if (!c.board) continue
      expect(Object.keys(ATS_ADAPTERS)).toContain(c.board.platform)
      expect(c.board.token).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    }
  })

  it("keeps names trimmed and non-empty", () => {
    for (const c of SEED_COMPANIES) {
      expect(c.name).toBe(c.name.trim())
      expect(c.name.length).toBeGreaterThan(0)
    }
  })

  it("matches the seed migration row for row", () => {
    const sql = readFileSync(SEED_MIGRATION, "utf8")
    const values = sql.slice(sql.indexOf("values"), sql.indexOf("on conflict"))
    const sqlValue = (v: string) => (v === "null" ? null : v.slice(1, -1).replace(/''/g, "'"))
    const rows = [...values.matchAll(/^\s*\((.*)\),?$/gm)].map((m) => {
      const [name, type, platform, token] = m[1].match(/'(?:[^']|'')*'|null/g)!.map(sqlValue)
      return { name, companyType: type, board: platform ? { platform, token } : null }
    })

    const expected = SEED_COMPANIES.map((c) => ({
      name: c.name,
      companyType: c.companyType,
      board: c.board ? { platform: c.board.platform, token: c.board.token } : null,
    }))
    expect(rows).toEqual(expected)
  })
})

describe("company type tags", () => {
  it("shows no tag for an unclassified company", () => {
    expect(companyTypeLabel(null)).toBeNull()
    expect(companyTypeLabel(undefined)).toBeNull()
    expect(companyTypeLabel("")).toBeNull()
  })

  it("shows no tag for a value outside the known set rather than echoing it", () => {
    expect(companyTypeLabel("unicorn")).toBeNull()
  })

  it("labels each known type", () => {
    expect(COMPANY_TYPES.map(companyTypeLabel)).toEqual(["FAANG-tier", "Enterprise", "Mid-size", "Startup"])
  })

  it("leaves seeded companies unclassified rather than guessing when unsure", () => {
    // The plan's rule — not every seeded company gets a tag.
    expect(SEED_COMPANIES.some((c) => c.companyType === null)).toBe(true)
  })
})

describe("curated list for discovery (Task 2.2)", () => {
  it("is exactly the seeded companies that have a verified board", () => {
    expect(CURATED_COMPANIES).toEqual(
      SEED_COMPANIES.filter((c) => c.board).map((c) => ({
        name: c.name,
        platform: c.board!.platform,
        token: c.board!.token,
      }))
    )
  })

  it("resolves a seeded company by name without searching", async () => {
    const search = { search: () => Promise.reject(new Error("should not search")) }
    const result = await discoverCompanyToken("stripe", { searchProvider: search })
    expect(result).toEqual({ status: "found_curated", platform: "greenhouse", token: "stripe" })
  })
})
