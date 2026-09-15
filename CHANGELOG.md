# Changelog — Agent-Driven Work Log

Running record of every change made to this repo across agent sessions, kept in commit order. See `AUDIT_AND_ROADMAP.md` for the full narrative audit and `SECURITY.md` for the standing security rulebook — this file is the terse, chronological "what changed and when."

---

## 🔴 Human Intervention Needed (always check this first)

| # | Item | Why it can't be done from an agent session | Status |
|---|---|---|---|
| 1 | Rotate the `GROQ_API_KEY` in the Groq console | Only console access can rotate it | ✅ **Done** (user-confirmed) |
| 2 | Apply `supabase/migrations/20260914000000_avatars_bucket_and_storage_fixes.sql` in the Supabase SQL Editor | Migrations here are applied manually, no CLI/MCP access from agent sessions | ✅ **Done** (user-confirmed, avatar upload works live) |
| 3 | Manual two-account cross-tenant test (plan's Phase 1 gate) | Needs two real accounts against a live Supabase project | ✅ **Done** (user-confirmed, no leakage found) — see Session 7 |
| 4 | Open + merge the two pending PRs (`phase1/1.3-...`, `phase2/2.1-...`) | Needs GitHub UI access | ✅ **Done** — see Session 7 for a process note on where PR #5 landed |
| 5 | Link the Supabase CLI (`supabase link`) if you want `supabase db push` instead of hand-pasting SQL for future migrations | Needs your Supabase access token, which shouldn't be handled in chat | **Optional**, offered, not started |
| 6 | Decide when to merge `dev` into `main` again | Release decision | **Your call** — `main` is missing everything since Session 9 |
| 7 | Change the GitHub default branch from `main` to `dev` | Needs repo-admin access | ✅ **Done** (confirmed via GitHub API on 2026-09-15) |
| 8 | Apply `jobs` + repair migrations (`20260914010000`, `20260914020000`) | Manual migrations | ✅ **Done** (user-confirmed `board_token` present) |
| 9 | Apply `supabase/migrations/20260915000000_jobs_classified_at.sql` **before** merging PR for Session 13 | Manual migrations; the new code reads `classified_at` and the jobs page will error without it | **Open** |
| 10 | Merge the Session 13 PR (`phase2/2.3-retry-and-nim-model-fix` → `dev`) | Needs GitHub UI; keeps your CodeRabbit review step | **Open** |
| 11 | Merge the Session 14 PR (`phase0/0.3-e2e-and-0.4-deploy-pipelines` → `dev`) **after** #10 | Stacked on the Session 13 branch; needs GitHub UI | **Open** |
| 12 | Create an E2E test user + 4 `E2E_*` GitHub secrets (`docs/DEPLOYMENT.md` step 1) | Needs your Supabase dashboard + repo admin | **Open**; until then the 6 logged-in specs skip |
| 13 | Vercel project, env vars, token; GitHub vars/secrets; `staging` + `production` environments with you as required reviewer (`docs/DEPLOYMENT.md` steps 2–4) | Account creation and secrets can't be done from agent sessions | **Open**; deploy workflows stay *skipped* until then |
| 14 | (Optional) One-time `supabase migration repair` + `SUPABASE_DB_URL`/`SUPABASE_DB_PUSH` to automate migrations (`docs/DEPLOYMENT.md` step 5) | Needs your database password | **Optional**; supersedes row 5 |
| 15 | Branch protection on `dev` and `main` with required checks `lint`, `typecheck`, `unit-test`, `build`, `e2e` (`docs/DEPLOYMENT.md` step 6) | Repo admin | **Open** (plan Task 0.1) |

---

## Session 1 — Audit & Security Baseline (2026-09-14)

**Branch:** `dev` (direct commits, docs-only)

- Audited the full codebase against `project (1).md`. Wrote `AUDIT_AND_ROADMAP.md` (phase-by-phase status, 9 concrete flaws with file/line evidence) and `SECURITY.md` (standing rulebook).
- Linked `SECURITY.md` from `.agents/AGENTS.md` (the file agents actually load for repo instructions).

Commits: `docs: add security audit, roadmap, and security rulebook; sanitize .env.example` (`6afa8bd`), plus a pre-existing pending UI fix committed alongside it (`0d005e6`).

## Session 2 — Phase 0.5 Stabilization Sprint

**Branch:** `phase0.5/stabilization-sprint` → merged to `dev` via PR #4

Fixed 9 flaws from the audit, plus 2 more found while fixing them:

| Fix | Commit |
|---|---|
| Avatars bucket created with correct RLS; avatar upload no longer falls back to base64-in-DB | `5bfabc4` |
| Resume files served via signed URLs instead of broken public URLs on a private bucket | `5bfabc4` |
| Magic-byte file validation on both upload routes (closes a stored-XSS gap) | `5bfabc4` |
| `pdf-parse` v2 API usage fixed (was silently failing on every PDF since the v1→v2 bump) | `5bfabc4` |
| `middleware.ts` renamed to `proxy.ts` (Next.js 16 deprecated the old convention) | `c2e98ef` |
| Profile `PATCH` no longer silently drops fields on schema errors | `b345d2f` |
| Untrusted resume text delimited against prompt injection in the Gemini prompt | `3d9683f` |
| Service-role Supabase client locked out of `app/api/**` via an ESLint rule | `7001e80` |
| Pre-existing lint debt (23 errors) cleaned up so a lint-gated CI could exist | `7001e80` |
| CI pipeline stood up: lint, typecheck, unit-test, build; Vitest added with first unit tests | `d80afe0` |

**`.env.example`** sanitized (real-looking Groq key replaced with a placeholder — **the real key still needs rotating, see table above**) and `.gitignore` fixed so the sanitized template can actually be committed.

## Session 3 — CI Debugging

**Branch:** `dev` (direct commits — infra fixes)

CI was failing on every job. Diagnosed with GitHub's check-runs API and a local Docker reproduction of the exact runner environment (Node 22, npm 10, Linux):

- `ci.yml` node-version bumped 20→22 (`6cc4a38`) — turned out not to be the root cause, but a real deprecation warning worth fixing anyway.
- **Actual root cause:** `package-lock.json`, generated locally with npm 11 on Windows, was missing two optional transitive entries (`@emnapi/core`, `@emnapi/runtime`) that npm 10 requires strictly, so `npm ci` failed in under a second on every job before lint/typecheck/tests ever ran. Regenerated the lockfile inside a Node 22/npm 10/Linux container to match CI exactly, verified a fresh `npm ci` passed there, then confirmed Windows-local lint/typecheck/tests/build still all passed too (`f9c177c`).
- Confirmed via GitHub's API: all 4 CI jobs green on the resulting commit.

## Session 4 — Runtime Bug: Avatar Upload

You hit `StorageApiError: Bucket not found` testing avatar upload live. Root cause: the `avatars` bucket migration was written but never applied to your actual Supabase project (migrations here are applied by hand, not via CLI). Gave you the exact SQL and instructions; you took ownership of running it.

**While investigating, found and fixed a second, previously-undiscovered bug** on a new branch: `app/api/profile/avatar/route.ts` was reading and writing a `profiles.parsed_data` column that has never existed in any migration (only `resumes.parsed_data` does) — so even after the bucket exists, the avatar upload would have failed a second time on the database write. Fixed in `d0de2ce`.

## Session 5 — Phase 1.3: Resume-Parsing Confidence Scores

**Branch:** `phase1/1.3-resume-confidence-scores` (pushed, PR not yet opened/merged)

Closed the last open requirement of plan Task 1.3 ("per-field confidence score, low-confidence fields pre-flagged and editable"):

- `d0de2ce` — the `profiles.parsed_data` bug fix from Session 4 (committed on this branch).
- `777d277` — Gemini now scores 10 top-level resume fields 0.0–1.0 at extraction time. New `lib/resume/confidence.ts` normalizes/validates the score map and defines the 0.6 low-confidence threshold in one place. Profile editor shows a "Please verify" badge on each section when its score is below threshold. 14 new unit tests.
- `a9f60fa` — docs updated to reflect completion.

## Session 6 — Tracking + Phase 2.1: ATS Adapter Interface

**Branch:** `phase2/2.1-ats-api-integration` (pushed, PR not yet opened/merged) — cut from `dev`, so it does **not** yet include Session 5's still-unmerged confidence-score work; the two branches touch entirely different files and won't conflict when both eventually merge.

- Added this `CHANGELOG.md` (`98eead5`, on `dev`).
- Plan Task 2.1 (ATS API Integration) — only the part that needs no live credentials, since Greenhouse's Job Board API is public:
  - `lib/ats/types.ts` — the `ATSAdapter` interface every platform implements, plus placeholder `Job`/`Profile`/`SubmissionResult` shapes to be fleshed out in Phase 3/5.
  - `lib/ats/registry.ts` — platform registry + `detectPlatform(url)`; orchestration code will look adapters up here, never import one directly.
  - `lib/ats/adapters/greenhouse.ts` — real implementation: fetches a company's open jobs from the public Greenhouse Job Board API, maps the response, handles 404/429/other errors with clear messages. `submitApplication` is a documented not-yet-implemented stub (genuinely Phase 5 scope) that returns a `failed` result with an explanation — it does not pretend to succeed.
  - 14 tests: response mapping, mocked-HTTP error handling, and a contract test that automatically covers every adapter registered in the registry.
  - Along the way: configured ESLint to respect the leading-underscore "intentionally unused parameter" convention (needed for the `submitApplication` stub's unused args), and gitignored `supabase/.temp/` on this branch too (same fix as `dev`, this branch predates that commit).
- **Not done yet** (explicitly out of scope for this task, follow-up per the plan's own Task 2.2–2.5 breakdown): Lever and Workable adapters, persisting fetched jobs to a `jobs` table (no such table exists yet), company token discovery, caching/rate limits, job classification, and any UI. None of this was skipped by oversight — it's the next slice of Phase 2, not part of Task 2.1's adapter-interface deliverable.

## Session 7 — Phase 1 Gate Cleared + dev/main Reconciliation

You completed items 1–4 above yourself: rotated the Groq key, applied the avatars migration (confirmed working live), ran the two-account cross-tenant test with no leakage found, and merged both pending PRs on GitHub.

**Process note worth knowing for next time:** PR #5 (`phase1/1.3-resume-confidence-scores`) got merged with base **`main`** instead of `dev` — probably GitHub defaulting the PR's base branch rather than it being changed on purpose. PR #6 (`phase2/2.1-ats-api-integration`) correctly merged into `dev`. Net effect: `main` ended up with both features, but `dev` was missing the confidence-score work. **When opening a PR, double-check the base branch reads `dev`, not `main`** — your own `.agents/AGENTS.md` workflow already says all work should land on `dev` first.

Fixed by merging `origin/main` back into `dev` (clean merge, no conflicts — the two PRs touched entirely different files) (`fdb2460`). Verified after merging: lint (0 errors), typecheck (clean), all 43 tests passing, production build clean, CI green on the push.

**Phase 1 (Foundation & Security) is now complete** — every item in Task 1.1–1.4 is done and the plan's Phase 1 gate (two-account test) has passed. Tagged `v1.0-phase1-complete` and pushed (`4204f0f` on `dev`).

## Session 8 — Phase 2.1 Complete: Lever + Workable Adapters

**Branch:** `phase2/2.1-lever-workable-adapters` (pushed, PR not yet opened/merged)

Completed Task 2.1 (ATS API Integration) — the two remaining plan-specified platforms, both using their public job-board APIs, no credentials needed:

- `lib/ats/adapters/lever.ts` — maps Lever's public Postings API response; `createdAt` (the only timestamp Lever's public endpoint exposes) used as `updatedAt`, documented as actually being creation time.
- `lib/ats/adapters/workable.ts` — maps Workable's public widget API response; unlike Greenhouse/Lever, this one *does* return a real company display name, used directly. Full job descriptions aren't in the list response (only the per-job detail endpoint has them) — left `undefined` rather than firing N extra requests per board on every ingestion pass, noted inline.
- Both registered in `lib/ats/registry.ts` alongside Greenhouse.
- 19 new tests; the registry's contract test now automatically covers all 3 adapters. 64 tests total in the suite.

Task 2.1 is now fully done: interface, registry, and all three adapters the plan specifies.

## Session 9 — Task 2.4 (Job Classification) + Task 2.2 (Company Token Discovery)

Two deliberate, documented provider swaps this session, both because the plan's originally-specified providers weren't a good fit for a cost-conscious solo build:

- **NVIDIA NIM instead of Anthropic Claude** for Task 2.4. NIM has a free tier and an OpenAI-compatible API (same shape Groq already uses in this repo).
- **Tavily instead of Brave Search** for Task 2.2. Brave's free tier requires a card on file; Tavily's doesn't.

**Branch `phase2/2.4-job-classification-pipeline`** (pushed, cut from `dev` before Session 8 merged, so it doesn't include Lever/Workable — no conflict, different files):
- `lib/ai/nvidia.ts` — OpenAI-compatible NIM client, mirrors `lib/ai/groq.ts`.
- `lib/jobs/types.ts` / `lib/jobs/classify.ts` — the three classification enums (experienceLevel/employmentType/workMode) as runtime-checkable const arrays, and `classifyJob()`. Any field the model can't determine, or hallucinates a value outside the fixed enum for, comes back `null` — never guessed. 14 new tests.
- Establishes `lib/jobs/` as the start of the plan's `jobs-matching` domain, separate from `lib/ats/` (fetching).

**Branch `phase2/2.2-company-token-discovery`** (pushed) — this one *does* need Lever/Workable registered (its Workable-subdomain-token test needs all three adapters), so `phase2/2.1-lever-workable-adapters` was merged into it first, cleanly, no conflicts:
- `lib/search/types.ts` — a `SearchProvider` interface, same swappable-adapter reasoning as `ATSAdapter`.
- `lib/search/providers/tavily.ts` — real implementation.
- `lib/ats/curated-companies.ts` — the curated-list structure, deliberately left empty (Task 2.5's job to seed with verified real companies — a wrong guessed token is worse than no data).
- `lib/ats/discovery.ts` — `discoverCompanyToken()`: curated list first, then search, then extracts a candidate token from each result URL and verifies it with a real call through the existing ATS adapters before accepting it — exactly the plan's "verify token via a live test API call" requirement. A result that fails verification is skipped, not fatal. 15 new tests.

**New env vars needed** (documented in `.env.example`, not yet in your `.env.local`): `NVIDIA_API_KEY` (from build.nvidia.com), `TAVILY_API_KEY` (from tavily.com). Neither is needed for anything already merged — only once these two branches land and get wired into a live ingestion flow.

## Session 10 — dev/main Reconciliation (again)

Same issue as Session 7: PR #8 (`phase2/2.2-company-token-discovery`, which also carried the Lever/Workable adapters merged inside it) landed on **`main`** instead of `dev`, while PR #9 (job classification) correctly landed on `dev`. Net effect: `main` had discovery + Lever/Workable, `dev` had job classification, neither had both.

Fixed the same way as before: merged `origin/main` into `dev`. One conflict this time, in `.env.example` (both sides had added a different new env var section) — resolved by keeping both additions (`NVIDIA_API_KEY` and `TAVILY_API_KEY`). Verified after merging: lint (0 errors, 2 known warnings), typecheck clean, all 93 tests passing, production build clean (`641c4e1`).

**Confirmed via GitHub API:** the repo's default branch is indeed set to `main` (`default_branch: "main"`). That's the actual root cause of both Session 7's and this session's divergence — recommended the user change it in **Settings → General → Default branch** to `dev`. Not something this session can do without repo-admin access.

## Session 11 — Task 2.3: Job Ingestion Pipeline (jobs/companies schema amended, then wired end to end)

**Branch `phase2/2.3-2.5-jobs-companies-schema`** (pushed, not yet merged):

Before writing the ingestion pipeline, caught a real gap in the Session 10 schema — no way to know which board token a job came from, which both caching and dedup genuinely need. Since that migration hadn't been applied by the user yet, amended it directly (new commit, not a history rewrite, since the branch was already pushed) rather than layering a patch on top of something not yet live:
- Added a `board_token` column.
- Switched the dedupe unique index from the plan's literal "company+title+location" text match to `(user_id, job_url)` — every adapter already provides a stable, unique-per-posting URL, and Supabase's REST upsert can only target a plain-column unique constraint anyway (the original `lower(...)`-expression index wouldn't have worked with `on_conflict=`).
- Added a `(user_id, platform, board_token, fetched_at)` index for the cache-freshness lookup.

Then built the pipeline itself, making `/dashboard/jobs` show real data for the first time:
- `lib/jobs/concurrency.ts` — `mapWithConcurrency()`, a ~15-line dependency-free concurrency limiter. Caps simultaneous NVIDIA NIM classification calls per board (default 3) instead of firing one unbounded request per job.
- `lib/jobs/ingest.ts` — `isRecentlyFetched()` (Task 2.3's 6-hour cache check, exported standalone so it's testable in isolation) and `ingestJobsForCompany()` (cache check → adapter fetch → bounded-concurrency classification → upsert). A job whose classification call fails gets a null/unclassified result, not a failed batch.
- `app/api/jobs/route.ts` (GET, list) and `app/api/jobs/ingest/route.ts` (POST, trigger) — `requireUser()` gate, input validation, and an interim rate limit (15 new boards/user/hour), same reasoning as the resume-upload limit.
- `components/dashboard/jobs-list-view.tsx` replaces the `BlankPage` placeholder — a "track a company" form (platform + board token; no discovery/curated-list UI exists yet, so this is manual entry for now) plus a list of ingested jobs with classification badges and an apply link.
- `types/database.ts` — added `jobs`/`companies` table types (note: this repo's `Database` type isn't threaded through the Supabase client anywhere yet, a pre-existing gap unrelated to this change).
- 21 new tests, including a real timing-based test that verifies the concurrency cap actually holds.

**Explicitly not done, not oversights:** Task 2.2's discovery flow (Tavily search) isn't wired into this UI yet — users type a board token by hand. And this all runs synchronously inside the API route rather than via Inngest, the plan's specified background-job runner, which isn't set up anywhere in this repo yet — a board with many postings means a slower request, not a queued background job.

**Mid-session merge note:** PR #10 for this branch got merged into `dev` (as `b32ea2a`) while the branch still only had its first commit — before the `board_token` fix and the ingestion pipeline itself were pushed. `dev` briefly had the incomplete schema (no `board_token`, the unusable `lower(...)`-expression dedupe index) and none of the pipeline code. Merged the branch's remaining two commits (`707a979`, `ca2c6ee`) directly into `dev` to close the gap — clean merge, no conflicts, since `dev`'s version of the migration file was a strict ancestor of the branch's later edits. Re-verified after merging: lint clean, typecheck clean, all 109 tests passing, build clean, pushed as `6ab7dab`.

## Session 12 — Repair Migration for the jobs Schema

Because PR #10 merged the first revision of `20260914010000_jobs_and_companies_schema.sql` before the `board_token` fix, a database could be in either state depending on when the file was applied. Re-running the corrected file doesn't fix an old-revision database — tested: it fails outright with `policy "companies_select_all" for table "companies" already exists`, since Postgres policies have no `if not exists`.

Added `supabase/migrations/20260914020000_jobs_board_token_repair.sql` — an idempotent follow-up that adds `board_token` (backfilled from `company` for any existing rows), drops and recreates `jobs_dedupe_idx` as `(user_id, job_url)`, and adds the cache-lookup index.

Verified against a real Postgres 16 + pgvector container (with stubs for Supabase's `auth` schema), every scenario ending in the same correct schema:

| Scenario | Result |
|---|---|
| Old revision → repair | ✅ fixed |
| Old revision + an existing row → repair | ✅ fixed, row backfilled |
| Corrected revision → repair | ✅ no-op |
| Repair run twice | ✅ idempotent |
| Old revision → corrected revision, no repair | ❌ errors (the trap this file avoids) |

Also confirmed the ingestion code's `ON CONFLICT (user_id, job_url)` upsert updates an existing row rather than duplicating it.

**How to apply** (Supabase SQL Editor): if the jobs migration has never been run, run `20260914010000_jobs_and_companies_schema.sql` first. Then run `20260914020000_jobs_board_token_repair.sql` — safe regardless of which revision is live.

---

## Session 13 — Making the Pipeline Work on Real Data

The user applied the Session 12 migrations and set `NVIDIA_API_KEY`. Before building anything new, verified the pipeline against the real services — and it didn't work.

**Bug 1 — the classification model was retired.** One real API call returned `410 Gone`: `meta/llama-3.3-70b-instruct` reached end of life on 2026-08-26. Because ingestion caught classifier errors, every job would have been saved untagged with no error shown. Listed the account's models and tested candidates with the real prompt; the 70B Llama/Mistral models are listed but return 404 for this account.

| Model | Explicit posting | Vague posting | Reliability (6 calls) | Avg latency |
|---|---|---|---|---|
| `nvidia/nemotron-3-super-120b-a12b` | ✅ correct | ✅ all null | 5/6 (one transient 503) | ~3s |
| `openai/gpt-oss-20b` | ✅ correct | ✅ all null | 6/6 | ~7.6s |

Now primary + fallback, overridable with `NVIDIA_CLASSIFICATION_MODEL`.

**Bug 2 — real boards are much bigger than assumed.** Probed 12 live Greenhouse boards (all HTTP 200): Discord 44 jobs, Dropbox 39, Figma 158, Airbnb 161, Stripe 632, Cloudflare 356, Anthropic 596, Databricks 891, among others. A real classification takes 5–20s. The old design classified a whole board inside one request (many minutes for Stripe) and re-classified every job on each 6-hour refresh, against the plan's "never recomputed" rule.

**What changed** (branch `phase2/2.3-retry-and-nim-model-fix`, three commits, each green on its own — 122 → 139 → 149 tests):
- `lib/http/retry.ts` — `HttpError`, exponential backoff with cap and jitter, `withRetry`. This is Task 2.3's "exponential backoff on 429/5xx", now applied to the NIM client and all three job-board adapters. 404/410 fail fast.
- Classifier: model fallback chain, retries on transient errors, throws when every model fails (so the failure is counted and shown), plain-text descriptions capped at 6,000 characters instead of escaped HTML.
- Migration `20260915000000_jobs_classified_at.sql` — tracks which jobs are tagged, so a posting the model correctly left null isn't re-sent forever.
- Ingestion saves all jobs first (chunks of 100), then tags up to 12 pending jobs per request, stopping new calls after 35s. Re-fetches never touch tag columns.
- Jobs page: "Tag more" button, "Not tagged yet" badge, failure warning.
- `/api/jobs` no longer ships every job's ~8.7 KB description to the browser.

**Verified against real systems, not only mocks:**
- Real pipeline code on Discord's live board + real NIM: 44 jobs fetched, 6 classified with no errors, plausible tags (manager/director roles → 5+ / Full-time; "Remote" location → Remote; unstated work mode → null).
- Migration chain old → repair → `classified_at` → `classified_at` again on Postgres 16 + pgvector: applies cleanly and idempotently.
- Real PostgREST: re-saving a tagged job with a new title kept `5+ / Full-time / Remote` and its `classified_at`; a new job arrived pending.

---

## Session 14 — E2E Browser Tests and Deploy Pipelines (Plan Tasks 0.3–0.5)

Branch `phase0/0.3-e2e-and-0.4-deploy-pipelines`, stacked on the Session 13 branch. Two code commits, each verified on its own, plus this docs commit. Full setup and usage guide: **`docs/DEPLOYMENT.md`**.

**E2E (0.3), commit `d8011a3`:**
- Playwright 1.63 + Chromium. `npm run test:e2e` (starts a dev server on port 3100), `test:e2e:ui`, and `test:e2e:smoke` (public specs only).
- `e2e/public`: landing, `/login`, `/signup` and `/forgot-password` render; all 4 dashboard pages redirect logged-out users to `/login?next=…`; `GET /api/jobs`, `POST /api/jobs/ingest`, `GET /api/profile` and `GET /api/resumes` return 401. These pin `proxy.ts` as the single auth gate and need no real Supabase.
- `e2e/authenticated`: real login and a real `/api/jobs` 200. The jobs page flow runs with the jobs APIs mocked in the browser (fetch → "Tagged 12, 18 still untagged" → Tag more → fully tagged; failure warning; typed token kept on a 502), so it's deterministic and spends no NVIDIA credits. Skips unless `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` and a real Supabase URL are set.
- The CI workflow gained an `e2e` job (production build, then `next start`), so "CI succeeded" now includes browser tests. The deploy workflows rely on that.
- The lockfile was regenerated with Linux npm 10 in Docker, because Windows npm drops the `@emnapi/*` entries that CI's `npm ci` needs. Verified with a clean `npm ci` in `node:22`.

**Deploy pipelines (0.4/0.5), commit `4c2ce91`:**
- `deploy-staging.yml`: after CI passes on a push to `dev`, deploys a Vercel Preview build, with an optional stable alias via `STAGING_ALIAS`.
- `deploy-production.yml`: after CI passes on `main`, pauses for approval in the `production` GitHub environment, then deploys with `--prod`.
- `_deploy.yml` (shared): `vercel pull`, then a fail-fast config check, opt-in `supabase db push`, `vercel build` and `vercel deploy --prebuilt`, and finally the public Playwright specs against the deployed URL, using Vercel's protection-bypass header when configured.
- Safety:
  - Deploys are skipped until `VERCEL_PROJECT_ID` exists.
  - Only push-triggered CI runs from this repo can deploy, so code from a fork PR never runs next to `VERCEL_TOKEN`.
  - Workflow inputs reach the shell only through env vars (GitHub's script-injection guidance).
  - The Vercel and Supabase CLIs are pinned (59.17.0 / 2.117.0).
- `scripts/check-env.mjs` (`npm run check:env`) rejects:
  - missing or placeholder values;
  - any `NEXT_PUBLIC_*SECRET/SERVICE_ROLE/PRIVATE*` variable;
  - a secret or service-role key sitting in the publishable/anon slot.

  It accepts Vercel "Sensitive" variables, which pull as empty, for server-only names. It prints variable names only.
- Free-tier environment mapping: Supabase project A serves dev and staging, a new project B serves production, and Vercel Preview acts as staging. Rationale is in `docs/DEPLOYMENT.md`.

**Verified:**
- Playwright locally in dev mode and CI mode (production build + `next start`): **12 passed, 6 skipped** (the logged-in specs, no credentials).
- Smoke mode (`E2E_BASE_URL` pointing at a separately started server): 12 passed with no server spawned.
- `actionlint` 1.7.12 with shellcheck on all 4 workflows: clean.
- `check-env.mjs` on 6 cases:
  - empty env and placeholder values: exit 1;
  - http `SITE_URL` in production, a `NEXT_PUBLIC_SERVICE_ROLE_KEY`, and a service-role JWT in the anon slot: exit 1, all 3 caught;
  - a good config and the real `.env.local`: exit 0.
- Supabase CLI 2.117.0 against a throwaway Postgres 16. Before the repair, `db push --dry-run` listed all 9 migrations. After `migration repair --status applied <9 versions>` it said "Remote database is up to date". This is the exact step-5 procedure, working with `--db-url` only (no `supabase link`, no access token).
- Lint: 0 errors; the 3 warnings are pre-existing, in other components. Typecheck clean. Vitest 149/149.

**Not verified here:** a real Vercel deploy and a real approval pause. There's no Vercel project or GitHub environment yet (rows 12–13). The first real run happens once you've done those steps.

---

## Current Repo State (as of this entry)

- `dev`: everything through Session 12. CI green.
- Open branches, merge in this order:
  1. `phase2/2.3-retry-and-nim-model-fix` (Session 13): **apply `20260915000000_jobs_classified_at.sql` first, then merge**.
  2. `phase0/0.3-e2e-and-0.4-deploy-pipelines` (Session 14): stacked on 1.
- `main`: missing everything since Session 9 — your call when to release.
- Phase 0 (Bootstrap): CI (0.2) done; E2E (0.3), CD (0.4) and the environments/config check (0.5) are built and verified locally, and go live once the manual setup in `docs/DEPLOYMENT.md` is done. Branch protection (0.1) is still a manual step.
- Phase 1 (Foundation & Security): **✅ complete**, tagged `v1.0-phase1-complete`.
- Phase 2 (Core Discovery): Tasks 2.1 and 2.4 done; 2.3 done once this PR merges (the one gap vs. the plan: no cross-user per-platform concurrency limit, which needs a job queue such as Inngest); 2.2's discovery logic exists but isn't wired into the UI; 2.5 has its schema but no seed data. The 12 board tokens probed live this session are a verified starting point for 2.5's curated list.
