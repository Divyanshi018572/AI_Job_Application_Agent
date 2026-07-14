import { NextResponse } from "next/server"

import { mapAuthErrorMessage } from "@/lib/auth/errors"
import { enforceRateLimit } from "@/lib/auth/rate-limit"
import { signupSchema } from "@/lib/auth/schemas"
import { getSiteUrl } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, "signup", 5, 60 * 60 * 1000)
  if (rateLimited) return rateLimited

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = signupSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const { email, password, fullName } = parsed.data
  const supabase = await createClient()
  const siteUrl = getSiteUrl()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/login`,
    },
  })

  if (error) {
    return NextResponse.json(
      { error: mapAuthErrorMessage(error) },
      { status: 400 }
    )
  }

  if (data.user?.identities?.length === 0) {
    return NextResponse.json(
      {
        error:
          "An account with this email already exists. Try signing in or use Google if you registered that way.",
      },
      { status: 409 }
    )
  }

  return NextResponse.json({
    success: true,
    message:
      "Account created. Check your email for a verification link before signing in.",
  })
}
