-- Migration: Add achievements jsonb column to public.profiles
alter table public.profiles
  add column if not exists achievements jsonb not null default '[]'::jsonb;
