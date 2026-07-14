import { NextResponse } from "next/server"

import { assertResourceOwner, requireUser } from "@/lib/auth/session"

export async function GET() {
  const { supabase, user, error } = await requireUser()

  if (error || !user) {
    return NextResponse.json({ error }, { status: 401 })
  }

  const { data, error: queryError } = await supabase
    .from("job_applications")
    .select("id, job_title, company, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (queryError) {
    return NextResponse.json(
      { error: "Failed to load applications" },
      { status: 500 }
    )
  }

  return NextResponse.json({ applications: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, user, error } = await requireUser()

  if (error || !user) {
    return NextResponse.json({ error }, { status: 401 })
  }

  let body: { job_title?: string; company?: string; notes?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const jobTitle = body.job_title?.trim()

  if (!jobTitle) {
    return NextResponse.json({ error: "Job title is required" }, { status: 400 })
  }

  const { data, error: insertError } = await supabase
    .from("job_applications")
    .insert({
      user_id: user.id,
      job_title: jobTitle,
      company: body.company?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .select("id, user_id, job_title, company, status, created_at")
    .single()

  if (insertError || !data) {
    return NextResponse.json(
      { error: "Failed to create application" },
      { status: 500 }
    )
  }

  const ownershipError = assertResourceOwner(user.id, data.user_id)
  if (ownershipError.error) {
    return NextResponse.json({ error: ownershipError.error }, { status: 403 })
  }

  return NextResponse.json({ application: data }, { status: 201 })
}
