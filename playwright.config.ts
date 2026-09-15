import { loadEnvConfig } from "@next/env"
import { defineConfig, devices } from "@playwright/test"

// Same .env.local loading Next.js does, so E2E_USER_EMAIL / E2E_USER_PASSWORD
// can live there for local runs. In CI there's no .env.local; values come
// from the workflow's env instead.
loadEnvConfig(process.cwd())

/**
 * End-to-end browser tests (plan Task 0.3).
 *
 * Two kinds of spec, split by whether they need a real logged-in user:
 *
 * - e2e/public/*   — landing, auth pages, and "logged-out users get
 *   redirected". Need no real Supabase: with no session cookie, Supabase's
 *   getUser() returns early without a network call, so these run in CI
 *   against placeholder env values.
 * - e2e/authenticated/* — need a real confirmed test account
 *   (E2E_USER_EMAIL / E2E_USER_PASSWORD, plus real
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). They
 *   skip themselves when those aren't set, so CI stays green until the
 *   account and secrets exist. See docs/DEPLOYMENT.md.
 *
 * Port 3100, not 3000, so a local `npm run dev` on 3000 doesn't collide.
 *
 * E2E_BASE_URL points the suite at an already-running deployment instead of
 * starting a local server — the deploy workflows use it to smoke-test the
 * URL they just deployed. VERCEL_AUTOMATION_BYPASS_SECRET, when set, is sent
 * so Vercel's Deployment Protection lets the test browser through.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100)
const REMOTE_URL = process.env.E2E_BASE_URL?.replace(/\/$/, "")
const BASE_URL = REMOTE_URL ?? `http://localhost:${PORT}`
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

// Which server the tests run against:
// - E2E_BASE_URL set: that deployment (the deploy workflows' smoke tests).
// - CI: the production build the workflow just made.
// - Locally, by default: build, then serve the production build — the same
//   thing CI tests. `next dev` compiles each route on its first request; on
//   a cold dev server that took ~50s for /api/auth/login alone and the
//   logged-in tests timed out, while a production build passes them in
//   seconds. The dev server is opt-in with E2E_DEV=1 (`npm run
//   test:e2e:dev`), best used with `npm run dev -- -p 3100` already warm.
const mode = REMOTE_URL ? "remote" : process.env.CI ? "ci" : process.env.E2E_DEV ? "dev" : "local"

const SERVER_COMMANDS = {
  ci: `npx next start -p ${PORT}`,
  local: `npx next build && npx next start -p ${PORT}`,
  dev: `npx next dev -p ${PORT}`,
} as const

export default defineConfig({
  testDir: "./e2e",
  timeout: mode === "dev" ? 120_000 : 30_000,
  expect: { timeout: mode === "dev" ? 20_000 : 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: bypassSecret
      ? { "x-vercel-protection-bypass": bypassSecret, "x-vercel-set-bypass-cookie": "true" }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer:
    mode === "remote"
      ? undefined
      : {
          command: SERVER_COMMANDS[mode],
          url: BASE_URL,
          // Locally, reuse a server already on the port (e.g. a warm dev
          // server with E2E_DEV=1). CI always starts its own.
          reuseExistingServer: mode !== "ci",
          // Local mode includes a full `next build`.
          timeout: mode === "local" ? 300_000 : 180_000,
        },
})
