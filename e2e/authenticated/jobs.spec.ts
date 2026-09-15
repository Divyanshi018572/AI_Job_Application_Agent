import { expect, test, type Page, type Route } from "@playwright/test"

/**
 * Needs a real, email-confirmed Supabase test user (see docs/DEPLOYMENT.md)
 * and real NEXT_PUBLIC_SUPABASE_* values. Skips itself otherwise.
 *
 * Login and the auth gate are real. The two jobs API routes are mocked in
 * the browser for the UI-flow tests, so they are deterministic and never
 * spend NVIDIA credits; the backend behind them is covered by the Vitest
 * suite. One test hits the real /api/jobs to prove auth + database wiring.
 */
const email = process.env.E2E_USER_EMAIL
const password = process.env.E2E_USER_PASSWORD
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""

test.skip(
  !email || !password || !supabaseUrl || supabaseUrl.includes("placeholder"),
  "Needs E2E_USER_EMAIL, E2E_USER_PASSWORD and a real NEXT_PUBLIC_SUPABASE_URL — see docs/DEPLOYMENT.md"
)

// A trace records every action's arguments (the typed password) and every
// request header (the session cookie). CI failure artifacts are downloadable
// on a public repo, so no traces or videos of logged-in tests there;
// screenshots are enough. Local runs keep them — test-results/ is gitignored.
if (process.env.CI) test.use({ trace: "off", video: "off" })

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
}

/** Keeps the blocking "upload your resume" onboarding dialog closed. */
async function skipOnboarding(page: Page) {
  await page.route("**/api/profile", (route) =>
    route.request().method() === "GET"
      ? json(route, { profile: { onboarding_completed: true, full_name: "E2E User" } })
      : route.continue()
  )
  await page.route("**/api/resumes", (route) => json(route, { resumes: [] }))
}

/** The token form sits in a collapsed "Enter a board token instead" section. */
async function openTokenForm(page: Page) {
  await page.getByText("Enter a board token instead").click()
}

async function login(page: Page) {
  await page.goto("/login")
  await page.locator("#email").fill(email!)
  await page.locator("#password").fill(password!)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/\/dashboard/)
}

const job = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  platform: "greenhouse",
  title: `Engineer ${id}`,
  company: "acme",
  location: "Remote",
  experience_level: "3-5",
  employment_type: "Full-time",
  work_mode: "Remote",
  job_url: `https://boards.greenhouse.io/acme/jobs/${id}`,
  fetched_at: "2026-09-15T00:00:00Z",
  classified_at: "2026-09-15T00:00:00Z",
  company_type: null,
  ...overrides,
})

test.describe("real auth", () => {
  test("a logged-in user visiting /login is sent to the dashboard", async ({ page }) => {
    await skipOnboarding(page)
    await login(page)
    await page.goto("/login")
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("the real /api/jobs answers 200 for a logged-in user (auth + RLS + schema wired)", async ({ page }) => {
    await skipOnboarding(page)
    await login(page)
    // Called from inside the page, not page.request: on failure Playwright
    // prints page.request's headers — including the session cookie — to
    // the log, which is public in CI.
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/jobs")
      return { status: r.status, body: await r.json() }
    })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.jobs)).toBe(true)
  })
})

test.describe("jobs page", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page)
  })

  test("shows the empty state when no jobs are tracked", async ({ page }) => {
    await page.route("**/api/jobs", (route) => json(route, { jobs: [] }))
    await login(page)
    await page.goto("/dashboard/jobs")

    await expect(page.getByText("No jobs tracked yet")).toBeVisible()
  })

  test("shows a company's size/tier tag only when it's classified (Task 2.5)", async ({ page }) => {
    await page.route("**/api/jobs", (route) =>
      json(route, {
        jobs: [
          job("1", { company: "Stripe", company_type: "enterprise" }),
          job("2", { company: "Unlisted Co", company_type: null }),
        ],
      })
    )
    await login(page)
    await page.goto("/dashboard/jobs")

    await expect(page.getByText("Enterprise", { exact: true })).toHaveCount(1)
    await expect(page.getByText("Unlisted Co")).toBeVisible()
  })

  test("fetch → partial tagging → Tag more → fully tagged", async ({ page }) => {
    let listCall = 0
    await page.route("**/api/jobs", (route) => {
      listCall++
      return json(route, {
        jobs:
          listCall < 3
            ? [job("1"), job("2", { experience_level: null, employment_type: null, work_mode: null, classified_at: null })]
            : [job("1"), job("2")],
      })
    })

    let ingestCall = 0
    await page.route("**/api/jobs/ingest", async (route) => {
      ingestCall++
      expect(route.request().postDataJSON()).toMatchObject({ platform: "greenhouse", boardToken: "acme" })
      return ingestCall === 1
        ? json(route, { status: "fetched", jobsFetched: 30, jobsUpserted: 30, jobsClassified: 12, pendingClassification: 18, classificationFailures: 0 }, 201)
        : json(route, { status: "cached", jobsFetched: 0, jobsUpserted: 0, jobsClassified: 18, pendingClassification: 0, classificationFailures: 0 }, 201)
    })

    await login(page)
    await page.goto("/dashboard/jobs")
    await openTokenForm(page)
    await page.getByPlaceholder("Board token (e.g. acme)").fill("acme")
    await page.getByRole("button", { name: "Fetch Jobs" }).click()

    await expect(page.getByText("Saved 30 jobs. Tagged 12, 18 still untagged.")).toBeVisible()
    await expect(page.getByText("Not tagged yet")).toBeVisible()
    const tagMore = page.getByRole("button", { name: "Tag more" })
    await expect(tagMore).toBeVisible()
    await expect(page.getByText(/18 jobs from/)).toBeVisible()

    await tagMore.click()

    await expect(page.getByText("Tagged 18.")).toBeVisible()
    await expect(tagMore).toBeHidden()
    await expect(page.getByText("Not tagged yet")).toBeHidden()
  })

  test("shows a persistent warning when tagging fails", async ({ page }) => {
    await page.route("**/api/jobs", (route) => json(route, { jobs: [] }))
    await page.route("**/api/jobs/ingest", (route) =>
      json(route, {
        status: "fetched",
        jobsFetched: 5,
        jobsUpserted: 5,
        jobsClassified: 3,
        pendingClassification: 2,
        classificationFailures: 2,
        classificationError: "NVIDIA NIM API error (410): model retired",
      }, 201)
    )

    await login(page)
    await page.goto("/dashboard/jobs")
    await openTokenForm(page)
    await page.getByPlaceholder("Board token (e.g. acme)").fill("acme")
    await page.getByRole("button", { name: "Fetch Jobs" }).click()

    await expect(page.getByText(/2 jobs couldn't be tagged this time/)).toBeVisible()
    await expect(page.getByText(/model retired/)).toBeVisible()
  })

  test("keeps the typed board token when the fetch fails", async ({ page }) => {
    await page.route("**/api/jobs", (route) => json(route, { jobs: [] }))
    await page.route("**/api/jobs/ingest", (route) =>
      json(route, { error: 'Greenhouse board not found for token "acmee"' }, 502)
    )

    await login(page)
    await page.goto("/dashboard/jobs")
    await openTokenForm(page)
    const tokenInput = page.getByPlaceholder("Board token (e.g. acme)")
    await tokenInput.fill("acmee")
    await page.getByRole("button", { name: "Fetch Jobs" }).click()

    await expect(page.getByText(/board not found/)).toBeVisible()
    await expect(tokenInput).toHaveValue("acmee")
  })
})

