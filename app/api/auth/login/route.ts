import { NextResponse } from "next/server"

import { mapAuthErrorMessage } from "@/lib/auth/errors"
import { enforceRateLimit } from "@/lib/auth/rate-limit"
import { loginSchema } from "@/lib/auth/schemas"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, "login", 10, 15 * 60 * 1000)
  if (rateLimited) return rateLimited

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { email, password } = parsed.data

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return NextResponse.json(
      { error: mapAuthErrorMessage(error) },
      { status: 401 }
    )
  }

  if (data.user && !data.user.email_confirmed_at) {
    await supabase.auth.signOut()
    return NextResponse.json(
      {
        error: "Please verify your email before signing in.",
        needsVerification: true,
        email,
      },
      { status: 403 }
    )
  }

  return NextResponse.json({ success: true })
}
