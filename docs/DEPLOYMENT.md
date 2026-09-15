# Testing & Deployment Pipelines

Plan Tasks 0.3 (E2E), 0.4 (CD) and 0.5 (environments & secrets).

## How it fits together

```
feature branch ──PR──▶ dev ──PR──▶ main
      │                 │            │
      ▼                 ▼            ▼
     CI                CI           CI
 (lint, typecheck,      │            │
  unit-test, build,     ▼            ▼
  e2e)           Deploy staging   Deploy production
                 (automatic)      (waits for your approval)
```

| Workflow | File | Trigger | What it does |
|---|---|---|---|
| CI | `.github/workflows/ci.yml` | every PR, pushes to `dev`/`main` | lint, typecheck, unit tests (Vitest), build, **e2e** (Playwright on a production build) |
| Deploy staging | `.github/workflows/deploy-staging.yml` | CI passed on a push to `dev` (or run by hand on `dev`) | deploys a Vercel **Preview** build, the staging site |
| Deploy production | `.github/workflows/deploy-production.yml` | CI passed on a push to `main` (or run by hand on `main`) | **pauses for approval**, then deploys to Vercel **Production** |
| (shared) | `.github/workflows/_deploy.yml` | called by both deploy workflows | env check → migrations (opt-in) → `vercel build` → `vercel deploy` → smoke-tests the live URL |

**What works with no setup:** CI, including the public E2E specs. Both deploy
workflows show as *skipped* until `VERCEL_PROJECT_ID` exists, and the logged-in
E2E specs skip until their secrets exist. Nothing goes red just because a
setup step is still open.

---

## E2E tests (Playwright)

```
e2e/
  public/          no login needed; always run
    pages.spec.ts        landing, /login, /signup, /forgot-password render
    auth-guard.spec.ts   logged-out users are redirected / get 401 from APIs
  authenticated/   needs a real test account; skip themselves otherwise
    jobs.spec.ts         real login + real /api/jobs, then the jobs page UI
                         flow (Fetch → partial tagging → Tag more) with the
                         jobs APIs mocked in the browser, so it never spends
                         NVIDIA credits and is deterministic
```

### Run locally

```bash
npx playwright install chromium   # once
npm run test:e2e                  # starts `next dev` on port 3100 automatically
npm run test:e2e:ui               # same, in Playwright's interactive UI
npm run test:e2e:smoke            # public specs only
```

Point the suite at any running site instead of starting a server:

```bash
E2E_BASE_URL=https://your-staging-url npm run test:e2e:smoke
```

To run the logged-in specs locally, add the test account to `.env.local`
(step 1 below):

```
E2E_USER_EMAIL=...
E2E_USER_PASSWORD=...
```

### Writing new specs

- Doesn't need a login? Put it in `e2e/public/`.
- Needs a login? Put it in `e2e/authenticated/` and copy the `test.skip(...)`
  guard and the `login()` / `skipOnboarding()` helpers from `jobs.spec.ts`.
- Mock anything that calls a paid AI API with `page.route(...)`. The backend
  logic behind those routes belongs in Vitest.
- Prefer ids, roles and visible text over CSS classes as selectors.

---

## One-time setup (manual)

Do these in order. Every value goes into a dashboard or `.env.local`. **Never
paste secrets into chat, issues or commits.**

### Environments on the free tiers

The plan calls for dev, staging and production. Supabase's free tier allows
2 active projects, and Vercel's Hobby plan has no custom "staging"
environment. So:

| Environment | Supabase project | Vercel environment | URL |
|---|---|---|---|
| dev (your laptop) | **A**: the existing project | none | `http://localhost:3000` |
| staging | **A** (shared with dev) | Preview (deployed from `dev`) | the `STAGING_ALIAS` hostname, or the per-deploy URL |
| production | **B**: a new project | Production (deployed from `main`) | your production domain |
| CI E2E | **A** (test user only) | none | `localhost:3100` inside CI |

When a paid tier or a third project becomes available, give staging its own
project by pointing the Preview env vars and the `staging` environment's
`SUPABASE_DB_URL` at it.

### 1. E2E test account (enables the logged-in E2E specs)

