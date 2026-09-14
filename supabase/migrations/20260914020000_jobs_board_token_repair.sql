-- Repair for 20260914010000_jobs_and_companies_schema.sql.
--
-- An earlier revision of that file (commit b86fb2c) created `jobs` without a
-- `board_token` column and with a dedupe index on
-- (user_id, lower(company), lower(title), lower(coalesce(location,''))).
-- The corrected revision adds `board_token` and dedupes on (user_id, job_url)
-- instead. Re-running the corrected file on a database that already has the
-- old one does nothing, because `create table if not exists` and
-- `create unique index if not exists jobs_dedupe_idx` both skip when those
-- objects already exist.
--
-- This file brings any of the three possible states to the same end state,
-- and is safe to run more than once:
--   1. old revision applied        -> fixed
--   2. corrected revision applied  -> no-op
--   3. run straight after (2) on a fresh database -> no-op

-- 1. board_token column. Backfill from `company` before enforcing NOT NULL:
-- Greenhouse/Lever adapters store the board token as `company` until Task 2.5
-- resolves real names, so it's the best available value for any existing row.
alter table public.jobs add column if not exists board_token text;

update public.jobs
set board_token = company
where board_token is null;

alter table public.jobs alter column board_token set not null;

-- 2. Replace the dedupe index. Dropped and recreated unconditionally because
-- an index named jobs_dedupe_idx may exist with the old expression-based
-- definition, which `create ... if not exists` would silently keep.
-- If this step fails with a unique-violation, duplicate (user_id, job_url)
-- rows exist and must be removed first.
drop index if exists public.jobs_dedupe_idx;

create unique index jobs_dedupe_idx
  on public.jobs (user_id, job_url);

-- 3. Cache-freshness lookup index used by lib/jobs/ingest.ts.
create index if not exists jobs_cache_lookup_idx
  on public.jobs (user_id, platform, board_token, fetched_at desc);
