"use client"

import * as React from "react"
import {
  Award,
  Briefcase,
  CheckCircle2,
  CircleDashed,
  Code2,
  FileText,
  FolderGit2,
  GraduationCap,
  Languages,
  Sparkles,
  Target,
  User,
} from "lucide-react"

import type { ParsedResume } from "@/types/resume"

interface ProfileCompletenessCardProps {
  profileData: ParsedResume
  hasUploadedResume?: boolean
  onNavigateTab?: (tabId: string) => void
}

export function ProfileCompletenessCard({
  profileData,
  hasUploadedResume = false,
  onNavigateTab,
}: ProfileCompletenessCardProps) {
  // Calculate completion breakdown
  const criteria = React.useMemo(() => {
    const hasPersonal =
      Boolean(profileData.profile?.fullName?.trim()) &&
      Boolean(profileData.profile?.email?.trim())
    const hasSummary = Boolean(profileData.summary?.trim())
    const hasSkills =
      Array.isArray(profileData.skills) && profileData.skills.length > 0
    const hasExperience =
      Array.isArray(profileData.workExperience) &&
      profileData.workExperience.length > 0
    const hasEducation =
      Array.isArray(profileData.education) && profileData.education.length > 0
    const hasProjects =
      Array.isArray(profileData.projects) && profileData.projects.length > 0
    const hasCertifications =
      Array.isArray(profileData.certifications) &&
      profileData.certifications.length > 0
    const hasPreferences =
      Boolean(profileData.careerPreferences?.availability) ||
      Boolean(profileData.careerPreferences?.jobTypes?.length) ||
      Boolean(profileData.careerPreferences?.targetLocations?.length)

    return [
      {
        id: "personal",
        label: "Personal Details",
        icon: User,
        completed: hasPersonal,
        weight: 15,
      },
      {
        id: "summary",
        label: "Executive Summary",
        icon: FileText,
        completed: hasSummary,
        weight: 15,
      },
      {
        id: "skills",
        label: "Core Skills",
        icon: Code2,
        completed: hasSkills,
        weight: 15,
      },
      {
        id: "experience",
        label: "Work Experience",
        icon: Briefcase,
        completed: hasExperience,
        weight: 15,
      },
      {
        id: "education",
        label: "Education",
        icon: GraduationCap,
        completed: hasEducation,
        weight: 10,
      },
      {
        id: "projects",
        label: "Projects & Portfolio",
        icon: FolderGit2,
        completed: hasProjects,
        weight: 10,
      },
      {
        id: "certifications",
        label: "Certifications & Achievements",
        icon: Award,
        completed: hasCertifications,
        weight: 10,
      },
      {
        id: "preferences",
        label: "Career Preferences",
        icon: Target,
        completed: hasPreferences || hasUploadedResume,
        weight: 10,
      },
    ]
  }, [profileData, hasUploadedResume])

  const completionPercentage = React.useMemo(() => {
    return criteria.reduce((acc, item) => {
      return acc + (item.completed ? item.weight : 0)
    }, 0)
  }, [criteria])

  // Determine dynamic colors based on % completion
  const colorTheme = React.useMemo(() => {
    if (completionPercentage >= 75) {
      return {
        text: "text-emerald-400",
        stroke: "#10b981", // emerald-500
        bgGlow: "rgba(16, 185, 129, 0.15)",
        badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        label: "Excellent Profile",
      }
    }
    if (completionPercentage >= 45) {
      return {
        text: "text-cyan-400",
        stroke: "#06b6d4", // cyan-500
        bgGlow: "rgba(6, 182, 212, 0.15)",
        badgeBg: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
        label: "Strong Progress",
      }
    }
    return {
      text: "text-amber-400",
      stroke: "#f59e0b", // amber-500
      bgGlow: "rgba(245, 158, 11, 0.15)",
      badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      label: "Needs Attention",
    }
  }, [completionPercentage])

  // Circular gauge math
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset =
    circumference - (completionPercentage / 100) * circumference

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-slate-800/80 bg-slate-900/90 p-5 shadow-xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-100">
          Profile Strength
        </h3>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorTheme.badgeBg}`}
        >
          {colorTheme.label}
        </span>
      </div>

      {/* Circular Progress Meter */}
      <div className="relative flex flex-col items-center justify-center py-2">
        <div
          className="relative flex h-36 w-36 items-center justify-center rounded-full"
          style={{
            boxShadow: `0 0 35px ${colorTheme.bgGlow}`,
          }}
        >
          <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 132 132">
            {/* Background Track */}
            <circle
              cx="66"
              cy="66"
              r={radius}
              className="stroke-slate-800"
              strokeWidth="10"
              fill="transparent"
            />
            {/* Animated Progress Circle */}
            <circle
              cx="66"
              cy="66"
              r={radius}
              stroke={colorTheme.stroke}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Center Value display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              className={`text-3xl font-extrabold tracking-tight ${colorTheme.text}`}
            >
              {completionPercentage}%
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Completed
            </span>
          </div>
        </div>
      </div>

      {/* Section Checklist */}
      <div className="space-y-2 border-t border-slate-800/80 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Section Readiness
        </p>
        <div className="space-y-1.5">
          {criteria.map((item) => {
            const IconComponent = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigateTab?.(item.id)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-2.5">
                  <IconComponent
                    className={`h-4 w-4 ${
                      item.completed ? "text-emerald-400" : "text-slate-500"
                    }`}
                  />
                  <span
                    className={`text-xs font-medium ${
                      item.completed
                        ? "text-slate-200"
                        : "text-slate-400 line-through opacity-75"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <CircleDashed className="h-4 w-4 text-slate-600" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* AI Enhancer Tip */}
      <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent p-3.5">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-indigo-300">
              AI Job-Match Readiness
            </p>
            <p className="text-slate-400 leading-relaxed">
              Completing all sections unlocks higher accuracy when tailoring applications and cover letters.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