1. Supabase (project **A**) → **Authentication → Users → Add user → Create new user**.
   Use an address you control, e.g. `you+e2e@gmail.com`, and a long random
   password. Tick **Auto Confirm User**.
2. GitHub → repo → **Settings → Secrets and variables → Actions → Secrets →
   New repository secret**. Add four:

   | Secret | Value |
   |---|---|
   | `E2E_USER_EMAIL` | the test user's email |
   | `E2E_USER_PASSWORD` | the test user's password |
   | `E2E_SUPABASE_URL` | project A URL (`https://<ref>.supabase.co`) |
   | `E2E_SUPABASE_PUBLISHABLE_KEY` | project A publishable key |

3. The next CI run should report `18 passed` in the e2e job instead of
   `12 passed, 6 skipped`.

Use this account only for tests. The specs log in and read its jobs list.

### 2. Production Supabase project (B)

1. supabase.com → **New project**. Pick the same region as project A and save
   the database password in a password manager.
2. Create the schema. Either:
   - **SQL Editor**: run every file in `supabase/migrations/` in filename
     order, or
   - from your own terminal, with the **Session pooler** connection string
     (Supabase → **Connect** → Session pooler, with your password filled in):
     ```bash
     npx supabase@2.117.0 db push --db-url "postgresql://postgres.<ref>:<password>@<pooler-host>:5432/postgres"
     ```
3. **Authentication → URL Configuration**: set **Site URL** to the production
   domain and add `https://<production-domain>/**` to the Redirect URLs.
4. In project **A**, add these Redirect URLs for staging:
   `https://<STAGING_ALIAS>/**` and `https://*-<your-vercel-team-slug>.vercel.app/**`.

### 3. Vercel project

The pipelines deploy with the Vercel CLI, so GitHub Actions decides what
ships and when. **Don't connect the GitHub repo in Vercel**, or Vercel would
deploy every push a second time and skip the approval gate. If it's already
connected, go to Vercel → Project → **Settings → Git** and disconnect it.

1. In the project folder:
   ```bash
   npx vercel@59.17.0 login
   npx vercel@59.17.0 link        # "Link to existing project?" No → create one
   ```
   This writes `.vercel/project.json` (gitignored) with `orgId` and
   `projectId`.
2. Vercel → Project → **Settings → Environment Variables**. Add each variable
   below with the right environment ticked:

   | Variable | Production | Preview (staging) |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | project B URL | project A URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | project B key | project A key |
   | `NEXT_PUBLIC_SITE_URL` | `https://<production-domain>` | `https://<STAGING_ALIAS>` (or leave unset) |
   | `GEMINI_API_KEY` | ✓ | ✓ |
   | `NVIDIA_API_KEY` | ✓ | ✓ |
   | `GROQ_API_KEY` (optional) | ✓ | ✓ |
   | `TAVILY_API_KEY` (optional) | ✓ | ✓ |

   Mark the API keys **Sensitive**. Do **not** add `SUPABASE_SERVICE_ROLE_KEY`:
   the app doesn't use it, and SECURITY.md keeps service-role access out of
   the web app.
3. Vercel → **Account Settings → Tokens → Create**. Scope it to the team that
   owns the project and give it an expiry.
4. (Recommended) Vercel → Project → **Settings → Deployment Protection →
   Protection Bypass for Automation → Generate**. This lets the post-deploy
   smoke test open protected Preview URLs. Without it, the staging smoke test
   is skipped with a warning.

### 4. GitHub secrets, variables and environments

Repo → **Settings → Secrets and variables → Actions**:

| Kind | Name | Value | Scope |
|---|---|---|---|
| Secret | `VERCEL_TOKEN` | token from step 3.3 | repository |
| Variable | `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` | **repository** |
| Variable | `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` | **repository** |
| Secret | `VERCEL_AUTOMATION_BYPASS_SECRET` | from step 3.4 (optional) | repository |
| Variable | `STAGING_ALIAS` | e.g. `ai-job-agent-staging.vercel.app` (optional; must be unclaimed) | repository |
| Variable | `PRODUCTION_URL` | e.g. `https://yourdomain.com` (optional; the production smoke test uses it) | repository |

