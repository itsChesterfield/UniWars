-- KI-00b: Fundament für den KI-Vollausbau (Mengen-Kontingente, KI-Kennzeichnung, Audio-Einwilligung).

-- ---------------------------------------------------------------------------
-- Nutzung mit Mengen: Audio wird in Sekunden, Vorlesen in Zeichen abgerechnet.
-- "kontingent" trennt Limits, die sich dieselbe Einheit teilen (Text-Funktionen
-- und Assistent zählen beide "Anfragen", haben aber getrennte Tageslimits).
-- ---------------------------------------------------------------------------
alter table public.ki_nutzung
  add column kontingent text not null default 'text'
    check (kontingent in ('text', 'chat', 'audio', 'tts', 'gespraech')),
  add column einheit text not null default 'anfrage'
    check (einheit in ('anfrage', 'audio_sekunden', 'tts_zeichen', 'gespraech_sekunden')),
  add column menge integer not null default 1 check (menge > 0);

create index ki_nutzung_kontingent_idx on public.ki_nutzung (user_id, kontingent, einheit, erstellt_am desc);

-- Text-Funktionen (KI-01 …): zählt jetzt nur noch das Text-Kontingent, sonst unverändert
create or replace function public.ki_nutzung_buchen(p_funktion text, p_limit integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_heute timestamptz := (date_trunc('day', now() at time zone 'Europe/Berlin')) at time zone 'Europe/Berlin';
  v_anzahl integer;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'NICHT_ANGEMELDET';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'KI_LIMIT_UNGUELTIG';
  end if;

  perform pg_advisory_xact_lock(hashtext('ki_nutzung:' || v_user::text));

  select count(*) into v_anzahl
  from public.ki_nutzung
  where user_id = v_user and kontingent = 'text' and erstellt_am >= v_heute;

  if v_anzahl >= p_limit then
    raise exception 'KI_LIMIT';
  end if;

  insert into public.ki_nutzung (user_id, funktion, kontingent, einheit, menge)
  values (v_user, p_funktion, 'text', 'anfrage', 1)
  returning id into v_id;

  return v_id;
end;
$$;

-- Allgemeine Buchung mit Menge und Zeitraum (Tag oder Monat, jeweils Europe/Berlin)
create or replace function public.ki_kontingent_buchen(
  p_kontingent text,
  p_funktion text,
  p_einheit text,
  p_menge integer,
  p_limit integer,
  p_zeitraum text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_start timestamptz;
  v_summe bigint;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'NICHT_ANGEMELDET';
  end if;
  if p_menge is null or p_menge < 1 then
    raise exception 'KI_MENGE_UNGUELTIG';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'KI_LIMIT_UNGUELTIG';
  end if;
  if p_zeitraum = 'tag' then
    v_start := (date_trunc('day', now() at time zone 'Europe/Berlin')) at time zone 'Europe/Berlin';
  elsif p_zeitraum = 'monat' then
    v_start := (date_trunc('month', now() at time zone 'Europe/Berlin')) at time zone 'Europe/Berlin';
  else
    raise exception 'KI_ZEITRAUM_UNGUELTIG';
  end if;

  -- gleiches Schloss wie ki_nutzung_buchen: parallele Anfragen eines Nutzers nacheinander
  perform pg_advisory_xact_lock(hashtext('ki_nutzung:' || v_user::text));

  select coalesce(sum(menge), 0) into v_summe
  from public.ki_nutzung
  where user_id = v_user
    and kontingent = p_kontingent
    and einheit = p_einheit
    and erstellt_am >= v_start;

  if v_summe + p_menge > p_limit then
    raise exception 'KI_LIMIT';
  end if;

  insert into public.ki_nutzung (user_id, funktion, kontingent, einheit, menge)
  values (v_user, p_funktion, p_kontingent, p_einheit, p_menge)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.ki_kontingent_buchen(text, text, text, integer, integer, text) from public, anon;
grant execute on function public.ki_kontingent_buchen(text, text, text, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- KI-ALL-04: Kennzeichnung von KI-erzeugten Inhalten
-- ---------------------------------------------------------------------------
alter table public.notiz add column ki_erzeugt boolean not null default false;
alter table public.kk_karte add column ki_erzeugt boolean not null default false;
alter table public.mindmap add column ki_erzeugt boolean not null default false;
alter table public.praesentation add column ki_erzeugt boolean not null default false;
alter table public.literatur_quelle add column ki_erzeugt boolean not null default false;

-- ---------------------------------------------------------------------------
-- KI-D2: Einwilligung für Audio (null = nicht eingewilligt bzw. widerrufen)
-- ---------------------------------------------------------------------------
alter table public.settings add column ki_audio_einwilligung timestamptz null;
