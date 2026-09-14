import { NextResponse } from "next/server"

import { requireUser } from "@/lib/auth/session"

// Signed URLs are generated fresh on every read, not persisted. The
// "resumes" bucket is private; a stored public/signed URL goes stale or is
// simply broken (see AUDIT_AND_ROADMAP.md Flaw 2 — getPublicUrl() on a
// private bucket silently returns a URL that 400s when fetched). Ten
// minutes is enough for a UI click-through without leaving a long-lived
// link around.
const SIGNED_URL_TTL_SECONDS = 600

export async function GET() {
  const { supabase, user, error } = await requireUser()

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error: queryError } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (queryError) {
    return NextResponse.json(
      { error: "Failed to load resumes" },
      { status: 500 }
    )
  }

  const resumes = await Promise.all(
    (data ?? []).map(async (resume) => {
      if (!resume.file_path) {
        return { ...resume, file_url: null }
      }
      const { data: signedData } = await supabase.storage
        .from("resumes")
        .createSignedUrl(resume.file_path, SIGNED_URL_TTL_SECONDS)
      return { ...resume, file_url: signedData?.signedUrl ?? null }
    })
  )

  return NextResponse.json({ resumes })
}
