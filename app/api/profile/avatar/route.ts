import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"

export async function POST(request: Request) {
  const { supabase, user, error } = await requireUser()

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Invalid form data request" },
      { status: 400 }
    )
  }

  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json(
      { error: "No image file provided" },
      { status: 400 }
    )
  }

  // Validate file size (max 5MB for avatar pictures)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Image file exceeds maximum size of 5MB" },
      { status: 400 }
    )
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const fileExt = file.name.split(".").pop() || "jpg"
  const sanitizedFileName = `avatar_${Date.now()}.${fileExt}`
  const filePath = `${user.id}/${sanitizedFileName}`

  let fileUrl: string | null = null

  // 1. Try uploading to "avatars" bucket first
  const { error: avatarsUploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, fileBuffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    })

  if (!avatarsUploadError) {
    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath)
    if (publicUrlData?.publicUrl) {
      fileUrl = publicUrlData.publicUrl
    }
  } else {
    // 2. Fallback to "resumes" bucket if "avatars" bucket doesn't exist
    const { error: resumesUploadError } = await supabase.storage
      .from("resumes")
      .upload(`avatars/${filePath}`, fileBuffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      })

    if (!resumesUploadError) {
      const { data: publicUrlData } = supabase.storage
        .from("resumes")
        .getPublicUrl(`avatars/${filePath}`)
      if (publicUrlData?.publicUrl) {
        fileUrl = publicUrlData.publicUrl
      }
    }
  }

  // 3. If storage upload failed (or bucket not created yet), use data URI so it works instantly without external storage configuration
  if (!fileUrl) {
    const base64Str = fileBuffer.toString("base64")
    fileUrl = `data:${file.type || "image/jpeg"};base64,${base64Str}`
  }

  // Also update profile.avatar_url automatically in database
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const updatedParsedData = {
    ...((profile?.parsed_data as any) || {}),
    profile: {
      ...(((profile?.parsed_data as any)?.profile) || {}),
      avatarUrl: fileUrl,
    },
  }

  await supabase
    .from("profiles")
    .update({
      avatar_url: fileUrl,
      parsed_data: updatedParsedData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  return NextResponse.json({
    url: fileUrl,
    success: true,
  })
}
