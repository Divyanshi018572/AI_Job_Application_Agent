/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once.
 * No dependency added for this — it's ~15 lines. Used by the ingestion
 * pipeline (lib/jobs/ingest.ts) to cap simultaneous classification calls
 * per board, in the spirit of Task 2.3's rate-limiting goal (that task's
 * own concurrency control is about ATS fetch calls; this is the same
 * principle applied to classification calls, which are just as capable of
 * running up a bill or hitting a rate limit if fired unbounded across a
 * 50-job board).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++
      results[current] = await fn(items[current], current)
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length))
  await Promise.all(Array.from({ length: workerCount }, worker))

  return results
}
