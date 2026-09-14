import { greenhouseAdapter } from "@/lib/ats/adapters/greenhouse"
import type { ATSAdapter } from "@/lib/ats/types"

/**
 * Platform registry (project plan Section 3). Orchestration code looks an
 * adapter up here by platform name or by URL — it never imports a specific
 * adapter directly. Lever and Workable get added the same way: implement
 * `ATSAdapter` in their own file under lib/ats/adapters/, register here.
 */
export const ATS_ADAPTERS = {
  greenhouse: greenhouseAdapter,
  // lever: leverAdapter,       // not yet implemented
  // workable: workableAdapter, // not yet implemented
} as const satisfies Record<string, ATSAdapter>

export type ATSPlatform = keyof typeof ATS_ADAPTERS

export function getAdapter(platform: ATSPlatform): ATSAdapter {
  return ATS_ADAPTERS[platform]
}

/**
 * Detects which registered platform a job/board URL belongs to, if any.
 * Returns null rather than throwing — an unrecognized URL is an expected,
 * routine case (the plan's Task 5.1 "Platform Detection" handles what to
 * do about it), not an error.
 */
export function detectPlatform(url: string): ATSPlatform | null {
  for (const [platform, adapter] of Object.entries(ATS_ADAPTERS) as [
    ATSPlatform,
    ATSAdapter,
  ][]) {
    if (adapter.detectPlatform(url)) return platform
  }
  return null
}
