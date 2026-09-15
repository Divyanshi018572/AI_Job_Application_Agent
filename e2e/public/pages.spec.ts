import { expect, test } from "@playwright/test"

// Plan Task 0.3 smoke specs: "app loads", "/login renders". No login and no
// real Supabase needed.

test("landing page loads with sign-up and sign-in links", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Apply")
  await expect(page.locator('a[href="/signup"]').first()).toBeVisible()
  await expect(page.locator('a[href="/login"]').first()).toBeVisible()
})

test("login page renders the email/password form", async ({ page }) => {
  await page.goto("/login")

  await expect(page.locator("#email")).toBeVisible()
  await expect(page.locator("#password")).toBeVisible()
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
})

test("signup page renders", async ({ page }) => {
  await page.goto("/signup")
  await expect(page.getByText("Create an account").first()).toBeVisible()
})

test("forgot-password page renders", async ({ page }) => {
  await page.goto("/forgot-password")
  await expect(page.getByText("Reset your password").first()).toBeVisible()
})
