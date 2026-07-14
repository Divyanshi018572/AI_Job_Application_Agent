import { NextResponse } from "next/server"

import { mapAuthErrorMessage } from "@/lib/auth/errors"
import { enforceRateLimit } from "@/lib/auth/rate-limit"
import { forgotPasswordSchema } from "@/lib/auth/schemas"
import { getSiteUrl } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(
    request,
    "forgot-password",
    3,
    60 * 60 * 1000
  )
  if (rateLimited) return rateLimited

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = forgotPasswordSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const siteUrl = getSiteUrl()

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  })

  if (error) {
    return NextResponse.json(
      { error: mapAuthErrorMessage(error) },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    message:
      "If an account exists for this email, a password reset link has been sent.",
  })
}
