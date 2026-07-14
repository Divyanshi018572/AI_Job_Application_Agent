-- Migration: Add resume onboarding fields to profiles, create resumes table & storage bucket
-- Run in Supabase SQL Editor or via supabase db push

-- 1. Extend profiles table with onboarding flag and structured resume fields
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists phone text,
  add column if not exists location text,
  add column if not exists summary text,
  add column if not exists skills jsonb not null default '[]'::jsonb,
  add column if not exists work_experience jsonb not null default '[]'::jsonb,
  add column if not exists education jsonb not null default '[]'::jsonb,
  add column if not exists projects jsonb not null default '[]'::jsonb,
  add column if not exists certifications jsonb not null default '[]'::jsonb,
  add column if not exists links jsonb not null default '{}'::jsonb;

-- 2. Create job resumes table
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_url text,
  file_size bigint default 0,
  content_type text default 'application/pdf',
  parsed_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.resumes enable row level security;

create policy "resumes_select_own"
  on public.resumes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "resumes_insert_own"
  on public.resumes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "resumes_update_own"
  on public.resumes
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "resumes_delete_own"
  on public.resumes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Add updated_at trigger for resumes
drop trigger if exists resumes_set_updated_at on public.resumes;
create trigger resumes_set_updated_at
  before update on public.resumes
  for each row
  execute function public.set_updated_at();

-- Index for fast user_id lookups
create index if not exists resumes_user_id_idx on public.resumes (user_id);
create index if not exists resumes_created_at_idx on public.resumes (created_at desc);

-- 3. Storage Bucket Configuration for resumes
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Storage RLS policies for resumes bucket
create policy "Users can upload their own resumes"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'resumes' and
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can view their own resumes"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'resumes' and
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own resumes"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'resumes' and
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

grant select, insert, update, delete on public.resumes to authenticated;
