import { createClient } from "@supabase/supabase-js"

import { getSupabaseUrl } from "@/lib/env"

/**
 * Service-role Supabase client — bypasses every RLS policy in the database.
 *
 * This has no legitimate call site in `app/api/**` (a user-facing request
 * handler should never be able to read/write another user's data — that's
 * exactly what RLS exists to prevent). It's reserved for background jobs
 * (Inngest functions, Phase 2+) that genuinely need to act across users,
 * e.g. ingesting jobs on a schedule with no request-scoped user session.
 *
 * `eslint.config.mjs` enforces this boundary: importing this module from
 * `app/api/**` is a lint error. Do not work around that rule without
 * updating SECURITY.md's reasoning for why the boundary exists.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
