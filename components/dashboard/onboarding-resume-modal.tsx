"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  UploadCloud,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function OnboardingResumeModal() {
  const router = useRouter()
  const [isOpen, setIsOpen] = React.useState(false)
  const [isLoadingCheck, setIsLoadingCheck] = React.useState(true)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [uploadStatus, setUploadStatus] = React.useState<
    "idle" | "uploading" | "parsing" | "success" | "error"
  >("idle")
  const [statusMessage, setStatusMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")

  React.useEffect(() => {
    let mounted = true
    async function checkOnboardingStatus() {
      try {
        const [profileRes, resumesRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/resumes"),
        ])
        if (!profileRes.ok) return
        const profileData = await profileRes.json()
        let hasResumes = false
        if (resumesRes.ok) {
          const resumesData = await resumesRes.json()
          hasResumes = Array.isArray(resumesData.resumes) && resumesData.resumes.length > 0
        }
        if (mounted && profileData.profile) {
          const p = profileData.profile
          const hasProfileInfo =
            Boolean(p.summary) ||
            (Array.isArray(p.skills) && p.skills.length > 0) ||
            (Array.isArray(p.work_experience) && p.work_experience.length > 0)

          if (!p.onboarding_completed && (!hasResumes || !hasProfileInfo)) {
            setIsOpen(true)
          }
        }
      } catch (err) {
        console.error("Failed to check onboarding status:", err)
      } finally {
        if (mounted) {
          setIsLoadingCheck(false)
        }
      }
    }
    checkOnboardingStatus()
    return () => {
      mounted = false
    }
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) validateAndSelectFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) validateAndSelectFile(file)
  }

  const validateAndSelectFile = (file: File) => {
    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]
    const validExtensions = [".pdf", ".docx", ".txt"]
    const hasValidExt = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    )

    if (!validTypes.includes(file.type) && !hasValidExt) {
      setErrorMessage("Please upload a PDF, DOCX, or TXT resume file.")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File exceeds the maximum size of 10MB.")
      return
    }

    setErrorMessage("")
    setSelectedFile(file)
  }

  const handleUploadAndParse = async () => {
    if (!selectedFile) return

    setUploadStatus("uploading")
    setStatusMessage("Uploading resume to Supabase Storage...")
    setErrorMessage("")

    const formData = new FormData()
    formData.append("file", selectedFile)

    try {
      setUploadStatus("parsing")
      setStatusMessage(
        "Analyzing resume & extracting skills, work experience, and education with Google Gemini AI..."
      )

      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData,
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || "Failed to parse resume")
      }

      setUploadStatus("success")
      setStatusMessage("Resume parsed successfully! Populating your profile...")

      setTimeout(() => {
        setIsOpen(false)
        router.push("/dashboard/profile")
        router.refresh()
      }, 1500)
    } catch (err: any) {
      setUploadStatus("error")
      setErrorMessage(err.message || "An unexpected error occurred.")
    }
  }

  if (isLoadingCheck || !isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#181d3e] via-[#11162e] to-[#0a0d1e] p-7 text-white shadow-2xl">
        {/* Glow Effects */}
        <div className="pointer-events-none absolute -top-24 -left-24 size-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-64 rounded-full bg-fuchsia-500/15 blur-3xl" />

        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="size-6 animate-pulse" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-indigo-300 uppercase">
                Required Onboarding Step
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Upload Your Resume
              </h2>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-white/70">
            Welcome to <strong className="text-white">JobHunter AI</strong>! Before continuing to your dashboard, please upload your latest resume. Our Google Gemini AI engine will parse your experience, skills, and education to automatically set up your complete profile.
          </p>

          {/* Upload Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200",
              isDragging
                ? "border-indigo-400 bg-indigo-500/10"
                : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10"
            )}
          >
            <input
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleFileChange}
              disabled={
                uploadStatus === "uploading" || uploadStatus === "parsing"
              }
              className="absolute inset-0 z-10 cursor-pointer opacity-0"
            />

            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300 transition-transform group-hover:scale-110">
              <UploadCloud className="size-7" />
            </div>

            {selectedFile ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-indigo-200">
                <FileText className="size-4 text-indigo-400" />
                <span className="max-w-[240px] truncate">
                  {selectedFile.name}
                </span>
                <span className="text-xs text-white/50">
                  ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            ) : (
              <div className="mt-4 space-y-1">
                <p className="text-sm font-medium text-white">
                  Drag and drop your resume here, or{" "}
                  <span className="text-indigo-400 underline">browse files</span>
                </p>
                <p className="text-xs text-white/50">
                  Supported formats: PDF, DOCX, TXT (up to 10MB)
                </p>
              </div>
            )}
          </div>

          {/* Status / Progress Indicator */}
          {uploadStatus !== "idle" && uploadStatus !== "error" && (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 text-sm">
              {uploadStatus === "success" ? (
                <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
              ) : (
                <Loader2 className="size-5 shrink-0 animate-spin text-indigo-400" />
              )}
              <span
                className={cn(
                  "font-medium",
                  uploadStatus === "success"
                    ? "text-emerald-300"
                    : "text-indigo-200"
                )}
              >
                {statusMessage}
              </span>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm font-medium text-red-300">
              {errorMessage}
            </div>
          )}

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleUploadAndParse}
              disabled={
                !selectedFile ||
                uploadStatus === "uploading" ||
                uploadStatus === "parsing" ||
                uploadStatus === "success"
              }
              className="h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-fuchsia-600 disabled:opacity-50"
            >
              {uploadStatus === "uploading" || uploadStatus === "parsing" ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Processing Resume...
                </>
              ) : (
                "Upload & Continue"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
