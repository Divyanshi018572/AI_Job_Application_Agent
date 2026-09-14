import { describe, expect, it } from "vitest"

import { ATS_ADAPTERS, detectPlatform, getAdapter } from "@/lib/ats/registry"

/**
 * Contract test (plan Task 2.1: "one contract test per adapter asserting
 * it satisfies ATSAdapter"). Runs against every registered adapter
 * automatically — adding platform #2 to the registry gets this coverage
 * for free, no new test file required just to check the shape.
 */
describe("ATS adapter registry — contract", () => {
  for (const [platform, adapter] of Object.entries(ATS_ADAPTERS)) {
    it(`"${platform}" adapter implements the full ATSAdapter interface`, () => {
      expect(typeof adapter.detectPlatform).toBe("function")
      expect(typeof adapter.fetchJobs).toBe("function")
      expect(typeof adapter.submitApplication).toBe("function")
    })
  }
})

describe("getAdapter", () => {
  it("returns the registered adapter for a known platform", () => {
    expect(getAdapter("greenhouse")).toBe(ATS_ADAPTERS.greenhouse)
  })
})

describe("detectPlatform", () => {
  it("identifies a Greenhouse URL", () => {
    expect(detectPlatform("https://boards.greenhouse.io/acme/jobs/1")).toBe("greenhouse")
  })

  it("returns null for an unrecognized platform instead of throwing", () => {
    // Plan Task 5.1 (Platform Detection) is what decides what to do with an
    // unrecognized URL — the registry's job is only to say "I don't know
    // this one," not to guess or fail loudly.
    expect(detectPlatform("https://example.com/careers")).toBeNull()
  })
})
