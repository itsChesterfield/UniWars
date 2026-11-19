create view public.material_ablage_original with (security_invoker = true) as
select 'datei'::text as art, id, user_id from public.datei
union all select 'notiz', id, user_id from public.notiz
union all select 'stapel', id, user_id from public.kk_stapel
union all select 'praesentation', id, user_id from public.praesentation
union all select 'whiteboard', id, user_id from public.whiteboard
union all select 'mindmap', id, user_id from public.mindmap
union all select 'dokument', id, user_id from public.dokument
union all select 'tabelle', id, user_id from public.tabelle
union all select 'transkript', id, user_id from public.transkript
union all select 'podcast', id, user_id from public.podcast
union all select 'quiz', id, user_id from public.quiz
union all select 'literatur', id, user_id from public.literatur_quelle;

revoke all on public.material_ablage_original from public, anon, authenticated;
grant select on public.material_ablage_original to authenticated;

create table public.material_ablage_fach (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  art text not null check (art in ('datei', 'notiz', 'stapel', 'praesentation', 'whiteboard', 'mindmap',
    'dokument', 'tabelle', 'transkript', 'podcast', 'quiz', 'literatur')),
  material_id uuid not null,
  fach_id uuid not null references public.fach(id) on delete cascade,
  ausgeblendet boolean not null default false,
  primary key (user_id, art, material_id, fach_id)
);

create index material_ablage_fach_fach_idx on public.material_ablage_fach(fach_id);
alter table public.material_ablage_fach enable row level security;
revoke all on public.material_ablage_fach from public, anon, authenticated;
grant select, insert, update on public.material_ablage_fach to authenticated;

create policy material_ablage_fach_lesen on public.material_ablage_fach for select to authenticated
  using (user_id = (select auth.uid()));

create policy material_ablage_fach_einfuegen on public.material_ablage_fach for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.fach f where f.id = fach_id and f.user_id = (select auth.uid()))
    and exists (select 1 from public.material_ablage_original m
      where m.art = material_ablage_fach.art and m.id = material_id and m.user_id = (select auth.uid()))
  );

create policy material_ablage_fach_aendern on public.material_ablage_fach for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.fach f where f.id = fach_id and f.user_id = (select auth.uid()))
    and exists (select 1 from public.material_ablage_original m
      where m.art = material_ablage_fach.art and m.id = material_id and m.user_id = (select auth.uid()))
  );
