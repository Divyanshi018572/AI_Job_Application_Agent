-- Tracks which jobs have been classified, so classification runs once per
-- job (plan Task 2.4: "runs once per job at ingestion, result cached on the
-- row; never recomputed") and can happen in bounded batches instead of all
-- at once.
--
-- Why a separate column rather than "experience_level is null": a posting
-- that genuinely doesn't state its level is classified as null on purpose
-- (the "don't guess" rule). Without classified_at, that job would look
-- untouched and be re-sent to the model on every refresh, forever.
--
-- Real boards are large (checked 2026-09-15: Stripe 632 jobs, Databricks
-- 891), so classifying a whole board inside one request would run for many
-- minutes. The ingestion pipeline now saves all jobs first, then classifies
-- pending ones (classified_at is null) a batch at a time.
--
-- Idempotent: safe to run more than once.

alter table public.jobs add column if not exists classified_at timestamptz;

-- The "next batch to classify" lookup for one board.
create index if not exists jobs_pending_classification_idx
  on public.jobs (user_id, platform, board_token)
  where classified_at is null;
