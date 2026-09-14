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
| 6 | Decide when to merge `dev` into `main` again | `main` currently has everything `dev` has (reconciled in Session 7) — no action needed until the next round of feature branches | **Your call**, not urgent right now |

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

**Phase 1 (Foundation & Security) is now complete** — every item in Task 1.1–1.4 is done and the plan's Phase 1 gate (two-account test) has passed. Ready to tag `v1.0-phase1-complete`.

---

## Current Repo State (as of this entry)

- `dev` and `main`: **in sync**, both have everything through Session 7, CI green on both.
- No open feature branches — both prior PRs merged.
- Phase 1 (Foundation & Security): **✅ complete**, gate passed.
- Phase 2 (Core Discovery): started (ATS adapter interface + working Greenhouse adapter). Remaining for Phase 2: Lever/Workable adapters, company token discovery (Task 2.2), caching/rate limits (Task 2.3), job classification (Task 2.4), company metadata table (Task 2.5) — none of these need human intervention to build, only to eventually test against real ATS boards.
