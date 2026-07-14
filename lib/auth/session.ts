import { createClient } from "@/lib/supabase/server"

export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { supabase, user: null, error: "Unauthorized" as const }
  }

  return { supabase, user, error: null }
}

export function assertResourceOwner(userId: string, resourceUserId: string) {
  if (userId !== resourceUserId) {
    return { error: "Forbidden" as const }
  }

  return { error: null }
}
