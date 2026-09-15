import { NextRequest, NextResponse } from "next/server"
import { describe, expect, it, vi } from "vitest"

import { proxy } from "@/proxy"

const session = vi.hoisted(() => ({
  user: null as { id: string } | null,
  authUnavailable: false,
}))

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: async () => ({ response: NextResponse.next(), ...session }),
}))

function run(path: string, state: Partial<typeof session>) {
  Object.assign(session, { user: null, authUnavailable: false, ...state })
  return proxy(new NextRequest(`http://localhost${path}`))
}

describe("proxy auth gate", () => {
  it("returns 401 for a logged-out API request", async () => {
    const res = await run("/api/jobs", {})
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
  })

  it("returns 503 (still refused) for an API request when the session couldn't be checked", async () => {
    const res = await run("/api/jobs", { authUnavailable: true })
    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/couldn't verify your session/i)
  })

  it("redirects a dashboard page to login when the session couldn't be checked (fail closed)", async () => {
    const res = await run("/dashboard/jobs", { authUnavailable: true })
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost/login?next=%2Fdashboard%2Fjobs")
  })

  it("lets a logged-in user through to the API", async () => {
    const res = await run("/api/jobs", { user: { id: "u1" } })
    expect(res.status).toBe(200)
  })

  it("keeps public auth API routes open even when the session check is down", async () => {
    const res = await run("/api/auth/login", { authUnavailable: true })
    expect(res.status).toBe(200)
  })
})
