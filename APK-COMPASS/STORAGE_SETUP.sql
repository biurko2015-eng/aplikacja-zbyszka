-- 4. Storage Buckets Setup (Using ON CONFLICT to avoid duplicate error)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true) on conflict (id) do nothing;
-- 5. Storage Policies (Allow public access for now)
-- Drop existing policies first to avoid duplicates
drop policy if exists "Avatar images are publicly accessible." on storage.objects;
drop policy if exists "Anyone can upload an avatar." on storage.objects;
drop policy if exists "Documents are publicly accessible." on storage.objects;
drop policy if exists "Authenticated users can upload documents." on storage.objects;
-- Re-create policies
create policy "Avatar images are publicly accessible." on storage.objects for
select using (bucket_id = 'avatars');
create policy "Anyone can upload an avatar." on storage.objects for
insert with check (bucket_id = 'avatars');
create policy "Documents are publicly accessible." on storage.objects for
select using (bucket_id = 'documents');
create policy "Authenticated users can upload documents." on storage.objects for
insert with check (
        bucket_id = 'documents'
        and auth.role() = 'authenticated'
    );