-- Eigene Bilder in der Personalisierung (Symbolleiste, Studio, Bereiche, Hub).
-- Die App verkleinert jedes Bild schon im Browser auf drei Fassungen (2560, 1280, 640 px unscharf) als WebP oder JPEG
-- und entfernt dabei Ortsdaten und andere Metadaten. Hier liegt nur, was die App selbst erzeugt hat.
-- Live-Version: liest die Spalte nicht, kommt also mit der Änderung klar. Die neue Version blendet den Abschnitt
-- „Eigene Bilder“ aus, solange die Spalte fehlt.

alter table public.settings
  add column hintergrund jsonb not null default '{}'
  check (jsonb_typeof(hintergrund) = 'object' and pg_column_size(hintergrund) < 16384);

comment on column public.settings.hintergrund is
  'Eigene Bilder: bilder[], standard, flaechen{leiste,studio,bereiche}, bereich{<id>}, groesse, lernen_aus. Format in src/lib/hintergrund.ts';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hintergrund', 'hintergrund', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

create policy "hintergrund_select_eigene" on storage.objects
  for select to authenticated
  using (bucket_id = 'hintergrund' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "hintergrund_insert_eigene" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hintergrund' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "hintergrund_update_eigene" on storage.objects
  for update to authenticated
  using (bucket_id = 'hintergrund' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "hintergrund_delete_eigene" on storage.objects
  for delete to authenticated
  using (bucket_id = 'hintergrund' and (storage.foldername(name))[1] = (select auth.uid())::text);
