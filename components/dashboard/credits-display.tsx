"use client"

import Link from "next/link"

import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress"
import { creditsPlaceholder } from "@/lib/dashboard/navigation"
import { cn } from "@/lib/utils"

type CreditsDisplayProps = {
  collapsed?: boolean
}

export function CreditsDisplay({ collapsed = false }: CreditsDisplayProps) {
  const remaining = creditsPlaceholder.total - creditsPlaceholder.used
  const usagePercent = Math.round(
    (creditsPlaceholder.used / creditsPlaceholder.total) * 100
  )

  if (collapsed) {
    return (
      <Link
        href="/dashboard/billing"
        className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold text-white transition-colors hover:bg-white/15"
        title={`${remaining} credits remaining`}
      >
        {remaining}
      </Link>
    )
  }

  return (
    <Link
      href="/dashboard/billing"
      className={cn(
        "block rounded-xl border border-white/10 bg-white/5 p-3.5 transition-colors hover:bg-white/10"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white/70">Credits</p>
        <p className="text-sm font-semibold text-white">{remaining} left</p>
      </div>
      <div className="mt-2.5">
        <Progress value={usagePercent}>
          <ProgressTrack className="h-2 bg-white/10">
            <ProgressIndicator className="bg-gradient-to-r from-indigo-400 to-violet-400" />
          </ProgressTrack>
        </Progress>
      </div>
      <p className="mt-2 text-xs text-white/50">
        {creditsPlaceholder.used} of {creditsPlaceholder.total} used
      </p>
    </Link>
  )
}
