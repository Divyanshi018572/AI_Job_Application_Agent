import { describe, expect, it } from "vitest"

import { mapWithConcurrency } from "@/lib/jobs/concurrency"

describe("mapWithConcurrency", () => {
  it("maps every item and preserves result order regardless of completion order", async () => {
    const items = [30, 10, 20]
    const result = await mapWithConcurrency(items, 3, async (n) => {
      await new Promise((r) => setTimeout(r, n))
      return n * 2
    })
    expect(result).toEqual([60, 20, 40])
  })

  it("never runs more than `limit` calls concurrently", async () => {
    let active = 0
    let maxActive = 0

    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
    })

    expect(maxActive).toBeLessThanOrEqual(2)
  })

  it("handles an empty array without hanging", async () => {
    const result = await mapWithConcurrency([], 5, async (n: number) => n)
    expect(result).toEqual([])
  })

  it("handles a limit larger than the item count", async () => {
    const result = await mapWithConcurrency([1, 2], 10, async (n) => n + 1)
    expect(result).toEqual([2, 3])
  })

  it("propagates a rejection from fn", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom")
        return n
      })
    ).rejects.toThrow("boom")
  })
})
