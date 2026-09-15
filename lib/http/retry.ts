/**
 * An error carrying the HTTP status of a failed upstream call, so retry
 * logic can tell a transient failure (429, 5xx) from a permanent one (404,
 * 410) without parsing error message strings.
 */
export class HttpError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "HttpError"
    this.status = status
  }
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

/**
 * Transient = worth retrying: a 429/5xx from upstream, or a network-level
 * failure (fetch throws TypeError on DNS/connection errors). Everything
 * else — 4xx, parse errors, bugs — fails fast.
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof HttpError) return isRetryableStatus(err.status)
  return err instanceof TypeError
}

export interface RetryOptions {
  /** Retries after the first attempt. Default 3 (so up to 4 attempts). */
  retries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (err: unknown) => boolean
  /** Injectable for tests, so they don't wait on real timers. */
  sleep?: (ms: number) => Promise<void>
  /** Injectable for tests; returns [0, 1). */
  random?: () => number
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Exponential backoff with a cap and up to 25% added jitter:
 * attempt 0 -> base, 1 -> 2x base, 2 -> 4x base, ... never above maxDelayMs
 * before jitter. Jitter spreads out retries from concurrent callers (e.g.
 * three classification workers all hitting the same 503) so they don't
 * retry in lockstep. Exported so the timing itself is testable (plan Task
 * 2.3: "backoff timing calculation").
 */
export function computeBackoffDelay(
  attempt: number,
  options: { baseDelayMs?: number; maxDelayMs?: number; random?: () => number } = {}
): number {
  const base = options.baseDelayMs ?? 500
  const max = options.maxDelayMs ?? 8000
  const random = options.random ?? Math.random
  const exponential = Math.min(max, base * 2 ** attempt)
  return Math.round(exponential + exponential * 0.25 * random())
}

/**
 * Runs `fn`, retrying with exponential backoff while failures are
 * transient (plan Task 2.3: "exponential backoff on 429/5xx"). Permanent
 * failures are rethrown immediately; the last transient failure is
 * rethrown once retries run out.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retries = options.retries ?? 3
  const shouldRetry = options.shouldRetry ?? isRetryableError
  const sleep = options.sleep ?? defaultSleep

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err
      await sleep(computeBackoffDelay(attempt, options))
    }
  }
}
