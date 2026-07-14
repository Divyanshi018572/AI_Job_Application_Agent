import { NextResponse } from "next/server"

import { parseResumeWithGemini } from "@/lib/ai/gemini"
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
      { error: "No resume file provided" },
      { status: 400 }
    )
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File exceeds maximum size of 10MB" },
      { status: 400 }
    )
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  let extractedText = ""

  // Attempt lightweight text extraction for plain text files or pdf fallback
  if (file.type === "text/plain" || file.name.endsWith(".txt")) {
    extractedText = fileBuffer.toString("utf-8")
  } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    try {
      const pdfParse = (await import("pdf-parse")).default
      const pdfData = await pdfParse(fileBuffer)
      if (pdfData?.text) {
        extractedText = pdfData.text
      }
    } catch (e) {
      // If pdf-parse isn't available or fails, Gemini multimodal inline_data will handle it
      console.warn("pdf-parse text extraction skipped, using Gemini base64 inlineData:", e)
    }
  }

  // 1. Upload to Supabase Storage
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
  const filePath = `${user.id}/${Date.now()}_${sanitizedFileName}`

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(filePath, fileBuffer, {
      contentType: file.type || "application/pdf",
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  let fileUrl = null
  const { data: publicUrlData } = supabase.storage
    .from("resumes")
    .getPublicUrl(filePath)
  if (publicUrlData?.publicUrl) {
    fileUrl = publicUrlData.publicUrl
  }

  // 2. Parse resume with Google Gemini AI
  let parsedResume
  try {
    parsedResume = await parseResumeWithGemini(
      fileBuffer,
      file.type || "application/pdf",
      extractedText
    )
  } catch (parseError: any) {
    // Even if AI parsing fails, clean up or report descriptive error
    return NextResponse.json(
      {
        error: `Gemini AI parsing failed: ${
          parseError?.message || "Unknown error"
        }`,
      },
      { status: 502 }
    )
  }

  // 3. Save resume record in resumes table
  const { data: resumeRow, error: insertError } = await supabase
    .from("resumes")
    .insert({
      user_id: user.id,
      file_name: file.name,
      file_path: filePath,
      file_url: fileUrl,
      file_size: file.size,
      content_type: file.type || "application/pdf",
      parsed_data: parsedResume as any,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json(
      { error: `Failed to save resume record: ${insertError.message}` },
      { status: 500 }
    )
  }

  // 4. Populate user profile with parsed resume data and mark onboarding completed
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: true,
      full_name: parsedResume.profile.fullName || undefined,
      phone: parsedResume.profile.phone || null,
      location: parsedResume.profile.location || null,
      summary: parsedResume.summary || null,
      skills: parsedResume.skills as any,
      work_experience: parsedResume.workExperience as any,
      education: parsedResume.education as any,
      projects: parsedResume.projects as any,
      certifications: parsedResume.certifications as any,
      links: parsedResume.profile.links as any,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (profileError) {
    console.warn("Failed to auto-update profile:", profileError.message)
  }

  return NextResponse.json(
    {
      resume: resumeRow,
      parsed: parsedResume,
      message: "Resume uploaded and parsed successfully",
    },
    { status: 201 }
  )
}
