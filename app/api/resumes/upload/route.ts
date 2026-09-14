import { NextResponse } from "next/server"

import { parseResumeWithGemini } from "@/lib/ai/gemini"
import { requireUser } from "@/lib/auth/session"
import {
  ALLOWED_RESUME_TYPES,
  detectFileType,
  isAllowedType,
} from "@/lib/security/file-validation"
import type { Json } from "@/types/database"

function asJson(value: unknown): Json {
  return value as Json
}

const SIGNED_URL_TTL_SECONDS = 600

// Interim cost/abuse guard until Phase 4's real usage enforcement exists
// (see AUDIT_AND_ROADMAP.md Flaw 7). Each upload triggers a real Gemini (and
// possibly Groq) API call — this keeps a single user from running up an
// open-ended bill via a buggy retry loop or deliberate abuse.
const MAX_UPLOADS_PER_HOUR = 5

export async function POST(request: Request) {
  const { supabase, user, error } = await requireUser()

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentUploadCount, error: rateLimitError } = await supabase
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", oneHourAgo)

  if (!rateLimitError && (recentUploadCount ?? 0) >= MAX_UPLOADS_PER_HOUR) {
    return NextResponse.json(
      {
        error: `Upload limit reached (${MAX_UPLOADS_PER_HOUR} per hour). Please try again later.`,
      },
      { status: 429 }
    )
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

  // Never trust the client-supplied content type / extension — sniff the
  // real type from magic bytes (SECURITY.md Section 3).
  const detectedType = detectFileType(fileBuffer)
  if (!isAllowedType(detectedType, ALLOWED_RESUME_TYPES)) {
    return NextResponse.json(
      {
        error:
          "Unsupported or unrecognized file format. Allowed: PDF or plain text.",
      },
      { status: 400 }
    )
  }

  let extractedText = ""
  if (detectedType === "text/plain") {
    extractedText = fileBuffer.toString("utf-8")
  } else if (detectedType === "application/pdf") {
    // NOTE: pdf-parse v2 replaced the v1 `default(buffer) -> { text }` function
    // API with a `PDFParse` class (`new PDFParse({ data }).getText()`). The
    // previous code here still called the old function API, which no longer
    // exists on v2 — it always threw, was always silently swallowed, and
    // extractedText was always empty for PDFs. That meant every PDF upload
    // skipped the fast text path (fine, Gemini reads the PDF directly) but
    // also meant the Groq fallback could never trigger for a PDF resume,
    // since that fallback requires non-empty extractedText.
    let parser: InstanceType<typeof import("pdf-parse").PDFParse> | null = null
    try {
      const { PDFParse } = await import("pdf-parse")
      parser = new PDFParse({ data: fileBuffer })
      const textResult = await parser.getText()
      if (textResult?.text) {
        extractedText = textResult.text
      }
    } catch (e) {
      // If pdf-parse isn't available or fails, Gemini multimodal inline_data will handle it
      console.warn("pdf-parse text extraction skipped, using Gemini base64 inlineData:", e)
    } finally {
      await parser?.destroy()
    }
  }

  // 1. Upload to Supabase Storage
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
  const filePath = `${user.id}/${Date.now()}_${sanitizedFileName}`

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(filePath, fileBuffer, {
      contentType: detectedType,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  // The "resumes" bucket is private by design — generate a short-lived
  // signed URL for the immediate response only. Nothing long-lived is
  // persisted; GET /api/resumes regenerates a fresh one on every read
  // (see AUDIT_AND_ROADMAP.md Flaw 2).
  const { data: signedUrlData } = await supabase.storage
    .from("resumes")
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS)

  // 2. Parse resume with Google Gemini AI
  let parsedResume
  try {
    parsedResume = await parseResumeWithGemini(
      fileBuffer,
      detectedType,
      extractedText
    )
  } catch (parseError: unknown) {
    // Even if AI parsing fails, clean up or report descriptive error
    const message =
      parseError instanceof Error ? parseError.message : "Unknown error"
    return NextResponse.json(
      { error: `Gemini AI parsing failed: ${message}` },
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
      file_url: null,
      file_size: file.size,
      content_type: detectedType,
      parsed_data: asJson(parsedResume),
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
      skills: asJson(parsedResume.skills),
      work_experience: asJson(parsedResume.workExperience),
      education: asJson(parsedResume.education),
      projects: asJson(parsedResume.projects),
      certifications: asJson(parsedResume.certifications),
      links: asJson(parsedResume.profile.links),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (profileError) {
    console.warn("Failed to auto-update profile:", profileError.message)
  }

  return NextResponse.json(
    {
      resume: { ...resumeRow, file_url: signedUrlData?.signedUrl ?? null },
      parsed: parsedResume,
      message: "Resume uploaded and parsed successfully",
    },
    { status: 201 }
  )
}
