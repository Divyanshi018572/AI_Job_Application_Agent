import { NextResponse } from "next/server"

import { mapAuthErrorMessage } from "@/lib/auth/errors"
import { enforceRateLimit } from "@/lib/auth/rate-limit"
import { resetPasswordSchema } from "@/lib/auth/schemas"
import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(
    request,
    "reset-password",
    5,
    60 * 60 * 1000
  )
  if (rateLimited) return rateLimited

  const { user, error: authError } = await requireUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = resetPasswordSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return NextResponse.json(
      { error: mapAuthErrorMessage(error) },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    message: "Password updated successfully.",
  })
}
