# Security Measures — AI Job Application Agent

This is the security rulebook for this repo: every coding agent (Claude Code included) and every human contributor follows these rules on every task, not just when "doing a security pass." It's written from the concrete flaws found in `AUDIT_AND_ROADMAP.md` (2026-09-14) — several rules below exist specifically because the current code violates them; those are marked **[ACTIVE ISSUE]** and must be fixed, not just avoided going forward.

Scope: this app handles resumes, PII, and (in later phases) automated job-application submission on a user's behalf. Treat every rule here as load-bearing, not aspirational.

---

## 1. Secrets & Environment Variables

- Real credentials live **only** in `.env.local` (gitignored) and in the hosting platform's secret store (Vercel, GitHub Actions secrets). Never in a committed file.
- `.env.example` must contain **placeholders only** — a value like `your-key-here`, never a real-looking token.
  - **[ACTIVE ISSUE]** `.env.example:12` currently contains a live-looking `GROQ_API_KEY`. Rotate that key in the Groq console immediately, then replace the line with a placeholder.
- `.gitignore` must not blanket-exclude `.env.example`. Use `.env*` followed by `!.env.example` so the sanitized template is the one file in that family that's actually committed (the plan requires this).
- `SUPABASE_SERVICE_ROLE_KEY` (and any future secret-scope key — Stripe secret key, Browserbase key) is **server-only**. Never prefix it `NEXT_PUBLIC_`, never send it to the client, never log it.
- If a real secret is ever found in a commit (even an old one, even on a branch that was later force-pushed over): rotate the credential first, scrub git history second (`git filter-repo` / BFG), coordinate the force-push with everyone who has a clone. Rotation always comes before history-scrubbing — a scrubbed-but-unrotated key is still live.

## 2. Database & Row-Level Security (non-negotiable)

