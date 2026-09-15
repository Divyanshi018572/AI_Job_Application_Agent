import { NextResponse } from "next/server"

import { ATS_ADAPTERS, type ATSPlatform } from "@/lib/ats/registry"
import { requireUser } from "@/lib/auth/session"
import { CLASSIFICATION_BATCH_SIZE, ingestJobsForCompany } from "@/lib/jobs/ingest"

// One request = at most one board fetch (a few seconds, plus backoff) and
// one classification batch, which stops starting new calls after 35s (see
// CLASSIFICATION_TIME_BUDGET_MS) — real calls take 5–20s each. Stated
// explicitly rather than relying on the platform default.
export const maxDuration = 60

interface IngestRequestBody {
  platform?: string
  boardToken?: string
  companyDisplayName?: string
}

function isValidPlatform(value: unknown): value is ATSPlatform {
  return typeof value === "string" && value in ATS_ADAPTERS
}

// Interim cost/abuse guard until Phase 4's real usage enforcement exists —
// same reasoning as the resume upload rate limit (see
// AUDIT_AND_ROADMAP.md Flaw 7). Each new board triggers a real ATS fetch
// plus one NVIDIA NIM classification call per job returned; the ingestion
// pipeline's own 6-hour cache already stops repeat calls for the *same*
// board, so this specifically caps how many *different* boards one user
// can trigger fresh fetches for in an hour.
const MAX_NEW_BOARDS_PER_HOUR = 15

// Each request classifies up to one batch; "Tag more" can repeat it. This
// caps NVIDIA NIM calls per user per hour (12 full batches) so a user
// tagging a 900-job board can't burn through the whole free-tier quota in
// one sitting.
const MAX_CLASSIFICATIONS_PER_HOUR = CLASSIFICATION_BATCH_SIZE * 12

export async function POST(request: Request) {
  const { supabase, user, error } = await requireUser()

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: IngestRequestBody
  try {
    body = (await request.json()) as IngestRequestBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!isValidPlatform(body.platform)) {
    return NextResponse.json(
      {
        error: `platform must be one of: ${Object.keys(ATS_ADAPTERS).join(", ")}`,
      },
      { status: 400 }
    )
  }

  const boardToken = body.boardToken?.trim()
  if (!boardToken) {
    return NextResponse.json({ error: "boardToken is required" }, { status: 400 })
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recentIngestions } = await supabase
    .from("jobs")
    .select("board_token")
    .eq("user_id", user.id)
    .gte("fetched_at", oneHourAgo)

  const distinctRecentBoards = new Set(
    (recentIngestions ?? []).map((row) => row.board_token)
  )
  if (
    !distinctRecentBoards.has(boardToken) &&
    distinctRecentBoards.size >= MAX_NEW_BOARDS_PER_HOUR
  ) {
    return NextResponse.json(
      {
        error: `Ingestion limit reached (${MAX_NEW_BOARDS_PER_HOUR} new company boards per hour). Please try again later.`,
      },
      { status: 429 }
    )
  }

  const { count: recentClassifications } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("classified_at", oneHourAgo)

  if ((recentClassifications ?? 0) >= MAX_CLASSIFICATIONS_PER_HOUR) {
    return NextResponse.json(
      {
        error: `Tagging limit reached (${MAX_CLASSIFICATIONS_PER_HOUR} jobs per hour). Your jobs are saved — try "Tag more" again later.`,
      },
      { status: 429 }
    )
  }

  try {
    const result = await ingestJobsForCompany(supabase, {
      userId: user.id,
      platform: body.platform,
      boardToken,
      companyDisplayName: body.companyDisplayName?.trim() || undefined,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to ingest jobs"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
