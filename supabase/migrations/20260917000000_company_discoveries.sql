-- Task 2.2 — Company Token Discovery: the review queue.
--
-- The plan: "success → add to curated list, fail → manual URL entry
-- flagged for review". `companies` (the curated list) is shared and has no
-- write policy for users (SECURITY.md: shared data is written by a
-- reviewed/service process, never directly from the client). So each
-- discovery a user triggers is recorded here instead, pending review:
--   found_via_search — a web search found a board and it verified live
--   manual           — the user pasted a board link after search failed
--   not_found        — nothing verified; flagged so someone can find it
-- Promoting an approved row into `companies` is a manual SQL step for now
-- (see the example at the bottom), later a service-role job.
--
-- Also the per-user cache (a repeat search for the same company reuses a
-- verified result instead of paying for another web search) and the
-- per-user hourly cap on searches.
--
-- Idempotent: safe to run more than once.

create table if not exists public.company_discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  query text not null check (char_length(query) between 1 and 100),
  -- normalizeCompanyName(query) from lib/ats/discovery.ts; cache key.
  query_key text not null check (char_length(query_key) between 1 and 100),
  status text not null check (status in ('found_via_search', 'manual', 'not_found')),
  ats_platform text check (ats_platform in ('greenhouse', 'lever', 'workable')),
  board_token text check (char_length(board_token) between 1 and 100),
  source_url text check (char_length(source_url) <= 500),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  -- A found row names its board; a not_found row doesn't.
  constraint company_discoveries_board_check check (
    (status = 'not_found' and ats_platform is null and board_token is null)
    or (status <> 'not_found' and ats_platform is not null and board_token is not null)
  )
);

alter table public.company_discoveries enable row level security;

-- Users see and add only their own rows. Every new row starts pending:
-- users can't approve their own discoveries, and there is no update or
-- delete policy — review happens outside the app.
drop policy if exists "company_discoveries_select_own" on public.company_discoveries;
create policy "company_discoveries_select_own"
  on public.company_discoveries
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "company_discoveries_insert_own" on public.company_discoveries;
create policy "company_discoveries_insert_own"
  on public.company_discoveries
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id and review_status = 'pending');

grant select, insert on public.company_discoveries to authenticated;
-- Supabase's default privileges grant every new table to anon and
-- authenticated. The policies above already block the rest; revoking it
-- too means a future policy mistake can't open updates or deletes.
revoke all on public.company_discoveries from anon;
revoke update, delete, truncate on public.company_discoveries from authenticated;

-- Cache lookup and the hourly cap both filter by user, newest first.
create index if not exists company_discoveries_user_created_idx
  on public.company_discoveries (user_id, created_at desc);
create index if not exists company_discoveries_user_key_idx
  on public.company_discoveries (user_id, query_key);

-- Reviewing (SQL Editor, as the project owner):
--
--   select * from company_discoveries where review_status = 'pending' order by created_at;
--
--   -- approve a found board into the curated list:
--   insert into companies (name, ats_platform, board_token, source)
--     select query, ats_platform, lower(board_token), 'manual'
--     from company_discoveries where id = '<id>';
--   update company_discoveries set review_status = 'approved' where id = '<id>';
