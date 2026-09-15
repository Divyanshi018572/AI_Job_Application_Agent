import { describe, expect, it, vi } from "vitest"

import {
  computeBackoffDelay,
  HttpError,
  isRetryableError,
  isRetryableStatus,
  withRetry,
} from "@/lib/http/retry"

const noSleep = () => Promise.resolve()

describe("isRetryableStatus / isRetryableError", () => {
  it("treats 429 and 5xx as transient", () => {
    expect(isRetryableStatus(429)).toBe(true)
    expect(isRetryableStatus(500)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
  })

  it("treats other 4xx as permanent", () => {
    expect(isRetryableStatus(400)).toBe(false)
    expect(isRetryableStatus(401)).toBe(false)
    expect(isRetryableStatus(404)).toBe(false)
    expect(isRetryableStatus(410)).toBe(false)
  })

  it("retries network failures (fetch throws TypeError) but not ordinary errors", () => {
    expect(isRetryableError(new TypeError("fetch failed"))).toBe(true)
    expect(isRetryableError(new HttpError("overloaded", 503))).toBe(true)
    expect(isRetryableError(new HttpError("gone", 410))).toBe(false)
    expect(isRetryableError(new Error("bad json"))).toBe(false)
  })
})

describe("computeBackoffDelay", () => {
  const noJitter = () => 0

  it("doubles each attempt", () => {
    expect(computeBackoffDelay(0, { baseDelayMs: 500, random: noJitter })).toBe(500)
    expect(computeBackoffDelay(1, { baseDelayMs: 500, random: noJitter })).toBe(1000)
    expect(computeBackoffDelay(2, { baseDelayMs: 500, random: noJitter })).toBe(2000)
  })

  it("caps at maxDelayMs before jitter", () => {
    expect(
      computeBackoffDelay(10, { baseDelayMs: 500, maxDelayMs: 8000, random: noJitter })
    ).toBe(8000)
  })

  it("adds at most 25% jitter", () => {
    expect(computeBackoffDelay(0, { baseDelayMs: 1000, random: () => 0.999 })).toBeLessThanOrEqual(1250)
    expect(computeBackoffDelay(0, { baseDelayMs: 1000, random: () => 0.5 })).toBe(1125)
  })
})

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok")
    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries a transient failure and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new HttpError("overloaded", 503))
      .mockRejectedValueOnce(new HttpError("rate limited", 429))
      .mockResolvedValue("ok")

    await expect(withRetry(fn, { sleep: noSleep })).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it("does not retry a permanent failure", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError("gone", 410))
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toThrow("gone")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("gives up after `retries` retries and rethrows the last error", async () => {
    const fn = vi.fn().mockRejectedValue(new HttpError("overloaded", 503))
    await expect(withRetry(fn, { retries: 2, sleep: noSleep })).rejects.toThrow("overloaded")
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it("sleeps with growing delays between attempts", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const fn = vi.fn().mockRejectedValue(new HttpError("overloaded", 503))

    await withRetry(fn, { retries: 3, baseDelayMs: 100, sleep, random: () => 0 }).catch(() => {})

    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200, 400])
  })
})
