-- Security hardening for trigger functions (applied via Supabase MCP)

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;
revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon, authenticated;
