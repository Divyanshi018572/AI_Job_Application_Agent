-- Jobs & Companies schema (plan Section 6, Tasks 2.3/2.5 prerequisite).
-- Unblocks Task 2.3 (Caching & Rate Limits) and Task 2.5 (Company Metadata
-- Table) — neither can be built without this table existing. Schema
-- columns match the plan's own "Schemas introduced in this phase" spec.
--
-- Design note: `jobs` is scoped per-user (RLS on user_id, matching every
-- other table in this app), not a single shared/global table — this
-- follows the plan's own schema definition, which embeds match_score,
-- saved_status, and applied_status directly on the row (all inherently
-- per-user values, not sensibly shared across users). Task 2.3's "6-hour
-- cache" therefore means "don't re-fetch the same user's same company
-- board within 6 hours," not cross-user deduplication — worth knowing if
-- ingestion volume ever becomes a concern with many users tracking the
-- same popular companies.
--
-- Deviation from the plan's literal schema, documented (see
-- AUDIT_AND_ROADMAP.md): added `board_token`. Greenhouse/Lever/Workable
-- adapters resolve jobs from a board *token*, not a company display name —
-- Greenhouse/Lever's RawJob.company is literally the token as a
-- placeholder until Task 2.5 resolves real names. Without storing the
-- token, there'd be no reliable way to answer "have we fetched this
-- board recently" (Task 2.3's whole job), or to dedupe safely — the
-- plan's suggested "dedupe by company+title+location" breaks the moment
-- two boards share a token-derived placeholder name or a job is re-titled
-- slightly between fetches. Deduping on (user_id, job_url) instead, since
-- every adapter already provides a real, stable, unique-per-posting URL —
-- strictly more precise than fuzzy text matching, and it's data we already
-- have from every platform.

create extension if not exists "vector";

-- 1. Companies (Task 2.5) — shared, not user-scoped. Publicly readable;
-- writes happen only via a service-role Inngest job (see SECURITY.md
-- Section 4 on the service-role client boundary), never from the client,
-- so no insert/update/delete policy is granted to anon/authenticated here.
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  company_type text check (
    company_type in ('startup', 'mid-size', 'enterprise', 'faang-tier')
  ),
  employee_count_range text,
  source text not null default 'manual' check (source in ('manual', 'enriched')),
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;

create policy "companies_select_all"
  on public.companies
  for select
  to authenticated
  using (true);

create unique index if not exists companies_name_idx
  on public.companies (lower(name));

grant select on public.companies to authenticated;

-- 2. Jobs (Task 2.1-2.4 output lands here once ingestion is wired up)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('greenhouse', 'lever', 'workable')),
  board_token text not null,
  title text not null,
  company text not null,
  company_id uuid references public.companies (id) on delete set null,
  company_logo text,
  location text,
  salary_min integer,
  salary_max integer,
  salary_disclosed boolean not null default false,
  job_type text,
  experience_level text check (
    experience_level in ('Fresher', '0-1', '1-3', '3-5', '5+', 'Senior-Lead')
  ),
  employment_type text check (
    employment_type in ('Internship', 'Full-time', 'Contract', 'Part-time')
  ),
  work_mode text check (work_mode in ('Remote', 'Hybrid', 'Onsite')),
  description text,
  tags jsonb not null default '[]'::jsonb,
  match_score numeric,
  embedding vector(1536),
  job_url text not null,
  source_url text,
  applied_status text not null default 'not_applied',
  saved_status boolean not null default false,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.jobs enable row level security;

create policy "jobs_select_own"
  on public.jobs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "jobs_insert_own"
  on public.jobs
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "jobs_update_own"
  on public.jobs
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "jobs_delete_own"
  on public.jobs
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.jobs to authenticated;

-- Cross-cutting requirement: "Duplicate/stale jobs: Dedupe..." — enforced
-- at the DB level on (user_id, job_url) (see design note above for why
-- this replaces the plan's literal "company+title+location" suggestion)
-- so a repeated ingestion run can upsert (ON CONFLICT) instead of creating
-- duplicate rows. Plain columns (no lower()/expressions), deliberately —
-- Supabase's REST upsert (`on_conflict=`) can only target a plain-column
-- unique constraint, not an expression index.
create unique index if not exists jobs_dedupe_idx
  on public.jobs (user_id, job_url);

-- Task 2.3's cache-freshness check ("has this user fetched this exact
-- board recently") queries by this combination directly.
create index if not exists jobs_cache_lookup_idx
  on public.jobs (user_id, platform, board_token, fetched_at desc);

-- Structural filters first (plan Task 3.3: "structural filters... all
-- indexed columns" run before the expensive embedding-similarity ranking
-- step) — added now, at table-creation time, rather than bolted on later.
create index if not exists jobs_user_id_idx on public.jobs (user_id);
create index if not exists jobs_platform_idx on public.jobs (platform);
create index if not exists jobs_applied_status_idx on public.jobs (applied_status);
create index if not exists jobs_saved_status_idx on public.jobs (saved_status);
create index if not exists jobs_fetched_at_idx on public.jobs (fetched_at desc);

-- No updated_at trigger here: `jobs` has no updated_at column per the
-- plan's schema. `fetched_at` plays that role instead, and is set
-- explicitly by the ingestion pipeline on each re-fetch (Task 2.3) rather
-- than by a generic trigger — a re-fetch is a meaningful "this is fresh
-- data" event, not an incidental field edit.
