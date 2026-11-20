begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('94000000-0000-4000-8000-000000000001', 'bild-eins@example.test'),
  ('94000000-0000-4000-8000-000000000002', 'bild-zwei@example.test');
insert into public.settings (user_id) values
  ('94000000-0000-4000-8000-000000000001'),
  ('94000000-0000-4000-8000-000000000002')
on conflict (user_id) do nothing;

select is((select public from storage.buckets where id = 'hintergrund'), false, 'Bucket ist privat');
select is((select file_size_limit from storage.buckets where id = 'hintergrund'), 2097152::bigint, 'Höchstens 2 MB je Datei');
select is((select hintergrund from public.settings where user_id = '94000000-0000-4000-8000-000000000001'), '{}'::jsonb, 'Neue Spalte startet leer');
select throws_ok($$update public.settings set hintergrund = '[]' where user_id = '94000000-0000-4000-8000-000000000001'$$, '23514', null, 'Nur ein Objekt ist erlaubt');

set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000001', true);
select lives_ok($$insert into storage.objects (bucket_id, name, owner) values ('hintergrund', '94000000-0000-4000-8000-000000000001/a.webp', '94000000-0000-4000-8000-000000000001')$$, 'Eigener Ordner: hochladen erlaubt');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('hintergrund', '94000000-0000-4000-8000-000000000002/b.webp')$$, '42501', null, 'Fremder Ordner: hochladen verboten');
select is((select count(*) from storage.objects where bucket_id = 'hintergrund'), 1::bigint, 'Eigene Datei sichtbar');

select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000002', true);
select is((select count(*) from storage.objects where bucket_id = 'hintergrund'), 0::bigint, 'Fremde Dateien unsichtbar');
delete from storage.objects where bucket_id = 'hintergrund';
set local role postgres;
select is((select count(*) from storage.objects where bucket_id = 'hintergrund'), 1::bigint, 'Fremde Dateien lassen sich nicht löschen');

select * from finish();
rollback;