test.describe("find a company by name (Task 2.2)", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page)
    await page.route("**/api/jobs", (route) => json(route, { jobs: [] }))
  })

  const ingested = { status: "fetched", jobsFetched: 5, jobsUpserted: 5, jobsClassified: 5, pendingClassification: 0, classificationFailures: 0 }

  test("finds the board and fetches its jobs", async ({ page }) => {
    await page.route("**/api/companies/discover", (route) => {
      expect(route.request().postDataJSON()).toEqual({ companyName: "stripe" })
      return json(route, { status: "found", source: "curated", companyName: "Stripe", platform: "greenhouse", token: "stripe" })
    })
    await page.route("**/api/jobs/ingest", (route) => {
      expect(route.request().postDataJSON()).toEqual({ platform: "greenhouse", boardToken: "stripe", companyDisplayName: "Stripe" })
      return json(route, ingested, 201)
    })

    await login(page)
    await page.goto("/dashboard/jobs")
    await page.getByLabel("Company name").fill("stripe")
    await page.getByRole("button", { name: "Find jobs" }).click()

    await expect(page.getByText("Found Stripe on Greenhouse. Saved 5 jobs. Tagged 5.")).toBeVisible()
    await expect(page.getByLabel("Company name")).toHaveValue("")
  })

  test("offers a paste-a-link fallback when no board is found", async ({ page }) => {
    const requests: unknown[] = []
    await page.route("**/api/companies/discover", (route) => {
      const body = route.request().postDataJSON()
      requests.push(body)
      return body.careersUrl
        ? json(route, { status: "found", source: "manual", companyName: "Ghost Corp", platform: "lever", token: "ghostcorp" })
        : json(route, { status: "not_found", companyName: "Ghost Corp", reason: `Couldn't find a job board for "Ghost Corp". Paste a link instead.` })
    })
    await page.route("**/api/jobs/ingest", (route) => json(route, ingested, 201))

    await login(page)
    await page.goto("/dashboard/jobs")
    await page.getByLabel("Company name").fill("Ghost Corp")
    await page.getByRole("button", { name: "Find jobs" }).click()

    await expect(page.getByText(/Couldn't find a job board for "Ghost Corp"/)).toBeVisible()
    await page.getByLabel("Job board link").fill("https://jobs.lever.co/ghostcorp/123")
    await page.getByRole("button", { name: "Use this link" }).click()

    await expect(page.getByText("Found Ghost Corp on Lever. Saved 5 jobs. Tagged 5.")).toBeVisible()
    await expect(page.getByLabel("Job board link")).toBeHidden()
    expect(requests).toEqual([
      { companyName: "Ghost Corp" },
      { companyName: "Ghost Corp", careersUrl: "https://jobs.lever.co/ghostcorp/123" },
    ])
  })

  test("shows the reason when a pasted link is rejected, and keeps it for editing", async ({ page }) => {
    await page.route("**/api/companies/discover", (route) =>
      route.request().postDataJSON().careersUrl
        ? json(route, { error: "That link isn't a Greenhouse, Lever or Workable job board." }, 422)
        : json(route, { status: "not_found", companyName: "Ghost", reason: "No board found." })
    )

    await login(page)
    await page.goto("/dashboard/jobs")
    await page.getByLabel("Company name").fill("Ghost")
    await page.getByRole("button", { name: "Find jobs" }).click()
    await page.getByLabel("Job board link").fill("https://ghost.com/careers")
    await page.getByRole("button", { name: "Use this link" }).click()

    await expect(page.getByText(/isn't a Greenhouse, Lever or Workable job board/)).toBeVisible()
    await expect(page.getByLabel("Job board link")).toHaveValue("https://ghost.com/careers")
  })
})
