-- Migration: Add career_preferences jsonb column to public.profiles
alter table public.profiles
  add column if not exists career_preferences jsonb not null default '{}'::jsonb;
