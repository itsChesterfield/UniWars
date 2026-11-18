-- Rollen: user < moderator < admin (Paket 1, Plan docs/plaene/admin-passkey.md Abschnitt 3.1)
-- Zeilen werden nur fuer Moderatoren und Admins angelegt; ohne Zeile ist die Rolle 'user'.
create type public.app_role as enum ('user', 'moderator', 'admin');

create table public.user_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        public.app_role not null default 'user',
  erstellt_am timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- Lesen: alle angemeldeten Nutzer (fuer die Badges)
create policy "user_roles lesen"
  on public.user_roles for select
  to authenticated
  using (true);

-- KEINE insert/update/delete-Policy. Schreiben nur mit dem Service-Key.

-- Rolle des aktuellen Nutzers. Fehlt die Zeile, ist die Rolle 'user'.
create or replace function public.aktuelle_rolle()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'user'::public.app_role
  );
$$;

-- Hat der aktuelle Nutzer mindestens diese Rolle?
create or replace function public.hat_rolle(min_rolle public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.aktuelle_rolle() >= min_rolle;
$$;
