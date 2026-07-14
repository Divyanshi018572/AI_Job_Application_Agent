import { NextResponse } from "next/server"

import { mapAuthErrorMessage } from "@/lib/auth/errors"
import { enforceRateLimit } from "@/lib/auth/rate-limit"
import { resendVerificationSchema } from "@/lib/auth/schemas"
import { getSiteUrl } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(
    request,
    "resend-verification",
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

  const parsed = resendVerificationSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const siteUrl = getSiteUrl()

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/login`,
    },
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
      "If an unverified account exists for this email, a new verification link has been sent.",
  })
}
