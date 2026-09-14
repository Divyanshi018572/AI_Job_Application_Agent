# Project Status — AI Job Application Agent
Date: 2026-09-13
Repo: `ai_job_application_agent` (Next.js 16.2.10 + React 19.2.4 + Supabase + Tailwind v4 + shadcn)

## 1. How to Run This Project

### Prerequisites
- Node.js v24.11.1 (verified), npm 11.6.2
- `.env.local` exists (verified `True`). Must contain:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
  SUPABASE_SERVICE_ROLE_KEY= (server-only)
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  GEMINI_API_KEY=
  GROQ_API_KEY=
  ```
  Template: `.env.example`

### Commands (run from project root)
```powershell
# go to project
cd "D:\DATA SCIENCE\saas APPs\Job_application_agent\ai_job_application_agent"

# install deps (node_modules already present, run once / after pull)
npm install

# dev server (standard)
npm run dev
# → open http://localhost:3000

# dev + auto-open fullscreen browser (project script)
npm run dev:open
npm run dev:edge
npm run dev:chrome

# production build + serve
npm run build
npm run start
# → open http://localhost:3000

# prod + auto-open browser
npm run start:open
npm run start:edge
npm run start:chrome

# lint
npm run lint
```

> `dev` / `start` scripts use `cross-env NODE_OPTIONS=--use-system-ca next dev|start`.
> `scripts/open-browser.ps1` waits for `http://localhost:3000` then opens Edge/Chrome fullscreen.

---

## 2. What Is DONE

### Core scaffold
- [x] Next.js App Router, landing page `app/page.tsx`, `app/layout.tsx`, `middleware.ts` (Supabase session)
- [x] Dashboard shell: `app/dashboard/layout.tsx`, `app-sidebar.tsx`, `dashboard-shell.tsx`, `dashboard-header.tsx`, `navigation.ts` (Jobs, Resume, Profile, Application Status + Billing, Settings)
- [x] shadcn UI kit fully vendored in `components/ui/` (~60 components)
- [x] Supabase clients: `lib/supabase/client.ts`, `server.ts`, `middleware.ts`, `admin.ts` + `lib/env.ts`, `lib/auth/session.ts`
- [x] CodeRabbit AI reviewer config + docs (`README.md`, `AGENTS.md`, `CLAUDE.md`)

### Auth (functional)
- [x] Pages: `app/(auth)/login`, `signup`, `forgot-password`, `reset-password`
- [x] API: `app/api/auth/login|signup|logout|forgot-password|reset-password|resend-verification/route.ts`
- [x] Email links use `NEXT_PUBLIC_SITE_URL`

### Profile (most complete feature)
- [x] Page `app/dashboard/profile/page.tsx` + `components/dashboard/profile-editor.tsx`
- [x] Vertical sidebar tabs, career preferences, achievements tab
- [x] Avatar file upload flow (`app/api/profile/avatar/route.ts`)
- [x] Profile completeness card (`profile-completeness-card.tsx`) with resilient schema-error retry
- [x] API: `app/api/profile/route.ts`
- [x] DB: `20260714010000_add_career_preferences_to_profiles.sql`, `20260714020000_add_achievements_to_profiles.sql`
- [x] Uncommitted local edits (per `git status`): `.agents/AGENTS.md`, `profile-completeness-card.tsx`, `profile-editor.tsx`

### Resume + AI parsing (functional)
- [x] Page `app/dashboard/resume/page.tsx` + `components/dashboard/resume-list-view.tsx`, `onboarding-resume-modal.tsx`
- [x] Upload API: `app/api/resumes/route.ts`, `app/api/resumes/upload/route.ts`, `app/api/resumes/[id]/route.ts` (pdf-parse)
- [x] AI router `lib/ai/router.ts`: Gemini for doc understanding (`lib/ai/gemini.ts`), Groq Llama 3.3 70B for fast text (`lib/ai/groq.ts`) with Gemini fallback
- [x] Types: `types/resume.ts`, `types/database.ts`
- [x] DB: `20260714000000_resume_onboarding_schema.sql`

### Database / Security
- [x] Migrations in `supabase/migrations/`:
  - `20260706130000_initial_schema.sql`
  - `20260707030000_security_hardening.sql` (RLS)
  - `20260714000000_resume_onboarding_schema.sql`
  - `20260714010000_add_career_preferences_to_profiles.sql`
  - `20260714020000_add_achievements_to_profiles.sql`
- [x] Recent commits:
  - `8295451 feat: add achievements tab, avatar file upload flow, and resilient schema error retry`
  - `9980dfe feat: add career preferences and vertical sidebar tabs to profile editor`
  - `fe1cb69 fix: resolve profile schema error, sync parsed resume data, and update UI styling`

## 3. PLACEHOLDER / NOT STARTED

| Route | File | State |
|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` | `BlankPage` — "Overview and insights will appear here soon." |
| `/dashboard/jobs` | `app/dashboard/jobs/page.tsx` | `BlankPage` — no listing / save / search logic |
| `/dashboard/application-status` | `app/dashboard/application-status/page.tsx` | `BlankPage` — no pipeline / kanban; API `app/api/applications/route.ts` exists but no UI wiring verified |
| `/dashboard/billing` | `app/dashboard/billing/page.tsx` | `BlankPage` — only `creditsPlaceholder {used:380,total:500}` + `credits-display.tsx` |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | exists, not audited — assume minimal |
| AI tailoring / cover letters | `generateFastText()` exists | router ready, no UI / prompt flow wired |
| Job discovery | — | not started |
| Stripe / credits enforcement | — | not started |

## 4. Immediate Next Steps
1. Commit pending edits (`profile-editor.tsx`, `profile-completeness-card.tsx`).
2. Wire `app/api/applications` to Application Status UI.
3. Build Jobs search + save flow.
4. Build Dashboard overview (counts, recent apps, completeness).
5. Wire `generateFastText` to Resume tailoring / cover-letter UI.
6. Real credits + billing.

## 5. Verification Done 2026-09-13
- `package.json` scripts inspected, `node --version` / `npm --version` checked.
- `git log --oneline -20`, `git status --short`, `supabase/migrations` listed.
- `.env.local` presence confirmed (`Test-Path → True`), `node_modules/` present.
- No build executed (use `npm run build` before deploy).
