begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('92000000-0000-4000-8000-000000000001', 'workflow-eins@example.test'),
  ('92000000-0000-4000-8000-000000000002', 'workflow-zwei@example.test'),
  ('92000000-0000-4000-8000-000000000003', 'workflow-drei@example.test');
insert into public.fach (id, user_id, name) values
  ('92000000-0000-4000-8000-000000000004', '92000000-0000-4000-8000-000000000001', 'Statistik');
insert into public.whiteboard(id, user_id, fach_id, name) values
  ('92000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000004','Original');
insert into public.todo(id, user_id, titel) values
  ('92000000-0000-4000-8000-000000000006','92000000-0000-4000-8000-000000000001','Übung');
insert into public.chat(id, typ, name) values
  ('92000000-0000-4000-8000-000000000007','GRUPPE','Statistikgruppe');
insert into public.chat_mitglied(chat_id,user_id) values
  ('92000000-0000-4000-8000-000000000007','92000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000007','92000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
insert into public.material_thema(id,fach_id,name) values
  ('92000000-0000-4000-8000-000000000008','92000000-0000-4000-8000-000000000004','Von Hand');
insert into public.material_ablage_fach(art,material_id,fach_id,thema_id) values
  ('whiteboard','92000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000008');
select lives_ok($$
  select public.material_thema_vorschlag('92000000-0000-4000-8000-000000000004','Vorschlag',
    '[{"art":"whiteboard","id":"92000000-0000-4000-8000-000000000005"}]'::jsonb)
$$, 'KI-Vorschlag kann gespeichert werden');
select is((select thema_id from public.material_ablage_fach where material_id='92000000-0000-4000-8000-000000000005'),
  '92000000-0000-4000-8000-000000000008'::uuid,'Manuelle Themenzuordnung hat Vorrang');
select lives_ok($$
  select public.material_themen_sortieren('92000000-0000-4000-8000-000000000004',
    (select array_agg(id order by name desc) from public.material_thema))
$$,'Gruppen lassen sich manuell umsortieren');
select is((select position from public.material_thema where name='Von Hand'),1,'Manuelle Reihenfolge ist gespeichert');
select lives_ok($$
  insert into public.material_verknuepfung(art,material_id,ziel_art,ziel_id) values
  ('whiteboard','92000000-0000-4000-8000-000000000005','todo','92000000-0000-4000-8000-000000000006')
$$, 'Original lässt sich ohne Seitenzahl mit einer Aufgabe verknüpfen');
select lives_ok($$
  select set_config('test.paket',public.material_paket_erstellen('92000000-0000-4000-8000-000000000007','Statistik',
    '[{"art":"whiteboard","id":"92000000-0000-4000-8000-000000000005"}]'::jsonb)::text,true)
$$, 'Gruppenpaket wird mit Inhalt atomar erstellt');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000003', true);
select throws_ok($$
  select public.material_themen_sortieren('92000000-0000-4000-8000-000000000004',
    array['92000000-0000-4000-8000-000000000008']::uuid[])
$$,'P0001',null,'Außenstehende können Themen nicht umsortieren');
select is((select count(*) from public.material_paket),0::bigint,'Außenstehende sehen keine Pakete');
select is((select count(*) from public.whiteboard where id='92000000-0000-4000-8000-000000000005'),0::bigint,'Außenstehende sehen keine Originale');
select throws_ok($$
  insert into public.material_ablage_info(art,material_id,papierkorb_am) values ('whiteboard','92000000-0000-4000-8000-000000000005',now())
$$,'42501',null,'Außenstehende können kein fremdes Original löschen');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.whiteboard where id='92000000-0000-4000-8000-000000000005'),1::bigint,'Paket gibt Lesezugriff');
select results_eq($$
  with bearbeitet as (update public.whiteboard set name='Unerlaubt' where id='92000000-0000-4000-8000-000000000005' returning id)
  select count(*) from bearbeitet
$$,array[0::bigint],'Paket gibt kein Schreibrecht am Original');
select results_eq($$
  with geloest as (delete from public.material_paket_element where paket_id=current_setting('test.paket')::uuid returning paket_id)
  select count(*) from geloest
$$,array[0::bigint],'Mitglied kann Paketinhalt ohne Pflegerecht nicht ändern');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
insert into public.material_freigabe(art,material_id,chat_id,empfaenger_id,bearbeiten) values
 ('whiteboard','92000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000007','92000000-0000-4000-8000-000000000002',true);
insert into public.material_paket_pflege(paket_id,pfleger_id) values
 (current_setting('test.paket')::uuid,'92000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
select results_eq($$
  with bearbeitet as (update public.whiteboard set name='Erlaubt' where id='92000000-0000-4000-8000-000000000005' returning id)
  select count(*) from bearbeitet
$$,array[1::bigint],'Gezieltes Bearbeitungsrecht gilt am Original');
select throws_ok($$
  update public.whiteboard set user_id='92000000-0000-4000-8000-000000000002' where id='92000000-0000-4000-8000-000000000005'
$$,'42501',null,'Bearbeitende können keine Eigentümerschaft übernehmen');
select results_eq($$
  with geloest as (delete from public.material_paket_element where paket_id=current_setting('test.paket')::uuid returning paket_id)
  select count(*) from geloest
$$,array[1::bigint],'Paketpflege erlaubt das Entfernen aus dem Paket');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
insert into public.material_ablage_info(art,material_id,papierkorb_am) values ('whiteboard','92000000-0000-4000-8000-000000000005',now());
select is((select count(*) from public.whiteboard where id='92000000-0000-4000-8000-000000000005'),0::bigint,'Papierkorb blendet das Original aus');
update public.material_ablage_info set papierkorb_am=null where material_id='92000000-0000-4000-8000-000000000005';
select is((select count(*) from public.material_verknuepfung where material_id='92000000-0000-4000-8000-000000000005'),1::bigint,'Verknüpfung bleibt bei Wiederherstellung erhalten');
delete from public.material_freigabe where material_id='92000000-0000-4000-8000-000000000005';
select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.whiteboard where id='92000000-0000-4000-8000-000000000005'),0::bigint,'Entzogene Freigabe ist auch am Original wirksam');

select * from finish();
rollback;
