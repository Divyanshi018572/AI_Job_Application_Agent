import { type NextRequest, NextResponse } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"]
const PUBLIC_PREFIXES = ["/auth/", "/api/auth/"]

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    isAuthPath(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  )
}

export async function proxy(request: NextRequest) {
  const { response, user, authUnavailable } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (user && isAuthPath(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (!user && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (!user && !isPublicPath(pathname) && pathname.startsWith("/api/")) {
    // Still refused either way; a 503 just stops a logged-in user being
    // told they're unauthorized when Supabase was briefly unreachable.
    return authUnavailable
      ? NextResponse.json(
          { error: "Couldn't verify your session. Please try again." },
          { status: 503 }
        )
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
