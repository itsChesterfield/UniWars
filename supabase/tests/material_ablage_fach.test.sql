begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('91000000-0000-4000-8000-000000000001', 'ablage-eins@example.test'),
  ('91000000-0000-4000-8000-000000000002', 'ablage-zwei@example.test');
insert into public.fach (id, user_id, name) values
  ('91000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', 'Statistik'),
  ('91000000-0000-4000-8000-000000000004', '91000000-0000-4000-8000-000000000002', 'Mathematik');
insert into public.whiteboard (id, user_id, name) values
  ('91000000-0000-4000-8000-000000000005', '91000000-0000-4000-8000-000000000001', 'Skizze eins'),
  ('91000000-0000-4000-8000-000000000006', '91000000-0000-4000-8000-000000000002', 'Skizze zwei');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);

select lives_ok($$
  insert into public.material_ablage_fach (art, material_id, fach_id) values
  ('whiteboard', '91000000-0000-4000-8000-000000000005', '91000000-0000-4000-8000-000000000003')
$$, 'Eigene Unterlage im eigenen Fach zuordnen');
select throws_ok($$
  insert into public.material_ablage_fach (art, material_id, fach_id) values
  ('whiteboard', '91000000-0000-4000-8000-000000000006', '91000000-0000-4000-8000-000000000003')
$$, '42501', null, 'Fremde Unterlage kann nicht zugeordnet werden');
select throws_ok($$
  insert into public.material_ablage_fach (art, material_id, fach_id) values
  ('whiteboard', '91000000-0000-4000-8000-000000000005', '91000000-0000-4000-8000-000000000004')
$$, '42501', null, 'Fremdes Fach kann nicht verwendet werden');
select lives_ok($$ update public.material_ablage_fach set ausgeblendet = true $$, 'Eigene Zuordnung kann ausgeblendet werden');
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.material_ablage_fach), 0::bigint, 'Fremde Zuordnungen bleiben unsichtbar');
select * from finish();
rollback;
