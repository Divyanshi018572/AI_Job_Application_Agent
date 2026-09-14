import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth/session"

export async function GET() {
  const { supabase, user, error } = await requireUser()

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error: queryError } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", user.id)
    .order("fetched_at", { ascending: false })

  if (queryError) {
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 })
  }

  return NextResponse.json({ jobs: data ?? [] })
}