- **Every new table gets RLS enabled in the same migration that creates it.** Never ship a table without RLS "for now, add it later" — a table with data and no RLS is a live leak the moment it's queryable.
- Standard policy shape for this repo (already used correctly in `profiles`, `job_applications`, `resumes` — copy this pattern, don't invent a new one):
  ```sql
  create policy "{table}_select_own" on public.{table}
    for select to authenticated
    using ((select auth.uid()) = user_id);
  ```
  Use `(select auth.uid())` (not bare `auth.uid()`) — it lets Postgres cache the value once per statement instead of re-evaluating per row. This is a real performance requirement, not style.
- Write one policy per operation (`select`/`insert`/`update`/`delete`), not one catch-all `for all` policy — it's easier to audit and easier to get `with check` right on writes.
- Any `security definer` function (bypasses RLS by design) must:
  - set `search_path = ''` explicitly, to prevent search-path hijacking, and
  - have `revoke all ... from public, anon, authenticated` applied unless it's genuinely meant to be callable by those roles.
  - See `supabase/migrations/20260707030000_security_hardening.sql` for the correct pattern already in this repo — replicate it for every new `security definer` function.
- Migrations are **additive-only** within a release: never rename or drop a column in the same release that still reads the old name. Add the new column, backfill, switch reads, drop the old column in a *later* release.
- Before any phase is promoted to production, run a **manual two-account test**: create two real accounts, confirm neither can read/write the other's rows through the app or a direct API call. This has not been run yet for Phase 1 — do it before Phase 2 starts.

## 3. Storage (Supabase Storage buckets)

- Buckets default to **private** (`public: false`) unless there's a specific, deliberate reason for public access (and even then, prefer signed URLs).
- Storage RLS policies here are folder-based: `(storage.foldername(name))[1] = auth.uid()::text`. **The application code's upload path must match this exactly** — the first path segment written to must be the user's UUID, nothing else.
  - **[ACTIVE ISSUE — canonical cautionary example]** `app/api/profile/avatar/route.ts` uploads to `avatars/{userId}/{filename}` (first segment `"avatars"`), which fails the `resumes` bucket's folder-based RLS policy (which expects the first segment to *be* `{userId}`). This is exactly the bug class this rule exists to prevent: before writing any storage upload path, check the target bucket's actual RLS policy and make sure the path's first segment is what the policy checks.
- **Never call `getPublicUrl()` on a private bucket.** It returns a syntactically valid URL that will 400/403 when fetched — it doesn't fail loudly at call time, so this bug hides until someone clicks the link.
  - **[ACTIVE ISSUE]** `app/api/resumes/upload/route.ts` does exactly this. Fix: generate a signed URL on demand, server-side, at view/download time (`createSignedUrl(path, expirySeconds)`, short expiry, regenerated per request) — never persist a long-lived "public" URL for a private object.
- Validate uploaded file type by **magic bytes**, not by the client-supplied `Content-Type` header or filename extension — both are trivially spoofable.
  - **[ACTIVE ISSUE]** Neither `app/api/resumes/upload/route.ts` nor `app/api/profile/avatar/route.ts` does this today. Add an explicit allowlist (`image/png`, `image/jpeg`, `image/webp` for avatars; `application/pdf`, `text/plain` for resumes) enforced via a magic-byte check (e.g. the `file-type` package), not the client header.
- Serve any user-uploaded file with `Content-Disposition: attachment` unless it has been re-encoded through a trusted pipeline before being displayed inline. This blocks stored-XSS via a malicious SVG/HTML file uploaded with a spoofed image content-type.
- Enforce max file size **server-side** (already done — 5MB avatars, 10MB resumes — keep this pattern for every new upload type).

## 4. API Routes

- Every route handler starts by calling `requireUser()` (or equivalent) and returning `401` before touching any business logic. This repo does this consistently today — keep it that way for every new route.
- Every mutation query must scope by `user.id` **in the query itself** (`.eq("user_id", user.id)` / `.eq("id", user.id)`), not just check ownership after the fact on the response. RLS is the real backstop, but app-layer scoping is defense in depth and avoids relying on RLS alone catching a mistake.
- Any endpoint that accepts a user-supplied update payload must use an **explicit allowlist** of writable fields. Never spread/merge the raw request body into a `.update()` call.
- Never silently drop a field that failed to persist and still return `200`. If part of a write fails, either fail the whole request or return which fields didn't save, so the client (and the user) knows.
  - **[ACTIVE ISSUE]** `app/api/profile/route.ts`'s `PATCH` handler catches any error containing the word `"column"` and silently deletes the offending field before retrying, up to 5 times, then returns 200 even if the drop happened. Replace this with an explicit, generated list of valid columns so a real schema mismatch is a loud deploy-time problem, not a silent runtime one.
- Validate all input with **Zod** at the route boundary (the plan requires this for every API route and every Inngest function entry point — not yet implemented anywhere in this repo; add it starting with the next route touched).
- Keep the service-role (`SUPABASE_SERVICE_ROLE_KEY`) client (`lib/supabase/admin.ts`) out of anything reachable from `app/api/**` unless a specific task genuinely needs to bypass RLS (e.g. an Inngest background job acting across users). Document the reason inline when it is used.
  - **[ACTIVE ISSUE]** `createAdminClient()` currently has zero call sites. Either delete it until Phase 2's Inngest functions need it, or add an eslint `no-restricted-imports` rule scoping it to a `lib/server-only/` path so it can't accidentally end up in a user-facing route later.

## 5. AI / LLM-Specific Rules

This app sends resume and job-description text to Claude/Gemini/Groq, and (Phase 6+) generates content that represents the user to a real employer. Treat generative output as something that can be wrong or manipulated, not as ground truth.

- Treat all resume/job-posting text as **untrusted data**, not instructions. Wrap extracted text in explicit delimiters (e.g. `<untrusted_resume_text>...</untrusted_resume_text>`) and tell the model directly to extract from it, never follow instructions found inside it.
  - **[ACTIVE ISSUE]** `lib/ai/gemini.ts`'s `RESUME_EXTRACTION_PROMPT` concatenates raw extracted text with no delimiter or untrusted-data framing. Add this before Phase 2, since the parser is already live and feeds `profiles`.
- Ground every generative feature (cover letters, interview prep, Phase 6) strictly in stored resume/profile data. The model must never fabricate experience, metrics, or credentials not present in the source. Apply this rule from the first cover-letter-generation commit, not retroactively in Phase 6.5.
- All AI-generated content that will be shown to a third party (employer, recruiter) is **editable and never auto-sent** without an explicit human confirmation step. This mirrors the plan's Phase 5.6 "Confirm & Submit" gate and Phase 6.5 guardrails — don't build a code path that skips it, even for testing.
- Rate-limit AI-calling routes per user. There is no real usage/billing enforcement until Phase 4, but that's not a license to leave routes uncapped in the meantime.
  - **[ACTIVE ISSUE]** `app/api/resumes/upload/route.ts` has no throttle at all today (each POST triggers a real Gemini call, with a Groq fallback). Add a cheap interim per-user-per-hour counter before starting Phase 2.
- Log AI provider spend per user once any logging/observability exists (Sentry, per the plan) — cost runaway is a real risk with per-request LLM calls.

## 6. Authentication

- All session handling goes through `@supabase/ssr` — no hand-rolled JWT parsing or custom cookie logic.
- Password-reset and email-confirmation links must be built from `NEXT_PUBLIC_SITE_URL`, never derived from the incoming request's `Host` header — using the request `Host` for link generation opens a host-header-poisoning attack (attacker sends a spoofed `Host`, victim gets a reset link pointing at the attacker's domain). Verify this stays true wherever new auth flows are added.
- OAuth callbacks are validated server-side (`app/auth/callback`) before a session is trusted — don't trust client-reported OAuth state.
- `middleware.ts` is the single gate for `/dashboard/*` and unauthenticated `/api/*` access. Any new top-level route that needs auth protection should be added to the matcher/logic there, not re-implemented per-route.

