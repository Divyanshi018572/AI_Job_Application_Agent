"use client"

import * as React from "react"
import {
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ResumeListView() {
  const [resumes, setResumes] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [uploadMessage, setUploadMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")

  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const fetchResumes = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/resumes")
      if (!res.ok) throw new Error("Failed to fetch resumes")
      const data = await res.json()
      setResumes(data.resumes || [])
    } catch (err: any) {
      setErrorMessage(err.message || "Error loading resumes")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchResumes()
  }, [fetchResumes])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resume?")) return

    try {
      const res = await fetch(`/api/resumes/${id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        throw new Error("Failed to delete resume")
      }

      setResumes((prev) => prev.filter((item) => item.id !== id))
    } catch (err: any) {
      alert(err.message || "Could not delete resume")
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setErrorMessage("")
    setUploadMessage(
      "Uploading and analyzing with Google Gemini AI..."
    )

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload resume")
      }

      setUploadMessage("Resume uploaded and parsed successfully!")
      setTimeout(() => setUploadMessage(""), 3000)

      await fetchResumes()
    } catch (err: any) {
      setErrorMessage(err.message || "Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Upload New Resume Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-[#181d3e] to-[#11162e] p-6 text-white shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
            <Sparkles className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Resume Management</h2>
            <p className="text-xs text-white/60">
              Upload new or updated resumes. Gemini AI will automatically parse and update your profile.
            </p>
          </div>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-fuchsia-600"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 size-4" />
                Upload New Resume
              </>
            )}
          </Button>
        </div>
      </div>

      {uploadMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
          {uploadMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400">
          {errorMessage}
        </div>
      )}

      {/* Resumes List Table / Cards */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Uploaded Resumes ({resumes.length})
        </h3>

        {resumes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm dark:border-white/10 dark:bg-[#11162e]">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
              <FileText className="size-7" />
            </div>
            <p className="text-base font-medium text-slate-800 dark:text-white">
              No resumes uploaded yet
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-white/50">
              Upload a resume to automatically parse your skills, experience, and profile details.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {resumes.map((resume) => {
              const parsed = resume.parsed_data || {}
              const skillsCount = Array.isArray(parsed.skills)
                ? parsed.skills.length
                : 0
              const expCount = Array.isArray(parsed.workExperience)
                ? parsed.workExperience.length
                : 0

              const formattedDate = new Date(
                resume.created_at
              ).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })

              return (
                <div
                  key={resume.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md md:flex-row md:items-center dark:border-white/10 dark:bg-[#11162e]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-300">
                      <FileText className="size-6" />
                    </div>

                    <div>
                      <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                        {resume.file_name}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-white/60">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3.5" />
                          {formattedDate}
                        </span>
                        <span>•</span>
                        <span>
                          {(resume.file_size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>

                      {/* Extracted preview tags */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
                          {skillsCount} Skills Parsed
                        </span>
                        <span className="rounded-lg bg-fuchsia-500/10 px-2.5 py-1 text-xs font-medium text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-200">
                          {expCount} Work Experiences Parsed
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end md:self-center">
                    {resume.file_url ? (
                      <a
                        href={resume.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl font-medium"
                        >
                          <Download className="mr-1.5 size-4" />
                          View File
                        </Button>
                      </a>
                    ) : null}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(resume.id)}
                      className="rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-500"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
