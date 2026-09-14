import { describe, expect, it } from "vitest"

import { assertResourceOwner } from "@/lib/auth/session"

describe("assertResourceOwner", () => {
  it("allows access when the requesting user owns the resource", () => {
    expect(assertResourceOwner("user-1", "user-1")).toEqual({ error: null })
  })

  it("denies access when the resource belongs to a different user", () => {
    // This is the exact check that stands between a leaked-by-accident
    // route and a real cross-tenant data leak (AUDIT_AND_ROADMAP.md
    // Section 4 / SECURITY.md Section 8). It must never pass for mismatched
    // ids, including near-miss/whitespace-padded ids.
    expect(assertResourceOwner("user-1", "user-2")).toEqual({
      error: "Forbidden",
    })
    expect(assertResourceOwner("user-1", "user-1 ")).toEqual({
      error: "Forbidden",
    })
  })
})
