import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth/session"

export async function GET() {
  const { supabase, user, error } = await requireUser()

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile, error: queryError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (queryError) {
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    )
  }

  const { data: latestResume } = await supabase
    .from("resumes")
    .select("parsed_data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    profile: {
      ...profile,
      parsed_data: latestResume?.parsed_data || null,
    },
  })
}

export async function PATCH(request: Request) {
  const { supabase, user, error } = await requireUser()

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const allowedFields = [
    "full_name",
    "phone",
    "location",
    "summary",
    "skills",
    "work_experience",
    "education",
    "projects",
    "certifications",
    "links",
    "onboarding_completed",
  ]

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (body.parsedData) {
    if (body.parsedData.profile) {
      if (body.parsedData.profile.fullName !== undefined) updateData.full_name = body.parsedData.profile.fullName
      if (body.parsedData.profile.phone !== undefined) updateData.phone = body.parsedData.profile.phone
      if (body.parsedData.profile.location !== undefined) updateData.location = body.parsedData.profile.location
      if (body.parsedData.profile.links !== undefined) updateData.links = body.parsedData.profile.links
    }
    if (body.parsedData.summary !== undefined) updateData.summary = body.parsedData.summary
    if (body.parsedData.skills !== undefined) updateData.skills = body.parsedData.skills
    if (body.parsedData.workExperience !== undefined) updateData.work_experience = body.parsedData.workExperience
    if (body.parsedData.education !== undefined) updateData.education = body.parsedData.education
    if (body.parsedData.projects !== undefined) updateData.projects = body.parsedData.projects
    if (body.parsedData.certifications !== undefined) updateData.certifications = body.parsedData.certifications
  }

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field]
    }
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", user.id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update profile: ${updateError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ profile: updatedProfile })
}
