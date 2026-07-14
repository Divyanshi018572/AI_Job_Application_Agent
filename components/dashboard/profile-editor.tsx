"use client"

import * as React from "react"
import {
  Award,
  Briefcase,
  Check,
  FolderGit2,
  GraduationCap,
  Link as LinkIcon,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type {
  CertificationItem,
  EducationItem,
  ParsedResume,
  ProjectItem,
  WorkExperienceItem,
} from "@/types/resume"

const INITIAL_PROFILE: ParsedResume = {
  profile: {
    fullName: "",
    email: "",
    phone: "",
    location: "",
    links: {
      linkedin: "",
      github: "",
      portfolio: "",
      twitter: "",
      other: "",
    },
  },
  summary: "",
  skills: [],
  workExperience: [],
  education: [],
  projects: [],
  certifications: [],
}

export function ProfileEditor() {
  const [profileData, setProfileData] =
    React.useState<ParsedResume>(INITIAL_PROFILE)
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [isSaving, setIsSaving] = React.useState<boolean>(false)
  const [saveSuccess, setSaveSuccess] = React.useState<boolean>(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const [newSkill, setNewSkill] = React.useState<string>("")

  // Fetch profile from backend on mount
  React.useEffect(() => {
    async function fetchProfile() {
      setIsLoading(true)
      try {
        const res = await fetch("/api/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.profile) {
            const p = data.profile
            const parsed = (p.parsed_data || {}) as Partial<ParsedResume>
            setProfileData({
              profile: {
                fullName: p.full_name || parsed.profile?.fullName || "",
                email: parsed.profile?.email || "",
                phone: p.phone || parsed.profile?.phone || "",
                location: p.location || parsed.profile?.location || "",
                links: {
                  linkedin: p.links?.linkedin || parsed.profile?.links?.linkedin || "",
                  github: p.links?.github || parsed.profile?.links?.github || "",
                  portfolio: p.links?.portfolio || parsed.profile?.links?.portfolio || "",
                  twitter: p.links?.twitter || parsed.profile?.links?.twitter || "",
                  other: p.links?.other || parsed.profile?.links?.other || "",
                },
              },
              summary: p.summary || parsed.summary || "",
              skills:
                Array.isArray(p.skills) && p.skills.length > 0
                  ? p.skills
                  : Array.isArray(parsed.skills)
                  ? parsed.skills
                  : [],
              workExperience:
                Array.isArray(p.work_experience) && p.work_experience.length > 0
                  ? p.work_experience
                  : Array.isArray(parsed.workExperience)
                  ? parsed.workExperience
                  : [],
              education:
                Array.isArray(p.education) && p.education.length > 0
                  ? p.education
                  : Array.isArray(parsed.education)
                  ? parsed.education
                  : [],
              projects:
                Array.isArray(p.projects) && p.projects.length > 0
                  ? p.projects
                  : Array.isArray(parsed.projects)
                  ? parsed.projects
                  : [],
              certifications:
                Array.isArray(p.certifications) && p.certifications.length > 0
                  ? p.certifications
                  : Array.isArray(parsed.certifications)
                  ? parsed.certifications
                  : [],
            })
          }
        }
      } catch (err: any) {
        console.error("Failed to fetch profile:", err)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchProfile()
  }, [])

  async function handleSaveProfile() {
    setIsSaving(true)
    setSaveSuccess(false)
    setErrorMsg(null)

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsedData: profileData,
          full_name: profileData.profile.fullName,
          phone: profileData.profile.phone,
          location: profileData.profile.location,
          summary: profileData.summary,
          skills: profileData.skills,
          work_experience: profileData.workExperience,
          education: profileData.education,
          projects: profileData.projects,
          certifications: profileData.certifications,
          links: profileData.profile.links,
          onboarding_completed: true,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || "Failed to save profile")
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while saving.")
    } finally {
      setIsSaving(false)
    }
  }

  function handleAddSkill(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!newSkill.trim()) return
    if (!profileData.skills.includes(newSkill.trim())) {
      setProfileData({
        ...profileData,
        skills: [...profileData.skills, newSkill.trim()],
      })
    }
    setNewSkill("")
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        <p className="text-sm text-slate-400">
          Loading your profile information...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Profile Information
          </h2>
          <p className="text-sm text-slate-600">
            Review and edit your parsed resume data below.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-300">
              <Check className="h-4 w-4" /> Saved successfully
            </span>
          )}

          <Button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 shadow-sm"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* SECTION 1: Personal Details */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <User className="h-5 w-5 text-indigo-600" /> Personal Details & Links
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Full Name
            </Label>
            <Input
              value={profileData.profile?.fullName || ""}
              onChange={(e) =>
                setProfileData({
                  ...profileData,
                  profile: {
                    ...profileData.profile,
                    fullName: e.target.value,
                  },
                })
              }
              placeholder="e.g. Alex Morgan"
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Email Address
            </Label>
            <Input
              value={profileData.profile?.email || ""}
              onChange={(e) =>
                setProfileData({
                  ...profileData,
                  profile: {
                    ...profileData.profile,
                    email: e.target.value,
                  },
                })
              }
              placeholder="e.g. alex.morgan@example.com"
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Phone Number
            </Label>
            <Input
              value={profileData.profile?.phone || ""}
              onChange={(e) =>
                setProfileData({
                  ...profileData,
                  profile: {
                    ...profileData.profile,
                    phone: e.target.value,
                  },
                })
              }
              placeholder="e.g. +1 (555) 019-2834"
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              Location
            </Label>
            <Input
              value={profileData.profile?.location || ""}
              onChange={(e) =>
                setProfileData({
                  ...profileData,
                  profile: {
                    ...profileData.profile,
                    location: e.target.value,
                  },
                })
              }
              placeholder="e.g. San Francisco, CA"
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              LinkedIn URL
            </Label>
            <Input
              value={profileData.profile?.links?.linkedin || ""}
              onChange={(e) =>
                setProfileData({
                  ...profileData,
                  profile: {
                    ...profileData.profile,
                    links: {
                      ...profileData.profile?.links,
                      linkedin: e.target.value,
                    },
                  },
                })
              }
              placeholder="https://linkedin.com/in/..."
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">
              GitHub URL
            </Label>
            <Input
              value={profileData.profile?.links?.github || ""}
              onChange={(e) =>
                setProfileData({
                  ...profileData,
                  profile: {
                    ...profileData.profile,
                    links: {
                      ...profileData.profile?.links,
                      github: e.target.value,
                    },
                  },
                })
              }
              placeholder="https://github.com/..."
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Executive Summary */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Award className="h-5 w-5 text-indigo-600" /> Professional Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={profileData.summary || ""}
            onChange={(e) =>
              setProfileData({
                ...profileData,
                summary: e.target.value,
              })
            }
            rows={5}
            placeholder="Summarize your career journey, primary strengths, and domain achievements..."
            className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 leading-relaxed"
          />
        </CardContent>
      </Card>

      {/* SECTION 3: Core Skills */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Sparkles className="h-5 w-5 text-indigo-600" /> Core Skills
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddSkill} className="flex gap-2">
            <Input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add a skill..."
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add
            </Button>
          </form>

          <div className="flex flex-wrap gap-2 pt-2">
            {profileData.skills.length === 0 ? (
              <p className="text-xs text-slate-500">No skills added yet.</p>
            ) : (
              profileData.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() =>
                      setProfileData({
                        ...profileData,
                        skills: profileData.skills.filter((_, i) => i !== idx),
                      })
                    }
                    className="text-indigo-500 hover:text-red-500 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* SECTION 4: Work Experience */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Briefcase className="h-5 w-5 text-indigo-600" /> Work Experience
          </CardTitle>
          <Button
            onClick={() => {
              const newItem: WorkExperienceItem = {
                id: `exp-${Date.now()}`,
                company: "",
                title: "",
                duration: "",
                location: "",
                responsibilities: [""],
              }
              setProfileData({
                ...profileData,
                workExperience: [newItem, ...(profileData.workExperience || [])],
              })
            }}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Experience
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {(profileData.workExperience || []).map((exp, expIdx) => (
            <div
              key={exp.id || expIdx}
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-600">
                  Role #{expIdx + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const updated = profileData.workExperience.filter(
                      (_, i) => i !== expIdx
                    )
                    setProfileData({
                      ...profileData,
                      workExperience: updated,
                    })
                  }}
                  className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Job Title</Label>
                  <Input
                    value={exp.title}
                    onChange={(e) => {
                      const updated = [...profileData.workExperience]
                      updated[expIdx].title = e.target.value
                      setProfileData({
                        ...profileData,
                        workExperience: updated,
                      })
                    }}
                    className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Company Name</Label>
                  <Input
                    value={exp.company}
                    onChange={(e) => {
                      const updated = [...profileData.workExperience]
                      updated[expIdx].company = e.target.value
                      setProfileData({
                        ...profileData,
                        workExperience: updated,
                      })
                    }}
                    className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Duration</Label>
                  <Input
                    value={exp.duration || ""}
                    onChange={(e) => {
                      const updated = [...profileData.workExperience]
                      updated[expIdx].duration = e.target.value
                      setProfileData({
                        ...profileData,
                        workExperience: updated,
                      })
                    }}
                    className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Responsibilities (one per line)
                </Label>
                <Textarea
                  value={exp.responsibilities.join("\n")}
                  onChange={(e) => {
                    const updated = [...profileData.workExperience]
                    updated[expIdx].responsibilities = e.target.value
                      .split("\n")
                      .filter(Boolean)
                    setProfileData({
                      ...profileData,
                      workExperience: updated,
                    })
                  }}
                  rows={3}
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SECTION 5: Education */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <GraduationCap className="h-5 w-5 text-indigo-600" /> Education History
          </CardTitle>
          <Button
            onClick={() => {
              const newItem: EducationItem = {
                id: `edu-${Date.now()}`,
                institution: "",
                degree: "",
                field: "",
                duration: "",
              }
              setProfileData({
                ...profileData,
                education: [newItem, ...(profileData.education || [])],
              })
            }}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Education
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {(profileData.education || []).map((edu, eduIdx) => (
            <div
              key={edu.id || eduIdx}
              className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-4"
            >
              <div>
                <Label className="text-xs font-semibold text-slate-700">Institution</Label>
                <Input
                  value={edu.institution}
                  onChange={(e) => {
                    const updated = [...profileData.education]
                    updated[eduIdx].institution = e.target.value
                    setProfileData({
                      ...profileData,
                      education: updated,
                    })
                  }}
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Degree</Label>
                <Input
                  value={edu.degree}
                  onChange={(e) => {
                    const updated = [...profileData.education]
                    updated[eduIdx].degree = e.target.value
                    setProfileData({
                      ...profileData,
                      education: updated,
                    })
                  }}
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Field of Study</Label>
                <Input
                  value={edu.field || ""}
                  onChange={(e) => {
                    const updated = [...profileData.education]
                    updated[eduIdx].field = e.target.value
                    setProfileData({
                      ...profileData,
                      education: updated,
                    })
                  }}
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs font-semibold text-slate-700">Year</Label>
                  <Input
                    value={edu.duration || ""}
                    onChange={(e) => {
                      const updated = [...profileData.education]
                      updated[eduIdx].duration = e.target.value
                      setProfileData({
                        ...profileData,
                        education: updated,
                      })
                    }}
                    className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const updated = profileData.education.filter(
                      (_, i) => i !== eduIdx
                    )
                    setProfileData({
                      ...profileData,
                      education: updated,
                    })
                  }}
                  className="h-9 w-9 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SECTION 6: Projects */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FolderGit2 className="h-5 w-5 text-indigo-600" /> Projects
          </CardTitle>
          <Button
            onClick={() => {
              const newItem: ProjectItem = {
                id: `proj-${Date.now()}`,
                name: "",
                description: "",
                url: "",
                technologies: [],
              }
              setProfileData({
                ...profileData,
                projects: [newItem, ...(profileData.projects || [])],
              })
            }}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Project
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {(profileData.projects || []).map((proj, projIdx) => (
            <div
              key={proj.id || projIdx}
              className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-600">
                  Project #{projIdx + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const updated = (profileData.projects || []).filter(
                      (_, i) => i !== projIdx
                    )
                    setProfileData({
                      ...profileData,
                      projects: updated,
                    })
                  }}
                  className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Project Name</Label>
                  <Input
                    value={proj.name}
                    onChange={(e) => {
                      const updated = [...(profileData.projects || [])]
                      updated[projIdx].name = e.target.value
                      setProfileData({
                        ...profileData,
                        projects: updated,
                      })
                    }}
                    placeholder="e.g. AI Resume Analyzer"
                    className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Project URL / Repository</Label>
                  <Input
                    value={proj.url || ""}
                    onChange={(e) => {
                      const updated = [...(profileData.projects || [])]
                      updated[projIdx].url = e.target.value
                      setProfileData({
                        ...profileData,
                        projects: updated,
                      })
                    }}
                    placeholder="https://github.com/..."
                    className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Description</Label>
                <Textarea
                  value={proj.description || ""}
                  onChange={(e) => {
                    const updated = [...(profileData.projects || [])]
                    updated[projIdx].description = e.target.value
                    setProfileData({
                      ...profileData,
                      projects: updated,
                    })
                  }}
                  rows={2}
                  placeholder="Describe key features and impact..."
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Technologies (comma separated)</Label>
                <Input
                  value={(proj.technologies || []).join(", ")}
                  onChange={(e) => {
                    const updated = [...(profileData.projects || [])]
                    updated[projIdx].technologies = e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                    setProfileData({
                      ...profileData,
                      projects: updated,
                    })
                  }}
                  placeholder="React, Next.js, TypeScript, Supabase"
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* SECTION 7: Certifications */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Award className="h-5 w-5 text-indigo-600" /> Certifications & Licenses
          </CardTitle>
          <Button
            onClick={() => {
              const newItem: CertificationItem = {
                id: `cert-${Date.now()}`,
                name: "",
                issuer: "",
                date: "",
                url: "",
              }
              setProfileData({
                ...profileData,
                certifications: [newItem, ...(profileData.certifications || [])],
              })
            }}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Certification
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {(profileData.certifications || []).map((cert, certIdx) => (
            <div
              key={cert.id || certIdx}
              className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-4"
            >
              <div>
                <Label className="text-xs font-semibold text-slate-700">Certification Name</Label>
                <Input
                  value={cert.name}
                  onChange={(e) => {
                    const updated = [...(profileData.certifications || [])]
                    updated[certIdx].name = e.target.value
                    setProfileData({
                      ...profileData,
                      certifications: updated,
                    })
                  }}
                  placeholder="e.g. AWS Certified Solutions Architect"
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Issuing Organization</Label>
                <Input
                  value={cert.issuer || ""}
                  onChange={(e) => {
                    const updated = [...(profileData.certifications || [])]
                    updated[certIdx].issuer = e.target.value
                    setProfileData({
                      ...profileData,
                      certifications: updated,
                    })
                  }}
                  placeholder="e.g. Amazon Web Services"
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Date / Year</Label>
                <Input
                  value={cert.date || ""}
                  onChange={(e) => {
                    const updated = [...(profileData.certifications || [])]
                    updated[certIdx].date = e.target.value
                    setProfileData({
                      ...profileData,
                      certifications: updated,
                    })
                  }}
                  placeholder="e.g. 2024"
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs font-semibold text-slate-700">Credential URL</Label>
                  <Input
                    value={cert.url || ""}
                    onChange={(e) => {
                      const updated = [...(profileData.certifications || [])]
                      updated[certIdx].url = e.target.value
                      setProfileData({
                        ...profileData,
                        certifications: updated,
                      })
                    }}
                    placeholder="https://credly.com/..."
                    className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const updated = (profileData.certifications || []).filter(
                      (_, i) => i !== certIdx
                    )
                    setProfileData({
                      ...profileData,
                      certifications: updated,
                    })
                  }}
                  className="h-9 w-9 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
