-- Profilbild: Pfad in settings, Datei im privaten Bucket "profilbild" (Ordner = user_id)
alter table public.settings add column avatar_pfad text null check (char_length(avatar_pfad) <= 300);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profilbild', 'profilbild', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "profilbild_select_eigene" on storage.objects
  for select to authenticated
  using (bucket_id = 'profilbild' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profilbild_insert_eigene" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profilbild' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profilbild_update_eigene" on storage.objects
  for update to authenticated
  using (bucket_id = 'profilbild' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "profilbild_delete_eigene" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profilbild' and (storage.foldername(name))[1] = (select auth.uid())::text);
