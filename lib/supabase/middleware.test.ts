import { AuthRetryableFetchError } from "@supabase/supabase-js"
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { updateSession } from "@/lib/supabase/middleware"

const getUser = vi.fn()

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}))

const user = { id: "u1", email: "a@b.c" }
const request = () => new NextRequest("http://localhost/dashboard")

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x")
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe("updateSession", () => {
  it("returns the user when the session check succeeds", async () => {
    getUser.mockResolvedValue({ data: { user }, error: null })

    const result = await updateSession(request())

    expect(result).toMatchObject({ user, authUnavailable: false })
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it("returns no user (not unavailable) when nobody is logged in", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError", status: 400 } })

    const result = await updateSession(request())

    expect(result).toMatchObject({ user: null, authUnavailable: false })
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it("retries once when the connection drops mid-check ('other side closed')", async () => {
    getUser
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({ data: { user }, error: null })

    const result = await updateSession(request())

    expect(result).toMatchObject({ user, authUnavailable: false })
    expect(getUser).toHaveBeenCalledTimes(2)
  })

  it("retries once on a retryable auth fetch error", async () => {
    getUser
      .mockResolvedValueOnce({ data: { user: null }, error: new AuthRetryableFetchError("fetch failed", 0) })
      .mockResolvedValueOnce({ data: { user }, error: null })

    expect(await updateSession(request())).toMatchObject({ user, authUnavailable: false })
  })

  it("fails closed — no user, flagged unavailable — when the retry also fails", async () => {
    getUser.mockRejectedValue(new TypeError("fetch failed"))

    const result = await updateSession(request())

    expect(result).toMatchObject({ user: null, authUnavailable: true })
    expect(getUser).toHaveBeenCalledTimes(2)
  })

  it("fails closed when Supabase keeps answering with a retryable error", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError("fetch failed", 0) })

    expect(await updateSession(request())).toMatchObject({ user: null, authUnavailable: true })
  })
})
