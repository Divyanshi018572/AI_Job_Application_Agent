import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  if (error) {
    const loginUrl = new URL("/login", origin)

    if (errorDescription?.toLowerCase().includes("identity")) {
      loginUrl.searchParams.set(
        "error",
        "This email is already registered. Sign in with your original method first, then link Google from your account settings."
      )
    } else {
      loginUrl.searchParams.set(
        "error",
        "Google sign-in failed. Please try again."
      )
    }

    return NextResponse.redirect(loginUrl)
  }

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`
  )
}
