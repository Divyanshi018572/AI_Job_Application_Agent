"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
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
  Target,
  Trophy,
  Trash2,
  Upload,
  User,
  Camera,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
    avatarUrl: "",
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
  achievements: [],
  careerPreferences: {
    preferredLocations: "",
    noticePeriod: "Immediate",
    experienceLevel: "Experienced",
    jobTypes: ["Full-time"],
  },
}

export function ProfileEditor() {
  const [profileData, setProfileData] =
    React.useState<ParsedResume>(INITIAL_PROFILE)
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [isSaving, setIsSaving] = React.useState<boolean>(false)
  const [saveSuccess, setSaveSuccess] = React.useState<boolean>(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState<boolean>(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const [newSkill, setNewSkill] = React.useState<string>("")
  const [newAchievement, setNewAchievement] = React.useState<string>("")

  type TabKey =
    | "personal"
    | "summary"
    | "skills"
    | "experience"
    | "education"
    | "projects"
    | "certifications"
    | "achievements"
    | "preferences"

  const [activeTab, setActiveTab] = React.useState<TabKey>("personal")

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
                avatarUrl: p.avatar_url || parsed.profile?.avatarUrl || "",
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
              achievements:
                Array.isArray(p.achievements) && p.achievements.length > 0
                  ? p.achievements
                  : Array.isArray(parsed.achievements)
                  ? parsed.achievements
                  : [],
              careerPreferences: {
                preferredLocations:
                  p.career_preferences?.preferredLocations ||
                  parsed.careerPreferences?.preferredLocations ||
                  p.location ||
                  "",
                noticePeriod:
                  p.career_preferences?.noticePeriod ||
                  parsed.careerPreferences?.noticePeriod ||
                  parsed.careerPreferences?.availability ||
                  "Immediate",
                experienceLevel:
                  p.career_preferences?.experienceLevel ||
                  parsed.careerPreferences?.experienceLevel ||
                  (Array.isArray(parsed.workExperience) && parsed.workExperience.length > 0
                    ? "Experienced"
                    : "Fresher"),
                jobTypes:
                  Array.isArray(p.career_preferences?.jobTypes) && p.career_preferences.jobTypes.length > 0
                    ? p.career_preferences.jobTypes
                    : Array.isArray(parsed.careerPreferences?.jobTypes) && parsed.careerPreferences.jobTypes.length > 0
                    ? parsed.careerPreferences.jobTypes
                    : ["Full-time"],
              },
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
          avatar_url: profileData.profile.avatarUrl,
          phone: profileData.profile.phone,
          location: profileData.profile.location,
          summary: profileData.summary,
          skills: profileData.skills,
          work_experience: profileData.workExperience,
          education: profileData.education,
          projects: profileData.projects,
          certifications: profileData.certifications,
          achievements: profileData.achievements,
          careerPreferences: profileData.careerPreferences,
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

  async function handleAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    setErrorMsg(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const errJson = await res.json()
        throw new Error(errJson.error || "Failed to upload profile picture")
      }

      const data = await res.json()
      if (data.url) {
        setProfileData((prev) => ({
          ...prev,
          profile: {
            ...prev.profile,
            avatarUrl: data.url,
          },
        }))
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to upload image. Please try again.")
    } finally {
      setIsUploadingAvatar(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  async function handleRemoveAvatar() {
    setIsUploadingAvatar(true)
    try {
      const updatedProfile = {
        ...profileData,
        profile: {
          ...profileData.profile,
          avatarUrl: "",
        },
      }
      setProfileData(updatedProfile)

      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar_url: "",
          parsedData: updatedProfile,
        }),
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to remove image.")
    } finally {
      setIsUploadingAvatar(false)
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

  function handleAddAchievement(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!newAchievement.trim()) return
    const currentAchievements = profileData.achievements || []
    if (!currentAchievements.includes(newAchievement.trim())) {
      setProfileData({
        ...profileData,
        achievements: [...currentAchievements, newAchievement.trim()],
      })
    }
    setNewAchievement("")
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
        <div className="flex items-center gap-4">
          <Avatar className="size-14 border-2 border-indigo-200 shadow-sm shrink-0">
            <AvatarImage src={profileData.profile.avatarUrl || ""} alt={profileData.profile.fullName || "Profile"} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-lg">
              {(profileData.profile.fullName || "U").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Profile Information
            </h2>
            <p className="text-sm text-slate-600">
              Review and edit your parsed resume data below.
            </p>
          </div>
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

      {/* Main Two-Column Layout: Vertical Navigation Sidebar Left, Active Card Right */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
        {/* Left Column: Vertical Navigation Tabs */}
        <div className="lg:col-span-1">
          <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
            {(
              [
                { id: "personal", label: "Personal Details", icon: User },
                { id: "summary", label: "Summary", icon: Sparkles },
                { id: "skills", label: "Skills", icon: Award, count: profileData.skills?.length || 0 },
                { id: "experience", label: "Experience", icon: Briefcase, count: profileData.workExperience?.length || 0 },
                { id: "education", label: "Education", icon: GraduationCap, count: profileData.education?.length || 0 },
                { id: "projects", label: "Projects", icon: FolderGit2, count: profileData.projects?.length || 0 },
                { id: "certifications", label: "Certifications", icon: Award, count: profileData.certifications?.length || 0 },
                { id: "achievements", label: "Achievements", icon: Trophy, count: profileData.achievements?.length || 0 },
                { id: "preferences", label: "Career Preferences", icon: Target },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabKey)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3.5 py-3 text-sm font-semibold transition-all cursor-pointer text-left",
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </span>
                  {"count" in tab && tab.count !== undefined && (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold",
                        isActive
                          ? "bg-indigo-700 text-white"
                          : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Column: Active Category Content */}
        <div className="lg:col-span-3 space-y-6">
      {/* SECTION 1: Personal Details */}
      {activeTab === "personal" && (
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <User className="h-5 w-5 text-indigo-600" /> Personal Details & Links
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Interactive Profile Picture Manager */}
          <div className="md:col-span-2 flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/40 p-6 shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleAvatarFileChange}
              className="hidden"
            />

            {/* Clickable Circle Avatar */}
            <div
              onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
              className={cn(
                "group relative flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-all duration-200 focus:outline-none",
                isUploadingAvatar ? "opacity-75 pointer-events-none" : "hover:ring-4 hover:ring-indigo-300 hover:scale-105"
              )}
              title="Click to select image from computer"
            >
              <Avatar className="size-24 border-4 border-white shadow-md">
                <AvatarImage src={profileData.profile.avatarUrl || ""} alt={profileData.profile.fullName || "Avatar"} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 text-white font-extrabold text-3xl">
                  {(profileData.profile.fullName || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Camera Icon Overlay on Hover / Loading overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-slate-900/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100 text-white gap-1">
                {isUploadingAvatar ? (
                  <Loader2 className="size-6 animate-spin text-white" />
                ) : (
                  <>
                    <Camera className="size-6 text-white" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                  </>
                )}
              </div>

              {/* Small badge overlay */}
              {!isUploadingAvatar && (
                <div className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-indigo-600 p-1.5 text-white shadow-sm transition-transform group-hover:scale-110">
                  <Camera className="size-3.5" />
                </div>
              )}
            </div>

            {/* Controls and Information */}
            <div className="flex-1 space-y-3 text-center sm:text-left w-full">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center justify-center sm:justify-start gap-2">
                  Profile Picture
                  {isUploadingAvatar && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      <Loader2 className="size-3 animate-spin" /> Uploading...
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Click the circle photo or button below to select an image right from your system files (`.jpg`, `.png`, `.webp`).
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="bg-white hover:bg-indigo-50 hover:text-indigo-700 border-indigo-200 text-indigo-600 font-semibold shadow-2xs transition-all cursor-pointer"
                >
                  <Upload className="size-4 mr-1.5" />
                  {profileData.profile.avatarUrl ? "Update Picture" : "Select from Computer"}
                </Button>

                {profileData.profile.avatarUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRemoveAvatar}
                    disabled={isUploadingAvatar}
                    className="border-red-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-700 font-medium transition-all cursor-pointer"
                  >
                    <Trash2 className="size-4 mr-1.5" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

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
          <div className="flex justify-end border-t border-slate-100 p-4">
            <Button
              type="button"
              onClick={() => setActiveTab("summary")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Next: Professional Summary →
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* SECTION 2: Executive Summary */}
      {activeTab === "summary" && (
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
          <div className="flex justify-between border-t border-slate-100 p-4 mt-4">
            <Button
              type="button"
              onClick={() => setActiveTab("personal")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              ← Prev: Personal Details
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab("skills")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Next: Core Skills →
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* SECTION 3: Core Skills */}
      {activeTab === "skills" && (
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
          <div className="flex justify-between border-t border-slate-100 p-4 pt-4">
            <Button
              type="button"
              onClick={() => setActiveTab("summary")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              ← Prev: Professional Summary
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab("experience")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Next: Work Experience →
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* SECTION 4: Work Experience */}
      {activeTab === "experience" && (
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
          <div className="flex justify-between border-t border-slate-100 p-4 pt-4">
            <Button
              type="button"
              onClick={() => setActiveTab("skills")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              ← Prev: Core Skills
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab("education")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Next: Education →
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* SECTION 5: Education */}
      {activeTab === "education" && (
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
          <div className="flex justify-between border-t border-slate-100 p-4 pt-4">
            <Button
              type="button"
              onClick={() => setActiveTab("experience")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              ← Prev: Work Experience
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab("projects")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Next: Projects →
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* SECTION 6: Projects */}
      {activeTab === "projects" && (
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
          <div className="flex justify-between border-t border-slate-100 p-4 pt-4">
            <Button
              type="button"
              onClick={() => setActiveTab("education")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              ← Prev: Education
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab("certifications")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Next: Certifications →
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* SECTION 7: Certifications */}
      {activeTab === "certifications" && (
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
          <div className="flex justify-between border-t border-slate-100 p-4 pt-4">
            <Button
              type="button"
              onClick={() => setActiveTab("projects")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              ← Prev: Projects
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab("achievements")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Next: Achievements →
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* SECTION 8: Achievements */}
      {activeTab === "achievements" && (
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Trophy className="h-5 w-5 text-indigo-600" /> Key Achievements & Awards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddAchievement} className="flex gap-2">
            <Input
              value={newAchievement}
              onChange={(e) => setNewAchievement(e.target.value)}
              placeholder="e.g. Won 1st place in National AI Hackathon 2024 among 500+ teams"
              className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            />
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 cursor-pointer shrink-0"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Achievement
            </Button>
          </form>

          <div className="space-y-3 pt-2">
            {!profileData.achievements || profileData.achievements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                <Trophy className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">No achievements added yet</p>
                <p className="text-xs text-slate-400 mt-1">Highlight major awards, scholarships, competitions won, or notable milestones.</p>
              </div>
            ) : (
              profileData.achievements.map((ach, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm font-medium text-slate-800 transition-all hover:bg-slate-100/70"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs">
                      {idx + 1}
                    </div>
                    <span className="leading-relaxed">{ach}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setProfileData({
                        ...profileData,
                        achievements: profileData.achievements?.filter((_, i) => i !== idx) || [],
                      })
                    }
                    className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 font-bold transition-colors cursor-pointer shrink-0"
                    title="Remove achievement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-between border-t border-slate-100 p-4 pt-4">
            <Button
              type="button"
              onClick={() => setActiveTab("certifications")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              ← Prev: Certifications
            </Button>
            <Button
              type="button"
              onClick={() => setActiveTab("preferences")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Next: Career Preferences →
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* SECTION 9: Career Preferences */}
      {activeTab === "preferences" && (
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Target className="h-5 w-5 text-indigo-600" /> Career Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">Preferred Location(s)</Label>
              <Input
                value={profileData.careerPreferences?.preferredLocations || ""}
                onChange={(e) =>
                  setProfileData({
                    ...profileData,
                    careerPreferences: {
                      ...(profileData.careerPreferences || {}),
                      preferredLocations: e.target.value,
                    },
                  })
                }
                placeholder="e.g. Remote, Bangalore, New York, San Francisco"
                className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
              />
              <p className="text-xs text-slate-500">Enter target cities or remote working preference</p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">Immediate Joining / Notice Period</Label>
              <select
                value={profileData.careerPreferences?.noticePeriod || "Immediate"}
                onChange={(e) =>
                  setProfileData({
                    ...profileData,
                    careerPreferences: {
                      ...(profileData.careerPreferences || {}),
                      noticePeriod: e.target.value,
                    },
                  })
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Immediate">Immediate Joining / 0 Days</option>
                <option value="15 Days">15 Days Notice</option>
                <option value="30 Days">30 Days Notice</option>
                <option value="60 Days">60 Days Notice</option>
                <option value="90 Days">90 Days Notice</option>
                <option value="Serving Notice Period">Currently Serving Notice Period</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">Experience Level</Label>
              <select
                value={profileData.careerPreferences?.experienceLevel || "Experienced"}
                onChange={(e) =>
                  setProfileData({
                    ...profileData,
                    careerPreferences: {
                      ...(profileData.careerPreferences || {}),
                      experienceLevel: e.target.value,
                    },
                  })
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Experienced">Experienced Professional</option>
                <option value="Fresher">Fresher / Entry-Level</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold">Preferred Job Type</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {["Full-time", "Remote", "Contract", "Internship", "Part-time"].map((type) => {
                  const currentTypes = profileData.careerPreferences?.jobTypes || ["Full-time"]
                  const isSelected = currentTypes.includes(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const updated = isSelected
                          ? currentTypes.filter((t) => t !== type)
                          : [...currentTypes, type]
                        setProfileData({
                          ...profileData,
                          careerPreferences: {
                            ...(profileData.careerPreferences || {}),
                            jobTypes: updated.length > 0 ? updated : ["Full-time"],
                          },
                        })
                      }}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer",
                        isSelected
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      {type}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-between border-t border-slate-100 p-4 pt-4">
            <Button
              type="button"
              onClick={() => setActiveTab("achievements")}
              variant="outline"
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              ← Prev: Achievements
            </Button>
            <Button
              type="button"
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
            >
              <Save className="mr-2 h-4 w-4" /> Save All Changes
            </Button>
          </div>
        </CardContent>
      </Card>
      )}
        </div>
      </div>
    </div>
  )
}