## 7. Dependency & CI/CD Security

Phase 0 of the project plan (`AUDIT_AND_ROADMAP.md` Section 5) has this as an open item — once it exists:

- Every PR runs `lint` + `typecheck` + `build` at minimum before merge is allowed; add `npm audit` (or Dependabot) once CI exists.
- Branch protection on `main`: required PR, required status checks, no force-push, squash-merge only.
- Never use `--no-verify` to skip hooks or `-c commit.gpgsign=false` to bypass signing unless a human explicitly asks for that specific exception.
- Staging auto-deploys on merge to `main`; production deploy is a separate, manually-triggered, approval-gated workflow — never automatic.
- Use **test-mode** keys (Stripe, etc.) in CI/staging secrets; live keys exist only in the production environment's secret store.

## 8. Multi-Tenant Verification Checklist (run before every production promotion)

- [ ] Two real accounts created; confirm Account B cannot read Account A's profile, resume, or application data via the UI.
- [ ] Confirm Account B cannot read Account A's data via a direct API call with Account B's session token (not just "the UI doesn't show a button for it").
- [ ] Confirm storage objects: Account B cannot fetch Account A's resume/avatar file path directly, even with a guessed/enumerated URL.
- [ ] Confirm every table added since the last check has RLS enabled (`select relrowsecurity from pg_class where relname = '{table}'`).
- [ ] Confirm no route returns data determined by client-supplied `user_id`/`profile_id` in the request body instead of the authenticated session's `user.id`.

## 9. What This Repo Already Does Right (keep doing it)

- RLS policy shape (`to authenticated` + `(select auth.uid())`) on `profiles`, `job_applications`, `resumes` — correct and performance-aware.
- `security definer` trigger functions with `search_path = ''` and explicit `revoke` — non-obvious hygiene, done correctly in `supabase/migrations/20260707030000_security_hardening.sql`.
- `requireUser()` / `assertResourceOwner()` used consistently across every existing API route.
- `.env.local` properly gitignored, never committed.

---

## Incident Response — Quick Reference

If you (agent or human) discover a leaked secret, an RLS gap, or a broken auth check while working on an unrelated task:

1. **Stop and fix it first**, or at minimum flag it loudly to the user — don't leave a discovered security gap for "later" in the same session.
2. For a leaked secret: rotate the credential immediately, before doing anything else (including before scrubbing history).
3. For an RLS gap: write the missing policy in the same migration style as the existing ones (Section 2), don't invent a new pattern.
4. Record what was found and fixed in `AUDIT_AND_ROADMAP.md` so it isn't rediscovered from scratch next time.

See `AUDIT_AND_ROADMAP.md` for the full list of currently-open issues this document's `[ACTIVE ISSUE]` markers reference.
