import { createServerClient } from "@supabase/ssr"
import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env"

type SupabaseClient = ReturnType<typeof createServerClient>

/**
 * getUser() with one retry on a network failure. Seen in practice: a kept-
 * alive connection to Supabase that the other side had already closed
 * ("fetch failed … other side closed") made getUser() throw, and the whole
 * request died. A fresh attempt opens a new connection and succeeds.
 *
 * `unavailable` means the session couldn't be checked at all — distinct
 * from "checked, nobody is logged in". Callers still treat it as logged out
 * (fail closed); it only changes what error they report.
 */
async function getUserWithRetry(
  supabase: SupabaseClient
): Promise<{ user: User | null; unavailable: boolean }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error && isAuthRetryableFetchError(error)) {
        if (attempt === 2) return { user: null, unavailable: true }
        continue
      }
      return { user: data.user, unavailable: false }
    } catch (err) {
      if (attempt === 2) {
        console.warn("Session check failed after retry:", err instanceof Error ? err.message : err)
        return { user: null, unavailable: true }
      }
    }
  }
  return { user: null, unavailable: true }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          response = NextResponse.next({ request })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value)
          })
        },
      },
    }
  )

  const { user, unavailable } = await getUserWithRetry(supabase)

  return { response, user, authUnavailable: unavailable }
}
