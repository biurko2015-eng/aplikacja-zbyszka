-- Force Update Buckets to be Public
update storage.buckets
set public = true
where id = 'documents';
update storage.buckets
set public = true
where id = 'avatars';
-- Verify Policies (Re-run to be safe)
drop policy if exists "Documents are publicly accessible." on storage.objects;
create policy "Documents are publicly accessible." on storage.objects for
select using (bucket_id = 'documents');