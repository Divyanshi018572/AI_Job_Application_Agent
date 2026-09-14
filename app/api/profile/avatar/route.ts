import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/session"
import {
  ALLOWED_AVATAR_TYPES,
  detectFileType,
  isAllowedType,
} from "@/lib/security/file-validation"

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
}

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

  // Never trust the client-supplied content type — sniff the real type from
  // the file's magic bytes and reject anything that isn't an actual image.
  // (See SECURITY.md Section 3 — this closes the stored-XSS risk where a
  // malicious SVG/HTML file could previously be uploaded with a spoofed
  // "image/*" content type.)
  const detectedType = detectFileType(fileBuffer)
  if (!isAllowedType(detectedType, ALLOWED_AVATAR_TYPES)) {
    return NextResponse.json(
      {
        error:
          "Unsupported or unrecognized image format. Allowed: PNG, JPEG, GIF, WEBP.",
      },
      { status: 400 }
    )
  }

  const fileExt = EXTENSION_BY_TYPE[detectedType]
  const filePath = `${user.id}/avatar_${Date.now()}.${fileExt}`

  // Upload to the "avatars" bucket (public, folder-scoped write RLS — see
  // supabase/migrations/20260914000000_avatars_bucket_and_storage_fixes.sql).
  // This bucket and its RLS policy are now created together, so the upload
  // path's first segment (`user.id`) always matches what the policy checks.
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, fileBuffer, {
      contentType: detectedType,
      upsert: true,
    })

  if (uploadError) {
    // Surface the real failure instead of silently falling back to storing
    // a base64 copy of the image inline in the database (the previous
    // behavior — see AUDIT_AND_ROADMAP.md Flaw 1).
    return NextResponse.json(
      { error: `Avatar upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  const { data: publicUrlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath)

  const fileUrl = publicUrlData.publicUrl

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  const existingParsedData = (profile?.parsed_data ?? {}) as Record<string, unknown>
  const existingProfileData = (existingParsedData.profile ?? {}) as Record<string, unknown>
  const updatedParsedData = {
    ...existingParsedData,
    profile: {
      ...existingProfileData,
      avatarUrl: fileUrl,
    },
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      avatar_url: fileUrl,
      parsed_data: updatedParsedData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (updateError) {
    return NextResponse.json(
      { error: `Avatar uploaded but failed to save to profile: ${updateError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    url: fileUrl,
    success: true,
  })
}
