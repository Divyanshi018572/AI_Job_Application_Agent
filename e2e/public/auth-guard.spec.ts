import { expect, test } from "@playwright/test"

// proxy.ts is the single auth gate (SECURITY.md Section 6). These pin its
// behavior for logged-out visitors so a matcher change can't silently open
// a dashboard page or API route.

for (const path of ["/dashboard", "/dashboard/jobs", "/dashboard/profile", "/dashboard/resume"]) {
  test(`logged-out visit to ${path} redirects to /login with a return path`, async ({ page }) => {
    await page.goto(path)

    await expect(page).toHaveURL(/\/login\?/)
    expect(new URL(page.url()).searchParams.get("next")).toBe(path)
  })
}

for (const [method, path] of [
  ["GET", "/api/jobs"],
  ["POST", "/api/jobs/ingest"],
  ["GET", "/api/profile"],
  ["GET", "/api/resumes"],
] as const) {
  test(`logged-out ${method} ${path} is rejected with 401`, async ({ request }) => {
    const res = await request.fetch(path, {
      method,
      data: method === "POST" ? { platform: "greenhouse", boardToken: "acme" } : undefined,
    })

    expect(res.status()).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
  })
}
