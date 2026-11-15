-- Chat (CHAT-01 … CHAT-07, siehe UniWars-Hubs-Spezifikation).
-- Schreiben läuft ausschließlich über SECURITY-DEFINER-Funktionen, die Mitgliedschaft,
-- Blockierungen und Anhänge prüfen. Direkt dürfen Clients nur lesen.

create table public.chat (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('DIREKT', 'GRUPPE')),
  name text null check (name is null or char_length(btrim(name)) between 1 and 80),
  erstellt_von uuid null references auth.users(id) on delete set null,
  deadline_id uuid null references public.deadline(id) on delete set null,
  erstellt_am timestamptz not null default now(),
  letzte_nachricht_am timestamptz not null default now()
);

create unique index chat_deadline_einmalig_idx on public.chat (deadline_id) where deadline_id is not null;
create index chat_erstellt_von_idx on public.chat (erstellt_von);

create table public.chat_mitglied (
  chat_id uuid not null references public.chat(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  beigetreten_am timestamptz not null default now(),
  zuletzt_gelesen timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create index chat_mitglied_user_idx on public.chat_mitglied (user_id);

create table public.chat_nachricht (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chat(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  text text not null default '' check (char_length(text) <= 2000),
  -- CHAT-04: { typ: datei|deadline|todo, id, titel, pfad?, mime?, faellig_am? }
  anhang jsonb null,
  geloescht boolean not null default false,
  erstellt_am timestamptz not null default now()
);

create index chat_nachricht_chat_idx on public.chat_nachricht (chat_id, erstellt_am desc);
create index chat_nachricht_user_idx on public.chat_nachricht (user_id);
create index chat_nachricht_pfad_idx on public.chat_nachricht ((anhang ->> 'pfad')) where anhang ? 'pfad';

-- CHAT-07
create table public.nutzer_blockiert (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blockiert_id uuid not null references auth.users(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  primary key (user_id, blockiert_id),
  check (user_id <> blockiert_id)
);

create index nutzer_blockiert_ziel_idx on public.nutzer_blockiert (blockiert_id);

create table public.chat_meldung (
  id uuid primary key default gen_random_uuid(),
  von_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gemeldet_user_id uuid not null references auth.users(id) on delete cascade,
  chat_id uuid null references public.chat(id) on delete set null,
  grund text not null check (char_length(btrim(grund)) between 1 and 1000),
  erstellt_am timestamptz not null default now()
);

create index chat_meldung_von_idx on public.chat_meldung (von_user_id);
create index chat_meldung_gemeldet_idx on public.chat_meldung (gemeldet_user_id);
create index chat_meldung_chat_idx on public.chat_meldung (chat_id);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen (SECURITY DEFINER, damit Policies nicht rekursiv werden)
-- ---------------------------------------------------------------------------
create or replace function public.ist_chat_mitglied(p_chat_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_mitglied m
    where m.chat_id = p_chat_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.ist_blockiert(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.nutzer_blockiert b
    where (b.user_id = p_a and b.blockiert_id = p_b) or (b.user_id = p_b and b.blockiert_id = p_a)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: lesen nur als Mitglied, schreiben nur über Funktionen
-- ---------------------------------------------------------------------------
alter table public.chat enable row level security;
alter table public.chat_mitglied enable row level security;
alter table public.chat_nachricht enable row level security;
alter table public.nutzer_blockiert enable row level security;
alter table public.chat_meldung enable row level security;

create policy "chat_select_mitglied" on public.chat
  for select to authenticated using (public.ist_chat_mitglied(id));

create policy "chat_mitglied_select" on public.chat_mitglied
  for select to authenticated using (public.ist_chat_mitglied(chat_id));
-- Gruppe verlassen
create policy "chat_mitglied_delete_selbst" on public.chat_mitglied
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "chat_nachricht_select_mitglied" on public.chat_nachricht
  for select to authenticated using (public.ist_chat_mitglied(chat_id));

create policy "nutzer_blockiert_select_eigene" on public.nutzer_blockiert
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "nutzer_blockiert_insert_eigene" on public.nutzer_blockiert
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "nutzer_blockiert_delete_eigene" on public.nutzer_blockiert
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "chat_meldung_insert_eigene" on public.chat_meldung
  for insert to authenticated with check ((select auth.uid()) = von_user_id);

-- CHAT-04: angehängte Dateien dürfen alle Chat-Mitglieder öffnen
create policy "dateiablage_select_chat_anhang" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dateiablage'
    and exists (
      select 1 from public.chat_nachricht n
      where n.anhang ->> 'pfad' = storage.objects.name and not n.geloescht
    )
  );

-- ---------------------------------------------------------------------------
-- Funktionen
-- ---------------------------------------------------------------------------

/** CHAT-01: Direktchat finden oder anlegen. */
create or replace function public.chat_direkt_starten(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ich uuid := (select auth.uid());
  v_chat uuid;
begin
  if v_ich is null then raise exception 'NICHT_ANGEMELDET'; end if;
  if p_user_id is null or p_user_id = v_ich then raise exception 'UNGUELTIG'; end if;
  if not exists (select 1 from public.settings s where s.user_id = p_user_id and s.username is not null) then
    raise exception 'NICHT_GEFUNDEN';
  end if;
  if public.ist_blockiert(v_ich, p_user_id) then raise exception 'BLOCKIERT'; end if;

  select c.id into v_chat
  from public.chat c
  join public.chat_mitglied a on a.chat_id = c.id and a.user_id = v_ich
  join public.chat_mitglied b on b.chat_id = c.id and b.user_id = p_user_id
  where c.typ = 'DIREKT'
  limit 1;
  if v_chat is not null then return v_chat; end if;

  insert into public.chat (typ, erstellt_von) values ('DIREKT', v_ich) returning id into v_chat;
  insert into public.chat_mitglied (chat_id, user_id) values (v_chat, v_ich), (v_chat, p_user_id);
  return v_chat;
end;
$$;

/** CHAT-02: Gruppe mit Name und Mitgliedern (max. 20 inkl. mir). */
create or replace function public.chat_gruppe_erstellen(p_name text, p_user_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ich uuid := (select auth.uid());
  v_chat uuid;
  v_ids uuid[];
begin
  if v_ich is null then raise exception 'NICHT_ANGEMELDET'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then raise exception 'NAME_UNGUELTIG'; end if;
  select array_agg(distinct x) into v_ids
  from unnest(coalesce(p_user_ids, '{}') || v_ich) x
  where exists (select 1 from public.settings s where s.user_id = x and s.username is not null)
    and (x = v_ich or not public.ist_blockiert(v_ich, x));
  if coalesce(array_length(v_ids, 1), 0) < 2 then raise exception 'ZU_WENIG_MITGLIEDER'; end if;
  if array_length(v_ids, 1) > 20 then raise exception 'ZU_VIELE_MITGLIEDER'; end if;

  insert into public.chat (typ, name, erstellt_von) values ('GRUPPE', btrim(p_name), v_ich) returning id into v_chat;
  insert into public.chat_mitglied (chat_id, user_id) select v_chat, x from unnest(v_ids) x;
  return v_chat;
end;
$$;

/** CHAT-02: Gruppenchat zu einer geteilten Gruppenarbeit (alle angenommenen Mitglieder). */
create or replace function public.chat_fuer_deadline(p_deadline_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ich uuid := (select auth.uid());
  v_chat uuid;
  v_titel text;
begin
  if v_ich is null then raise exception 'NICHT_ANGEMELDET'; end if;
  if not public.ist_mitglied('deadline', p_deadline_id) then raise exception 'KEIN_MITGLIED'; end if;
  select d.titel into v_titel from public.deadline d where d.id = p_deadline_id;

  select c.id into v_chat from public.chat c where c.deadline_id = p_deadline_id;
  if v_chat is null then
    insert into public.chat (typ, name, erstellt_von, deadline_id)
    values ('GRUPPE', left(coalesce(v_titel, 'Gruppenarbeit'), 80), v_ich, p_deadline_id)
    returning id into v_chat;
  end if;

  -- Ersteller + alle angenommenen Einladungen (max. 20)
  insert into public.chat_mitglied (chat_id, user_id)
  select v_chat, m.user_id
  from (
    select d.user_id from public.deadline d where d.id = p_deadline_id
    union
    select e.an_user_id from public.einladung e
    where e.ziel_typ = 'deadline' and e.ziel_id = p_deadline_id and e.status = 'ANGENOMMEN'
  ) m
  limit 20
  on conflict do nothing;
  return v_chat;
end;
$$;

/** CHAT-03 / CHAT-04: Nachricht senden; Anhang wird serverseitig aus eigenen Daten gebaut. */
create or replace function public.nachricht_senden(
  p_chat_id uuid,
  p_text text,
  p_anhang_typ text default null,
  p_anhang_id uuid default null
)
returns public.chat_nachricht
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ich uuid := (select auth.uid());
  v_typ text;
  v_anhang jsonb;
  v_text text := coalesce(p_text, '');
  v_zeile public.chat_nachricht;
begin
  if v_ich is null then raise exception 'NICHT_ANGEMELDET'; end if;
  if not exists (select 1 from public.chat_mitglied m where m.chat_id = p_chat_id and m.user_id = v_ich) then
    raise exception 'KEIN_MITGLIED';
  end if;
  if char_length(v_text) > 2000 then raise exception 'ZU_LANG'; end if;

  select c.typ into v_typ from public.chat c where c.id = p_chat_id;
  if v_typ = 'DIREKT' and exists (
    select 1 from public.chat_mitglied m
    where m.chat_id = p_chat_id and m.user_id <> v_ich and public.ist_blockiert(v_ich, m.user_id)
  ) then
    raise exception 'BLOCKIERT';
  end if;

  if p_anhang_typ = 'datei' then
    select jsonb_build_object('typ', 'datei', 'id', d.id, 'titel', d.name, 'pfad', d.speicher_pfad, 'mime', d.mime_typ)
      into v_anhang
    from public.datei d where d.id = p_anhang_id and d.user_id = v_ich;
  elsif p_anhang_typ = 'deadline' then
    select jsonb_build_object('typ', 'deadline', 'id', d.id, 'titel', d.titel, 'faellig_am', d.faellig_am)
      into v_anhang
    from public.deadline d where d.id = p_anhang_id and public.ist_mitglied('deadline', d.id);
  elsif p_anhang_typ = 'todo' then
    select jsonb_build_object('typ', 'todo', 'id', t.id, 'titel', t.titel, 'faellig_am', t.faellig_am)
      into v_anhang
    from public.todo t where t.id = p_anhang_id and public.ist_mitglied('todo', t.id);
  elsif p_anhang_typ is not null then
    raise exception 'ANHANG_UNGUELTIG';
  end if;
  if p_anhang_typ is not null and v_anhang is null then raise exception 'ANHANG_NICHT_GEFUNDEN'; end if;
  if btrim(v_text) = '' and v_anhang is null then raise exception 'LEER'; end if;

  insert into public.chat_nachricht (chat_id, user_id, text, anhang)
  values (p_chat_id, v_ich, v_text, v_anhang)
  returning * into v_zeile;

  update public.chat set letzte_nachricht_am = v_zeile.erstellt_am where id = p_chat_id;
  update public.chat_mitglied set zuletzt_gelesen = v_zeile.erstellt_am where chat_id = p_chat_id and user_id = v_ich;
  return v_zeile;
end;
$$;

/** CHAT-06: nur eigene Nachrichten; Inhalt wird entfernt. */
create or replace function public.nachricht_loeschen(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_nachricht
  set geloescht = true, text = '', anhang = null
  where id = p_id and user_id = (select auth.uid());
  if not found then raise exception 'NICHT_ERLAUBT'; end if;
end;
$$;

/** CHAT-05: Chat als gelesen markieren. */
create or replace function public.chat_gelesen(p_chat_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.chat_mitglied set zuletzt_gelesen = now()
  where chat_id = p_chat_id and user_id = (select auth.uid());
$$;

/** CHAT-05: Chatliste mit Anzeigename, letzter Nachricht und Ungelesen-Zahl. */
create or replace function public.chat_uebersicht()
returns table (
  chat_id uuid,
  typ text,
  name text,
  partner_id uuid,
  deadline_id uuid,
  letzte_nachricht text,
  letzte_nachricht_am timestamptz,
  ungelesen integer,
  mitglieder integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.typ,
    case when c.typ = 'DIREKT' then coalesce(ps.username, 'Unbekannt') else c.name end,
    p.user_id,
    c.deadline_id,
    (
      select case when n.geloescht then 'Nachricht gelöscht'
                  when n.text = '' and n.anhang is not null then '📎 ' || (n.anhang ->> 'titel')
                  else left(n.text, 120) end
      from public.chat_nachricht n where n.chat_id = c.id order by n.erstellt_am desc limit 1
    ),
    c.letzte_nachricht_am,
    (
      select count(*)::integer from public.chat_nachricht n
      where n.chat_id = c.id and n.erstellt_am > m.zuletzt_gelesen and n.user_id is distinct from m.user_id
        and not public.ist_blockiert(m.user_id, coalesce(n.user_id, m.user_id))
    ),
    (select count(*)::integer from public.chat_mitglied x where x.chat_id = c.id)
  from public.chat_mitglied m
  join public.chat c on c.id = m.chat_id
  left join public.chat_mitglied p on c.typ = 'DIREKT' and p.chat_id = c.id and p.user_id <> m.user_id
  left join public.settings ps on ps.user_id = p.user_id
  where m.user_id = (select auth.uid())
  order by c.letzte_nachricht_am desc;
$$;

/** Mitglieder eines Chats mit Nutzernamen (nur für Mitglieder). */
create or replace function public.chat_mitglieder(p_chat_id uuid)
returns table (user_id uuid, username text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, coalesce(s.username, 'Unbekannt')
  from public.chat_mitglied m
  left join public.settings s on s.user_id = m.user_id
  where m.chat_id = p_chat_id and public.ist_chat_mitglied(p_chat_id)
  order by s.username;
$$;

/** CHAT-01: Suche über exakte E-Mail-Adresse (keine Teil-Treffer, damit niemand E-Mails abgrasen kann). */
create or replace function public.benutzer_per_email(p_email text)
returns table (user_id uuid, username text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, s.username
  from auth.users u
  join public.settings s on s.user_id = u.id
  where lower(u.email) = lower(btrim(p_email))
    and s.username is not null
    and u.id <> (select auth.uid())
  limit 1;
$$;

/** Für den Punkt in der Sidebar. */
create or replace function public.chat_ungelesen_gesamt()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.chat_mitglied m
  join public.chat_nachricht n on n.chat_id = m.chat_id
  where m.user_id = (select auth.uid())
    and n.erstellt_am > m.zuletzt_gelesen
    and n.user_id is distinct from m.user_id
    and not public.ist_blockiert(m.user_id, coalesce(n.user_id, m.user_id));
$$;

-- Nur angemeldete Nutzer dürfen die Funktionen aufrufen
revoke execute on function public.ist_chat_mitglied(uuid) from public, anon;
revoke execute on function public.ist_blockiert(uuid, uuid) from public, anon;
revoke execute on function public.chat_direkt_starten(uuid) from public, anon;
revoke execute on function public.chat_gruppe_erstellen(text, uuid[]) from public, anon;
revoke execute on function public.chat_fuer_deadline(uuid) from public, anon;
revoke execute on function public.nachricht_senden(uuid, text, text, uuid) from public, anon;
revoke execute on function public.nachricht_loeschen(uuid) from public, anon;
revoke execute on function public.chat_gelesen(uuid) from public, anon;
revoke execute on function public.chat_uebersicht() from public, anon;
revoke execute on function public.chat_mitglieder(uuid) from public, anon;
revoke execute on function public.benutzer_per_email(text) from public, anon;
revoke execute on function public.chat_ungelesen_gesamt() from public, anon;
grant execute on function public.ist_chat_mitglied(uuid) to authenticated;
grant execute on function public.ist_blockiert(uuid, uuid) to authenticated;
grant execute on function public.chat_direkt_starten(uuid) to authenticated;
grant execute on function public.chat_gruppe_erstellen(text, uuid[]) to authenticated;
grant execute on function public.chat_fuer_deadline(uuid) to authenticated;
grant execute on function public.nachricht_senden(uuid, text, text, uuid) to authenticated;
grant execute on function public.nachricht_loeschen(uuid) to authenticated;
grant execute on function public.chat_gelesen(uuid) to authenticated;
grant execute on function public.chat_uebersicht() to authenticated;
grant execute on function public.chat_mitglieder(uuid) to authenticated;
grant execute on function public.benutzer_per_email(text) to authenticated;
grant execute on function public.chat_ungelesen_gesamt() to authenticated;

-- CHAT-03: Echtzeit für neue/gelöschte Nachrichten (RLS gilt auch hier)
alter publication supabase_realtime add table public.chat_nachricht;

-- Nachträglich (Migration chat_ist_blockiert_intern): ist_blockiert nur intern nutzbar,
-- sonst ließe sich abfragen, ob sich zwei fremde Nutzer blockiert haben.
revoke execute on function public.ist_blockiert(uuid, uuid) from authenticated;
