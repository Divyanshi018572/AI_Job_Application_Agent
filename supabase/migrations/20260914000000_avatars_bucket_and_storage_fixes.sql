-- Fixes Flaw 1 from AUDIT_AND_ROADMAP.md (2026-09-14):
-- No "avatars" bucket ever existed. app/api/profile/avatar/route.ts tried it
-- first, always failed, fell back to the "resumes" bucket at path
-- "avatars/{userId}/{file}" — which fails that bucket's own RLS policy
-- (first path segment must BE the user's uid, not the literal "avatars"),
-- so every avatar silently ended up base64-encoded inside profiles.avatar_url
-- instead of in storage.
--
-- Avatars are treated as non-sensitive (unlike resumes, which stay private
-- with signed URLs — see the following migration). The bucket is public so
-- the app can render avatars directly via getPublicUrl() without a signed-URL
-- refresh cycle; write access is still locked to each user's own folder.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Users can upload their own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update their own avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars' and
    (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Anyone can view avatars"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');
