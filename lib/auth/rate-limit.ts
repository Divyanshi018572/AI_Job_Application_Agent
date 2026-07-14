type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown"
  }

  return request.headers.get("x-real-ip") ?? "unknown"
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; retryAfter?: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true }
  }

  if (bucket.count >= limit) {
    return {
      success: false,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    }
  }

  bucket.count += 1
  return { success: true }
}

export function enforceRateLimit(
  request: Request,
  action: string,
  limit = 10,
  windowMs = 15 * 60 * 1000
) {
  const ip = getClientIp(request)
  const result = rateLimit(`${action}:${ip}`, limit, windowMs)

  if (!result.success) {
    return Response.json(
      {
        error: "Too many attempts. Please try again later.",
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: result.retryAfter
          ? { "Retry-After": String(result.retryAfter) }
          : undefined,
      }
    )
  }

  return null
}
