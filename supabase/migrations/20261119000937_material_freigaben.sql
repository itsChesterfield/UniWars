create table public.material_freigabe (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empfaenger_id uuid not null references auth.users(id) on delete cascade,
  chat_id uuid not null references public.chat(id) on delete cascade,
  art text not null check (art in ('datei','notiz','stapel','praesentation','whiteboard','mindmap','dokument','tabelle','transkript','podcast','quiz','literatur')),
  material_id uuid not null,
  bearbeiten boolean not null default false,
  check (user_id <> empfaenger_id),
  primary key (empfaenger_id, art, material_id, chat_id)
);
create index material_freigabe_gegeber_idx on public.material_freigabe(user_id, art, material_id);
create index material_freigabe_chat_idx on public.material_freigabe(chat_id);

create table public.material_paket (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chat_id uuid not null references public.chat(id) on delete cascade,
  titel text not null check (pg_catalog.char_length(pg_catalog.btrim(titel)) between 1 and 120)
);
create index material_paket_chat_idx on public.material_paket(chat_id);

create table public.material_paket_element (
  paket_id uuid not null references public.material_paket(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  art text not null check (art in ('datei','notiz','stapel','praesentation','whiteboard','mindmap','dokument','tabelle','transkript','podcast','quiz','literatur')),
  material_id uuid not null,
  primary key (paket_id, art, material_id)
);
create index material_paket_element_original_idx on public.material_paket_element(art, material_id);

create table public.material_paket_pflege (
  paket_id uuid not null references public.material_paket(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pfleger_id uuid not null references auth.users(id) on delete cascade,
  check (user_id <> pfleger_id),
  primary key (paket_id, pfleger_id)
);
create index material_paket_pflege_nutzer_idx on public.material_paket_pflege(pfleger_id);

create function private.material_gruppe(p_chat uuid, p_nutzer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat c join public.chat_mitglied m on c.id = m.chat_id
    where c.id = p_chat and c.typ = 'GRUPPE' and m.user_id = p_nutzer
  )
$$;
create function private.material_paket_recht(p_paket uuid, p_pflege boolean, p_eigentuemer boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.material_paket p
    where p.id = p_paket and private.material_gruppe(p.chat_id, auth.uid())
    and (
      p.user_id = auth.uid()
      or (not p_eigentuemer and (not p_pflege or exists (
        select 1 from public.material_paket_pflege r where r.paket_id = p.id and r.pfleger_id = auth.uid()
      )))
    )
  )
$$;
create function private.material_paket_mitglied(p_paket uuid, p_nutzer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.material_paket_recht(p_paket, true, true) and exists (
    select 1 from public.material_paket p where p.id = p_paket and private.material_gruppe(p.chat_id, p_nutzer)
  )
$$;

create function private.material_geteilt(p_art text, p_id uuid, p_bearbeiten boolean default false) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and private.material_aktiv(p_art, p_id) and (
    exists (
      select 1 from public.material_freigabe f where f.art = p_art and f.material_id = p_id
        and f.empfaenger_id = auth.uid() and (not p_bearbeiten or f.bearbeiten)
        and private.material_gruppe(f.chat_id, f.empfaenger_id) and private.material_gruppe(f.chat_id, f.user_id)
        and private.material_besitzt(f.art, f.material_id, f.user_id)
    )
    or (not p_bearbeiten and exists (
      select 1 from public.material_paket_element e join public.material_paket p on p.id = e.paket_id
      where e.art = p_art and e.material_id = p_id and private.material_gruppe(p.chat_id, auth.uid())
        and private.material_gruppe(p.chat_id, e.user_id) and private.material_besitzt(e.art, e.material_id, e.user_id)
    ))
  )
$$;

create function private.material_storage_geteilt(p_pfad text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.datei d where d.speicher_pfad = p_pfad and private.material_geteilt('datei', d.id, false))
$$;
create function private.material_storage_aktiv(p_pfad text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.datei d where d.speicher_pfad = p_pfad and not private.material_aktiv('datei', d.id))
$$;
revoke all on function private.material_gruppe(uuid, uuid), private.material_paket_recht(uuid, boolean, boolean),
  private.material_paket_mitglied(uuid, uuid), private.material_geteilt(text, uuid, boolean),
  private.material_storage_geteilt(text), private.material_storage_aktiv(text) from public, anon, authenticated;
grant execute on function private.material_gruppe(uuid, uuid), private.material_paket_recht(uuid, boolean, boolean),
  private.material_paket_mitglied(uuid, uuid), private.material_geteilt(text, uuid, boolean),
  private.material_storage_geteilt(text), private.material_storage_aktiv(text) to authenticated;

alter table public.material_freigabe enable row level security;
alter table public.material_paket enable row level security;
alter table public.material_paket_element enable row level security;
alter table public.material_paket_pflege enable row level security;
revoke all on public.material_freigabe, public.material_paket, public.material_paket_element, public.material_paket_pflege from public, anon, authenticated;
grant select, insert, delete on public.material_freigabe, public.material_paket, public.material_paket_element, public.material_paket_pflege to authenticated;
grant update on public.material_freigabe to authenticated;
grant update (titel) on public.material_paket to authenticated;

create policy material_freigabe_lesen on public.material_freigabe for select to authenticated
  using (user_id = (select auth.uid()) or empfaenger_id = (select auth.uid()));
create policy material_freigabe_anlegen on public.material_freigabe for insert to authenticated
  with check (user_id = (select auth.uid()) and private.material_ist_meins(art, material_id)
    and private.material_gruppe(chat_id, user_id) and private.material_gruppe(chat_id, empfaenger_id));
create policy material_freigabe_aendern on public.material_freigabe for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.material_ist_meins(art, material_id)
    and private.material_gruppe(chat_id, user_id) and private.material_gruppe(chat_id, empfaenger_id));
create policy material_freigabe_loeschen on public.material_freigabe for delete to authenticated
  using (user_id = (select auth.uid()));

create policy material_paket_lesen on public.material_paket for select to authenticated
  using ((user_id = (select auth.uid()) and private.material_gruppe(chat_id, user_id)) or private.material_paket_recht(id, false, false));
create policy material_paket_anlegen on public.material_paket for insert to authenticated
  with check (user_id = (select auth.uid()) and private.material_gruppe(chat_id, user_id));
create policy material_paket_aendern on public.material_paket for update to authenticated
  using (private.material_paket_recht(id, true, false))
  with check (private.material_paket_recht(id, true, false));
create policy material_paket_loeschen on public.material_paket for delete to authenticated
  using (user_id = (select auth.uid()));

create policy material_paket_element_lesen on public.material_paket_element for select to authenticated
  using (private.material_paket_recht(paket_id, false, false));
create policy material_paket_element_anlegen on public.material_paket_element for insert to authenticated
  with check (user_id = (select auth.uid()) and private.material_paket_recht(paket_id, true, false)
    and private.material_ist_meins(art, material_id) and private.material_aktiv(art, material_id));
create policy material_paket_element_loeschen on public.material_paket_element for delete to authenticated
  using (private.material_paket_recht(paket_id, true, false));

create policy material_paket_pflege_lesen on public.material_paket_pflege for select to authenticated
  using (private.material_paket_recht(paket_id, true, true) or (pfleger_id = (select auth.uid()) and private.material_paket_recht(paket_id, false, false)));
create policy material_paket_pflege_anlegen on public.material_paket_pflege for insert to authenticated
  with check (user_id = (select auth.uid()) and private.material_paket_mitglied(paket_id, pfleger_id));
create policy material_paket_pflege_loeschen on public.material_paket_pflege for delete to authenticated
  using (private.material_paket_recht(paket_id, true, true));

create policy material_info_geteilt on public.material_ablage_info for select to authenticated
  using (papierkorb_am is null and private.material_geteilt(art, material_id));
create policy material_datei_geteilt on storage.objects for select to authenticated
  using (bucket_id = 'dateiablage' and private.material_storage_geteilt(name));
create policy material_datei_aktiv on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'dateiablage' or private.material_storage_aktiv(name));

-- Bearbeitende dürfen den Inhalt ändern. Identität, Besitzer und Dateipfad bleiben dem Eigentümer vorbehalten.
create function private.material_eigentuemer_schuetzen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and old.user_id is distinct from auth.uid() then
    if (pg_catalog.to_jsonb(old) - array['name','titel','inhalt','klartext','woerter','daten','folien','design','text','skript','fragen','notiz','autoren','verlag','ort','doi','url','jahr','geaendert_am'])
      is distinct from
      (pg_catalog.to_jsonb(new) - array['name','titel','inhalt','klartext','woerter','daten','folien','design','text','skript','fragen','notiz','autoren','verlag','ort','doi','url','jahr','geaendert_am']) then
      raise exception using errcode = '42501', message = 'Nur der Eigentümer kann diese Angaben ändern.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.material_eigentuemer_schuetzen() from public, anon, authenticated;

do $$
declare m record;
begin
  for m in select * from (values
    ('datei','datei'),('notiz','notiz'),('kk_stapel','stapel'),('praesentation','praesentation'),
    ('whiteboard','whiteboard'),('mindmap','mindmap'),('dokument','dokument'),('tabelle','tabelle'),
    ('transkript','transkript'),('podcast','podcast'),('quiz','quiz'),('literatur_quelle','literatur')
  ) as v(tabelle, art) loop
    execute pg_catalog.format('create policy material_geteilt_lesen on public.%I for select to authenticated using (private.material_geteilt(%L, id, false))', m.tabelle, m.art);
    execute pg_catalog.format('create policy material_geteilt_aendern on public.%I for update to authenticated using (private.material_geteilt(%L, id, true)) with check (private.material_geteilt(%L, id, true))', m.tabelle, m.art, m.art);
    execute pg_catalog.format('create trigger material_eigentuemer_schuetzen before update on public.%I for each row execute function private.material_eigentuemer_schuetzen()', m.tabelle);
  end loop;
end
$$;

create policy material_pdf_text_geteilt on public.quelle_seite for select to authenticated using (private.material_geteilt('datei', datei_id));
create policy material_transkript_teil_geteilt on public.transkript_teil for select to authenticated using (private.material_geteilt('transkript', transkript_id));
create policy material_karte_geteilt on public.kk_karte for select to authenticated
  using (private.material_ist_meins('stapel', stapel_id) or private.material_geteilt('stapel', stapel_id));
create policy material_karte_geteilt_anlegen on public.kk_karte for insert to authenticated
  with check (user_id = (select auth.uid()) and private.material_geteilt('stapel', stapel_id, true));
create policy material_karte_geteilt_aendern on public.kk_karte for update to authenticated
  using (private.material_ist_meins('stapel', stapel_id) or private.material_geteilt('stapel', stapel_id, true))
  with check (private.material_ist_meins('stapel', stapel_id) or private.material_geteilt('stapel', stapel_id, true));
create policy material_karte_geteilt_loeschen on public.kk_karte for delete to authenticated
  using (private.material_ist_meins('stapel', stapel_id) or private.material_geteilt('stapel', stapel_id, true));

-- Karten bleiben nach dem Entzug dem Stapel zugeordnet. Direkte Zugriffspfade prüfen immer den Stapel.
create function private.material_karte_schuetzen() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.stapel_id is distinct from old.stapel_id or new.user_id is distinct from old.user_id or new.id is distinct from old.id then
    raise exception using errcode = '42501', message = 'Stapel und Besitzer können hier nicht geändert werden.';
  end if;
  return new;
end;
$$;
revoke all on function private.material_karte_schuetzen() from public, anon, authenticated;
create trigger material_karte_schuetzen before update on public.kk_karte for each row execute function private.material_karte_schuetzen();
create policy material_karte_stapelrecht on public.kk_karte as restrictive for all to authenticated
  using (private.material_ist_meins('stapel', stapel_id) or private.material_geteilt('stapel', stapel_id))
  with check (private.material_ist_meins('stapel', stapel_id) or private.material_geteilt('stapel', stapel_id, true));

alter policy material_ablage_fach_einfuegen on public.material_ablage_fach
  with check (user_id = (select auth.uid()) and exists (select 1 from public.fach f where f.id = material_ablage_fach.fach_id and f.user_id = (select auth.uid()))
    and (private.material_ist_meins(art, material_id) or private.material_geteilt(art, material_id)));
alter policy material_ablage_fach_aendern on public.material_ablage_fach
  with check (user_id = (select auth.uid()) and exists (select 1 from public.fach f where f.id = material_ablage_fach.fach_id and f.user_id = (select auth.uid()))
    and (private.material_ist_meins(art, material_id) or private.material_geteilt(art, material_id)));

create function public.material_paket_erstellen(p_chat_id uuid, p_titel text, p_material jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare paket uuid;
begin
  if pg_catalog.jsonb_typeof(p_material) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_material) not between 1 and 100 then
    raise exception 'Wähle zwischen 1 und 100 Unterlagen.';
  end if;
  insert into public.material_paket (chat_id, titel) values (p_chat_id, p_titel) returning id into paket;
  insert into public.material_paket_element (paket_id, art, material_id)
    select paket, art, id from pg_catalog.jsonb_to_recordset(p_material) as m(art text, id uuid);
  return paket;
end;
$$;
revoke all on function public.material_paket_erstellen(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.material_paket_erstellen(uuid, text, jsonb) to authenticated;

-- Medien in geteilten Unterlagen gehören nur dann zur Freigabe, wenn sie denselben Eigentümer haben.
create function private.material_medium_geteilt(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.material_aktiv('datei', p_id) and exists (
    select 1 from public.datei d where d.id = p_id and (
      exists (select 1 from public.transkript_teil tt join public.transkript t on tt.transkript_id = t.id
        where tt.datei_id = d.id and t.user_id = d.user_id and private.material_geteilt('transkript', t.id))
      or exists (select 1 from public.praesentation p
        where p.user_id = d.user_id and private.material_geteilt('praesentation', p.id)
          and pg_catalog.jsonb_path_exists(p.folien, '$[*] ? (@.bild == $id)'::jsonpath, pg_catalog.jsonb_build_object('id', d.id::text)))
      or exists (select 1 from public.whiteboard w
        where w.user_id = d.user_id and private.material_geteilt('whiteboard', w.id)
          and pg_catalog.jsonb_path_exists(w.daten, '$.elemente[*] ? (@.typ == "bild" && @.datei_id == $id)'::jsonpath,
            pg_catalog.jsonb_build_object('id', d.id::text)))
    )
  )
$$;
revoke all on function private.material_medium_geteilt(uuid) from public, anon, authenticated;
grant execute on function private.material_medium_geteilt(uuid) to authenticated;
create policy material_medium_geteilt on public.datei for select to authenticated
  using (private.material_medium_geteilt(id));
create or replace function private.material_storage_geteilt(p_pfad text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.datei d where d.speicher_pfad = p_pfad and
    (private.material_geteilt('datei', d.id, false) or private.material_medium_geteilt(d.id)))
$$;
