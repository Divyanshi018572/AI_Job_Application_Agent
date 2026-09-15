import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth/session"

export async function GET() {
  const { supabase, user, error } = await requireUser()

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Only what the list renders. Descriptions average ~8.7 KB each on real
  // Greenhouse boards, so `select("*")` would send megabytes for a large
  // board that the list never displays.
  const { data, error: queryError } = await supabase
    .from("jobs")
    .select(
      "id, platform, title, company, location, experience_level, employment_type, work_mode, job_url, fetched_at, classified_at"
    )
    .eq("user_id", user.id)
    .order("fetched_at", { ascending: false })

  if (queryError) {
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 })
  }

  return NextResponse.json({ jobs: data ?? [] })
}
