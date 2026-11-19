create schema if not exists private;

create function private.material_besitzt(p_art text, p_id uuid, p_nutzer uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  tabelle text := case p_art
    when 'datei' then 'datei' when 'notiz' then 'notiz' when 'stapel' then 'kk_stapel'
    when 'praesentation' then 'praesentation' when 'whiteboard' then 'whiteboard' when 'mindmap' then 'mindmap'
    when 'dokument' then 'dokument' when 'tabelle' then 'tabelle' when 'transkript' then 'transkript'
    when 'podcast' then 'podcast' when 'quiz' then 'quiz' when 'literatur' then 'literatur_quelle'
  end;
  gefunden boolean;
begin
  if tabelle is null or p_nutzer is null then return false; end if;
  execute pg_catalog.format('select exists (select 1 from public.%I where id = $1 and user_id = $2)', tabelle)
    into gefunden using p_id, p_nutzer;
  return gefunden;
end;
$$;
revoke all on function private.material_besitzt(text, uuid, uuid) from public, anon, authenticated;

create function private.material_ist_meins(p_art text, p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.material_besitzt(p_art, p_id, auth.uid())
$$;
revoke all on function private.material_ist_meins(text, uuid) from public, anon, authenticated;
grant execute on function private.material_ist_meins(text, uuid) to authenticated;

create table public.material_ablage_info (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  art text not null check (art in ('datei','notiz','stapel','praesentation','whiteboard','mindmap','dokument','tabelle','transkript','podcast','quiz','literatur')),
  material_id uuid not null,
  anzeigetitel text check (pg_catalog.char_length(pg_catalog.btrim(anzeigetitel)) between 1 and 200),
  papierkorb_am timestamptz,
  papierkorb_titel text check (pg_catalog.char_length(papierkorb_titel) <= 250),
  primary key (user_id, art, material_id)
);
create index material_papierkorb_idx on public.material_ablage_info(art, material_id) where papierkorb_am is not null;

create table public.material_thema (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fach_id uuid not null references public.fach(id) on delete cascade,
  name text not null check (pg_catalog.char_length(pg_catalog.btrim(name)) between 1 and 100),
  position integer not null default 2147483647 check (position > 0),
  unique (user_id, fach_id, id)
);
create unique index material_thema_name_idx on public.material_thema(user_id, fach_id, pg_catalog.lower(name));
create index material_thema_fach_idx on public.material_thema(fach_id);
alter table public.material_ablage_fach add column thema_id uuid;
alter table public.material_ablage_fach add constraint material_ablage_fach_thema_fkey
  foreign key (user_id, fach_id, thema_id) references public.material_thema(user_id, fach_id, id) on delete set null (thema_id);

create table public.material_verknuepfung (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  art text not null check (art in ('datei','notiz','stapel','praesentation','whiteboard','mindmap','dokument','tabelle','transkript','podcast','quiz','literatur')),
  material_id uuid not null,
  ziel_art text not null check (ziel_art in ('todo','deadline','pruefung','vorlesung')),
  ziel_id uuid not null,
  termin_datum date,
  seite integer check (seite is null or (seite between 1 and 100000 and art = 'datei')),
  check ((ziel_art = 'vorlesung') = (termin_datum is not null)),
  unique nulls not distinct (user_id, art, material_id, ziel_art, ziel_id, termin_datum, seite)
);
create index material_verknuepfung_ziel_idx on public.material_verknuepfung(user_id, ziel_art, ziel_id, termin_datum);

create function private.material_ziel_sichtbar(p_art text, p_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select case p_art
    when 'todo' then exists (select 1 from public.todo where id = p_id)
    when 'deadline' then exists (select 1 from public.deadline where id = p_id)
    when 'pruefung' then exists (select 1 from public.pruefung where id = p_id)
    when 'vorlesung' then exists (select 1 from public.stundenplan_eintrag where id = p_id)
    else false
  end
$$;
revoke all on function private.material_ziel_sichtbar(text, uuid) from public, anon, authenticated;
grant execute on function private.material_ziel_sichtbar(text, uuid) to authenticated;

alter table public.material_ablage_info enable row level security;
alter table public.material_thema enable row level security;
alter table public.material_verknuepfung enable row level security;
revoke all on public.material_ablage_info, public.material_thema, public.material_verknuepfung from public, anon, authenticated;
grant select, insert, update on public.material_ablage_info, public.material_thema to authenticated;
grant select, insert, delete on public.material_verknuepfung to authenticated;

create policy material_info_lesen on public.material_ablage_info for select to authenticated using (user_id = (select auth.uid()));
create policy material_info_anlegen on public.material_ablage_info for insert to authenticated
  with check (user_id = (select auth.uid()) and private.material_ist_meins(art, material_id));
create policy material_info_aendern on public.material_ablage_info for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.material_ist_meins(art, material_id));

create policy material_thema_lesen on public.material_thema for select to authenticated using (user_id = (select auth.uid()));
create policy material_thema_anlegen on public.material_thema for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.fach where id = material_thema.fach_id and user_id = (select auth.uid())));
create policy material_thema_aendern on public.material_thema for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.fach where id = material_thema.fach_id and user_id = (select auth.uid())));

