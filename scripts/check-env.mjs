#!/usr/bin/env node
/**
 * Fail-fast config check (plan Task 0.5).
 *
 * Run before every deploy so a missing or placeholder value fails the
 * pipeline instead of shipping a site that 500s on first request.
 *
 *   node scripts/check-env.mjs [--env-file <path>] [--target preview|production]
 *
 * --env-file   dotenv file to read on top of process.env (e.g. the
 *              .vercel/.env.production.local that `vercel pull` writes).
 * --target     production additionally requires an https NEXT_PUBLIC_SITE_URL.
 *
 * Prints variable NAMES only — never values.
 */
import { existsSync, readFileSync } from "node:fs"

const args = process.argv.slice(2)
const argValue = (flag) => {
  const i = args.indexOf(flag)
  return i === -1 ? undefined : args[i + 1]
}

const envFile = argValue("--env-file")
const target = argValue("--target") ?? "preview"

function parseDotenv(text) {
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let value = m[2]
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1)
    out[m[1]] = value
  }
  return out
}

const env = { ...process.env }
let fileVars = {}
if (envFile) {
  if (!existsSync(envFile)) {
    console.error(`✗ env file not found: ${envFile}`)
    process.exit(1)
  }
  fileVars = parseDotenv(readFileSync(envFile, "utf8"))
  Object.assign(env, fileVars)
}

const PLACEHOLDER = /placeholder|your-|changeme|example\.com|<.*>/i
const errors = []
const warnings = []

function requireVar(name, check, hint) {
  const value = env[name]
  // Vercel "Sensitive" variables are pulled with an empty value: they exist
  // and are injected at runtime, they just can't be read back. Server-only
  // names are fine; NEXT_PUBLIC_ ones must be readable to be inlined.
  if (value === "" && name in fileVars && !name.startsWith("NEXT_PUBLIC_")) {
    return warnings.push(`${name} is set but unreadable (Vercel sensitive variable) — assuming OK`)
  }
  if (!value) return errors.push(`${name} is not set`)
  if (PLACEHOLDER.test(value)) return errors.push(`${name} still has a placeholder value`)
  if (check && !check(value)) errors.push(`${name} ${hint}`)
}

requireVar(
  "NEXT_PUBLIC_SUPABASE_URL",
  (v) => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v),
  "must look like https://<project-ref>.supabase.co"
)

if (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) requireVar("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
else if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY) requireVar("NEXT_PUBLIC_SUPABASE_ANON_KEY")
else errors.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY) is not set")

if (target === "production") {
  requireVar("NEXT_PUBLIC_SITE_URL", (v) => v.startsWith("https://"), "must be https:// in production")
} else if (!env.NEXT_PUBLIC_SITE_URL) {
  warnings.push("NEXT_PUBLIC_SITE_URL not set — auth emails will fall back to VERCEL_URL")
}

// Resume parsing (lib/ai/gemini.ts) and job tagging (lib/jobs/classify.ts).
requireVar("GEMINI_API_KEY")
requireVar("NVIDIA_API_KEY")

// Optional: Groq speeds up text generation (falls back to Gemini);
// Tavily powers company discovery (Task 2.2).
for (const name of ["GROQ_API_KEY", "TAVILY_API_KEY"]) {
  if (!env[name]) warnings.push(`${name} not set (optional)`)
}

// SECURITY.md: server secrets must never be exposed to the browser bundle.
for (const name of Object.keys(env)) {
  if (/^NEXT_PUBLIC_.*(SERVICE_ROLE|SECRET|PRIVATE)/.test(name)) {
    errors.push(`${name} is a NEXT_PUBLIC_ variable holding a secret — it would ship to every browser`)
  }
}
for (const name of ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  const value = env[name] ?? ""
  if (value.startsWith("sb_secret_")) errors.push(`${name} holds a secret key (sb_secret_…), not the publishable one`)
  // Legacy keys are JWTs; the service-role one says so in its payload.
  const payload = value.split(".")[1]
  if (payload) {
    try {
      if (JSON.parse(Buffer.from(payload, "base64url").toString()).role === "service_role") {
        errors.push(`${name} holds the service_role key, not the anon key`)
      }
    } catch {
      // Not a JWT — nothing to inspect.
    }
  }
}

for (const w of warnings) console.log(`! ${w}`)
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`)
  console.error(`\nConfig check failed for target "${target}" (${errors.length} problem(s)). See docs/DEPLOYMENT.md.`)
  process.exit(1)
}
console.log(`✓ Config check passed for target "${target}"`)
