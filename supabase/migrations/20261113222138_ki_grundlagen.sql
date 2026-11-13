-- KI-L1 / KI-D1: Nutzungslimit und Einwilligung für KI-Funktionen.

-- ---------------------------------------------------------------------------
-- Nutzungsprotokoll: eine Zeile pro KI-Anfrage (auch fehlgeschlagene zählen)
-- ---------------------------------------------------------------------------
create table public.ki_nutzung (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  funktion text not null check (funktion ~ '^[a-z_]{1,40}$'),
  tokens_ein integer null check (tokens_ein >= 0),
  tokens_aus integer null check (tokens_aus >= 0),
  erfolgreich boolean not null default false,
  erstellt_am timestamptz not null default now()
);

create index ki_nutzung_user_zeit_idx on public.ki_nutzung (user_id, erstellt_am desc);

alter table public.ki_nutzung enable row level security;

-- Nur lesen. Bewusst KEINE insert/update/delete-Policy: sonst könnte man eigene
-- Zeilen löschen und so das Tageslimit zurücksetzen. Geschrieben wird nur über
-- die beiden Funktionen unten.
create policy "ki_nutzung_select_eigene" on public.ki_nutzung
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Anfrage buchen: prüft das Tageslimit (Europe/Berlin) und legt die Zeile an
-- ---------------------------------------------------------------------------
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

  -- Parallele Anfragen desselben Nutzers nacheinander abarbeiten (Race Condition)
  perform pg_advisory_xact_lock(hashtext('ki_nutzung:' || v_user::text));

  select count(*) into v_anzahl
  from public.ki_nutzung
  where user_id = v_user and erstellt_am >= v_heute;

  if v_anzahl >= p_limit then
    raise exception 'KI_LIMIT';
  end if;

  insert into public.ki_nutzung (user_id, funktion)
  values (v_user, p_funktion)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anfrage abschließen: Tokens und Erfolg nachtragen (nur eigene, nur einmal)
-- ---------------------------------------------------------------------------
create or replace function public.ki_nutzung_abschliessen(
  p_id uuid,
  p_tokens_ein integer,
  p_tokens_aus integer,
  p_erfolgreich boolean
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ki_nutzung
  set
    tokens_ein = greatest(coalesce(p_tokens_ein, 0), 0),
    tokens_aus = greatest(coalesce(p_tokens_aus, 0), 0),
    erfolgreich = coalesce(p_erfolgreich, false)
  where id = p_id
    and user_id = (select auth.uid())
    and tokens_ein is null;
$$;

revoke execute on function public.ki_nutzung_buchen(text, integer) from public, anon;
revoke execute on function public.ki_nutzung_abschliessen(uuid, integer, integer, boolean) from public, anon;
grant execute on function public.ki_nutzung_buchen(text, integer) to authenticated;
grant execute on function public.ki_nutzung_abschliessen(uuid, integer, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- KI-D1: Einwilligung (null = nicht eingewilligt bzw. widerrufen)
-- ---------------------------------------------------------------------------
alter table public.settings add column ki_einwilligung timestamptz null;