create policy material_verknuepfung_lesen on public.material_verknuepfung for select to authenticated
  using (user_id = (select auth.uid()) and private.material_ziel_sichtbar(ziel_art, ziel_id));
create policy material_verknuepfung_anlegen on public.material_verknuepfung for insert to authenticated
  with check (user_id = (select auth.uid()) and private.material_ist_meins(art, material_id)
    and private.material_ziel_sichtbar(ziel_art, ziel_id));
create policy material_verknuepfung_loesen on public.material_verknuepfung for delete to authenticated
  using (user_id = (select auth.uid()));

create function private.material_aktiv(p_art text, p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.material_ablage_info
    where art = p_art and material_id = p_id and papierkorb_am is not null)
$$;
revoke all on function private.material_aktiv(text, uuid) from public, anon, authenticated;
grant execute on function private.material_aktiv(text, uuid) to authenticated;

do $$
declare
  m record;
begin
  for m in select * from (values
    ('datei','datei'),('notiz','notiz'),('kk_stapel','stapel'),('praesentation','praesentation'),
    ('whiteboard','whiteboard'),('mindmap','mindmap'),('dokument','dokument'),('tabelle','tabelle'),
    ('transkript','transkript'),('podcast','podcast'),('quiz','quiz'),('literatur_quelle','literatur')
  ) as v(tabelle, art) loop
    execute pg_catalog.format(
      'create policy material_aktiv on public.%I as restrictive for all to authenticated using (private.material_aktiv(%L, id)) with check (private.material_aktiv(%L, id))',
      m.tabelle, m.art, m.art
    );
  end loop;
end
$$;

create policy material_stapel_aktiv on public.kk_karte as restrictive for all to authenticated
  using (private.material_aktiv('stapel', stapel_id)) with check (private.material_aktiv('stapel', stapel_id));
create policy material_transkript_aktiv on public.transkript_teil as restrictive for all to authenticated
  using (private.material_aktiv('transkript', transkript_id)) with check (private.material_aktiv('transkript', transkript_id));
create policy material_pdf_text_aktiv on public.quelle_seite as restrictive for all to authenticated
  using (private.material_aktiv('datei', datei_id)) with check (private.material_aktiv('datei', datei_id));

create function public.material_thema_vorschlag(p_fach uuid, p_name text, p_material jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_thema uuid;
begin
  if pg_catalog.jsonb_typeof(p_material) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_material) not between 1 and 40 then
    raise exception 'Ungültige Materialauswahl.';
  end if;
  insert into public.material_thema(fach_id, name) values (p_fach, p_name)
    on conflict (user_id, fach_id, pg_catalog.lower(name)) do nothing;
  select id into strict v_thema from public.material_thema
    where fach_id = p_fach and user_id = auth.uid() and pg_catalog.lower(name) = pg_catalog.lower(p_name);
  insert into public.material_ablage_fach(fach_id, art, material_id, thema_id)
    select p_fach, art, id, v_thema from pg_catalog.jsonb_to_recordset(p_material) as m(art text, id uuid)
    on conflict (user_id, art, material_id, fach_id) do update set thema_id = excluded.thema_id
    where public.material_ablage_fach.thema_id is null and not public.material_ablage_fach.ausgeblendet;
end
$$;
revoke all on function public.material_thema_vorschlag(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.material_thema_vorschlag(uuid, text, jsonb) to authenticated;

create function public.material_themen_sortieren(p_fach uuid, p_reihenfolge uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_aktualisiert integer;
begin
  if coalesce(pg_catalog.cardinality(p_reihenfolge), 0) = 0 then
    raise exception 'Die Themenliste ist leer.';
  end if;
  update public.material_thema t
    set position = eingabe.position::integer
    from pg_catalog.unnest(p_reihenfolge) with ordinality as eingabe(id, position)
    where t.id = eingabe.id and t.fach_id = p_fach and t.user_id = auth.uid();
  get diagnostics v_aktualisiert = row_count;
  if v_aktualisiert <> pg_catalog.cardinality(p_reihenfolge) then
    raise exception 'Die Themenliste hat sich geändert.';
  end if;
end
$$;
revoke all on function public.material_themen_sortieren(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.material_themen_sortieren(uuid, uuid[]) to authenticated;

alter table public.datei add column pdf_index_status text check (pdf_index_status in ('wartet', 'fertig', 'fehler'));

create policy material_quiz_aktiv on public.quiz_versuch as restrictive for all to authenticated
  using (private.material_aktiv('quiz', quiz_id)) with check (private.material_aktiv('quiz', quiz_id));
