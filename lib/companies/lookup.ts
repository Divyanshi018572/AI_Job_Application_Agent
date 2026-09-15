import type { ATSPlatform } from "@/lib/ats/registry"
import type { createClient } from "@/lib/supabase/server"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface CompanyRef {
  id: string
  name: string
}

/**
 * The curated company that owns this job board, if any (Task 2.5). Used at
 * ingestion to give jobs a real company name — Greenhouse/Lever only return
 * the board token — and a company_id for the size/tier tag.
 *
 * A lookup error is treated as "not curated": the jobs still get saved,
 * just without the link, rather than failing the whole ingestion over
 * optional metadata.
 */
export async function findCompanyByBoard(
  supabase: SupabaseServerClient,
  platform: ATSPlatform,
  boardToken: string
): Promise<CompanyRef | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .eq("ats_platform", platform)
    .eq("board_token", boardToken.toLowerCase())
    .maybeSingle()

  if (error || !data) return null
  return data
}
