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

  // Validate actual file content using magic bytes
  function detectImageType(buffer: Buffer): { ext: string; mimeType: string } | null {
    if (buffer.length < 12) return null

    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return { ext: "png", mimeType: "image/png" }
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return { ext: "jpg", mimeType: "image/jpeg" }
    }

    // GIF: 47 49 46 38 (GIF8)
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return { ext: "gif", mimeType: "image/gif" }
    }

    // WEBP: RIFF ... WEBP (bytes 0-3: RIFF, bytes 8-11: WEBP)
    if (buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return { ext: "webp", mimeType: "image/webp" }
    }

    return null
  }

  const detectedType = detectImageType(fileBuffer)
  if (!detectedType) {
    return NextResponse.json(
      { error: "Invalid image file. Only PNG, JPEG, GIF, and WEBP images are allowed." },
      { status: 400 }
    )
  }

  const sanitizedFileName = `avatar_${Date.now()}.${detectedType.ext}`
  const filePath = `${user.id}/${sanitizedFileName}`

  let fileUrl: string | null = null

  // 1. Try uploading to "avatars" bucket first
  const { error: avatarsUploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, fileBuffer, {
      contentType: detectedType.mimeType,
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
        contentType: detectedType.mimeType,
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

  // 3. If both storage attempts failed, return error
  if (!fileUrl) {
    console.error("Avatar upload failed: both avatars and resumes buckets unavailable")
    return NextResponse.json(
      { error: "Failed to upload avatar. Storage service is unavailable." },
      { status: 500 }
    )
  }

  // Also update profile.avatar_url automatically in database
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: fileUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (updateError) {
    console.error("Failed to update profile avatar_url:", updateError)
    return NextResponse.json(
      { error: "Failed to update profile with new avatar URL." },
      { status: 500 }
    )
  }

  return NextResponse.json({
    url: fileUrl,
    success: true,
  })
}
