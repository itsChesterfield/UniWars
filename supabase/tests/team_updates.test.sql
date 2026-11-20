begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('93000000-0000-4000-8000-000000000001', 'team-eins@example.test'),
  ('93000000-0000-4000-8000-000000000002', 'team-zwei@example.test'),
  ('93000000-0000-4000-8000-000000000003', 'student@example.test');
insert into public.team_update_mitglied (user_id) values
  ('93000000-0000-4000-8000-000000000001'),
  ('93000000-0000-4000-8000-000000000002');

set local role service_role;
select public.team_updates_abgleichen(
  jsonb_build_array(jsonb_build_object('pr',2140000000,'merge_sha',repeat('a',40),
    'titel','Test','punkte',array['Lesbar'],'aktualisiert_am',now())), array[2140000000]);
select public.team_updates_abgleichen(
  jsonb_build_array(jsonb_build_object('pr',2140000000,'merge_sha',repeat('a',40),
    'titel','Wiederholung','punkte',array['Lesbar'],'aktualisiert_am',now())), array[2140000000]);
select is((select titel from public.team_update where pr = 2140000000), 'Test', 'Wiederholung überschreibt den veröffentlichten Text nicht');
select public.team_updates_abgleichen('[]', array[]::integer[]);
select is((select aktiv from public.team_update where pr = 2140000000), false, 'Rollbacks behalten den Eintrag im Verlauf');
select public.team_updates_abgleichen('[]', array[2140000000]);
select is((select aktiv from public.team_update where pr = 2140000000), true, 'Erneuter Deploy reaktiviert ohne Duplikat');

set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000003', true);
select is((select count(*) from public.team_update), 0::bigint, 'Studierende können keine Updates lesen');
select throws_ok('insert into public.team_update_gelesen (pr) values (2140000000)', '42501', null, 'Studierende können nichts als gelesen speichern');
select throws_ok($$select public.team_updates_abgleichen('[]', array[]::integer[])$$, '42501', null, 'Nutzer können keine Veröffentlichungen ändern');

select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.team_update where pr = 2140000000), 1::bigint, 'Teamkonto kann das Briefing lesen');
select lives_ok('insert into public.team_update_gelesen (pr) values (2140000000) on conflict do nothing', 'Teamkonto speichert den eigenen Lesestatus');
select lives_ok('insert into public.team_update_gelesen (pr) values (2140000000) on conflict do nothing', 'Zweiter Tab kann erneut bestätigen');
select throws_ok($$insert into public.team_update_gelesen (pr, user_id) values (2140000000, '93000000-0000-4000-8000-000000000002')$$, '42501', null, 'Teamkonto kann keinen fremden Lesestatus speichern');
select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.team_update_gelesen where pr = 2140000000), 0::bigint, 'Lesestatus bleibt pro Konto getrennt');

select * from finish();
rollback;
