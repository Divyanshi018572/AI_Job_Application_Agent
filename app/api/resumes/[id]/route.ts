import { NextResponse } from "next/server"

import { assertResourceOwner, requireUser } from "@/lib/auth/session"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, user, error } = await requireUser()

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check existence and ownership
  const { data: resume, error: fetchError } = await supabase
    .from("resumes")
    .select("id, user_id, file_path")
    .eq("id", id)
    .single()

  if (fetchError || !resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 })
  }

  const ownershipError = assertResourceOwner(user.id, resume.user_id)
  if (ownershipError.error) {
    return NextResponse.json({ error: ownershipError.error }, { status: 403 })
  }

  // 1. Delete from storage bucket
  if (resume.file_path) {
    await supabase.storage.from("resumes").remove([resume.file_path])
  }

  // 2. Delete from database
  const { error: deleteError } = await supabase
    .from("resumes")
    .delete()
    .eq("id", id)

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete resume record" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
