# Changelog — Agent-Driven Work Log

Running record of every change made to this repo across agent sessions, kept in commit order. See `AUDIT_AND_ROADMAP.md` for the full narrative audit and `SECURITY.md` for the standing security rulebook — this file is the terse, chronological "what changed and when."

---

## 🔴 Human Intervention Needed (always check this first)

| # | Item | Why it can't be done from an agent session | Status |
|---|---|---|---|
| 1 | Rotate the `GROQ_API_KEY` in the Groq console | A real-looking key was found committed in `.env.example`; only console access can rotate it | **Open** |
| 2 | Apply `supabase/migrations/20260914000000_avatars_bucket_and_storage_fixes.sql` in the Supabase SQL Editor | No Supabase CLI link or MCP access in these sessions; migrations here are applied manually | You said you'd do this — **confirm once done** |
| 3 | Manual two-account cross-tenant test (plan's Phase 1 gate) | Needs two real accounts against a live Supabase project | **Open** — blocks tagging `v1.0-phase1-complete` and, per the plan, Phase 2 |
| 4 | Link the Supabase CLI (`supabase link`) if you want `supabase db push` instead of hand-pasting SQL for future migrations | Needs your Supabase access token, which shouldn't be handled in chat | **Optional**, offered, not started |
| 5 | Decide when to merge `dev` into `main` | `dev` is currently 19 commits ahead of `main`; merging to `main` is a release decision, not something to do unprompted | **Your call** |

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

---

## Current Repo State (as of this entry)

- `dev`: up to date with all sessions above, CI green.
- `main`: 19 commits behind `dev` — not touched by any agent session; merging is your call.
- Open branch: `phase1/1.3-resume-confidence-scores`, pushed, ready for a PR into `dev`. Auto-generated link: `https://github.com/Divyanshi018572/AI_Job_Application_Agent/pull/new/phase1/1.3-resume-confidence-scores`.
- Phase 1 (Foundation & Security) is functionally complete pending items #2 and #3 in the intervention table above.