`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` must be **repository** variables. The
check that decides whether to deploy at all runs before an environment's own
variables load.

Repo → **Settings → Environments**:

1. **New environment → `staging`**. No protection rules are needed.
2. **New environment → `production`**:
   - **Required reviewers**: add yourself. This is the manual approval gate
     (free for public repos).
   - Leave **Prevent self-review** off while you're the only reviewer.
   - **Deployment branches and tags → Selected branches → add `main`**.

### 5. Automated database migrations (optional, per environment)

Off by default. Until you enable it, apply new migrations by hand in the SQL
Editor before merging, as you have been doing.

Migrations so far were applied by hand, so Supabase's migration history is
empty and `db push` would try to re-run all of them. Mark them as applied
once, **only on projects where you ran them by hand**. That's project A. Skip
project B if step 2 used `db push`.

From your own terminal (never paste the connection string anywhere else):

```bash
npx supabase@2.117.0 migration repair --status applied \
  20260706130000 20260707030000 20260714000000 20260714010000 20260714020000 \
  20260914000000 20260914010000 20260914020000 20260915000000 \
  --db-url "<project A session-pooler connection string>"

npx supabase@2.117.0 db push --dry-run --db-url "<same string>"
# expect: "Remote database is up to date."
```

If more migrations were added since this was written, include every
`supabase/migrations/` version you have already applied.

Then, for each GitHub environment (`staging` → project A, `production` →
project B):

| Kind | Name | Value |
|---|---|---|
| Secret | `SUPABASE_DB_URL` | that project's **Session pooler** connection string (IPv4; GitHub runners can't reach the IPv6-only direct host) |
| Variable | `SUPABASE_DB_PUSH` | `true` |

After that, each deploy runs `supabase db push` **before** deploying the new
code. Keep migrations backward-compatible (add columns first, drop them in a
later release), because the old code keeps serving during a deploy and a
rollback doesn't undo SQL.

### 6. Branch protection (plan Task 0.1)

Repo → **Settings → Branches** (or **Rules → Rulesets**). Add a rule for
`dev` and one for `main`:

- Require a pull request before merging.
- Require status checks to pass: `lint`, `typecheck`, `unit-test`, `build`,
  `e2e`. They appear in the list after they've run once.
- Block force pushes.

---

## Day-to-day flow

1. Branch off `dev`, commit, push, and open a PR into `dev`. CI runs.
2. Merge when CI is green. **Deploy staging** starts on its own. The run's
   summary shows the URL, and the smoke test runs against it.
3. When staging looks right, open a PR `dev → main` and merge it.
4. **Deploy production** starts and waits. Actions tab → the run →
   **Review deployments → Approve**. It then checks config, migrates (if
   enabled), deploys and smoke-tests production.

### Rolling back

Vercel → Project → **Deployments** → pick the last good production deployment
→ **⋯ → Instant Rollback**, or run `npx vercel@59.17.0 rollback`. That swaps
the code only; database changes stay.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Deploy workflows show "skipped" | `VERCEL_PROJECT_ID` repository variable not set (step 4). |
| "Config check failed" in a deploy | A Vercel env var is missing or still a placeholder. The log names it (never the value). Fix it in Vercel (step 3.2) and re-run. Run `npm run check:env` to check `.env.local` locally. |
| "…is behind Vercel Deployment Protection … smoke test skipped" | Add `VERCEL_AUTOMATION_BYPASS_SECRET` (step 3.4). |
| e2e job: "6 skipped" | The E2E secrets aren't set (step 1). Expected until then. |
| e2e job fails | Download the `playwright-report` artifact from the run, unzip it, and run `npx playwright show-report <folder>`. It has traces, screenshots and video of the failure. |
| `npm ci` fails in CI with missing `@emnapi/*` after you installed a package on Windows | Windows npm drops Linux-only lockfile entries. Regenerate the lockfile with Linux npm: `docker run --rm -v "$PWD:/app" -w /app node:22 npm install --package-lock-only`, then commit it. |
| `db push` wants to re-run old migrations | The history repair (step 5) wasn't run for that project. |
