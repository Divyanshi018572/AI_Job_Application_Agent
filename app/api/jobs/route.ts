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
  // curated:companies(...) follows jobs.company_id to the curated company
  // (Task 2.5) for its size/tier tag; null when the board isn't curated.
  const { data, error: queryError } = await supabase
    .from("jobs")
    .select(
      "id, platform, title, company, location, experience_level, employment_type, work_mode, job_url, fetched_at, classified_at, curated:companies(company_type)"
    )
    .eq("user_id", user.id)
    .order("fetched_at", { ascending: false })

  if (queryError) {
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 })
  }

  const jobs = (data ?? []).map(({ curated, ...job }) => {
    // PostgREST returns a many-to-one embed as a single object; the client
    // here is untyped and declares every embed as an array, so accept both.
    const company = Array.isArray(curated) ? curated[0] : curated
    return { ...job, company_type: company?.company_type ?? null }
  })

  return NextResponse.json({ jobs })
}
