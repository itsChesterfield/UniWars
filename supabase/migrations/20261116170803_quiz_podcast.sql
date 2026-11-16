-- Quiz (wie Quizgecko): KI-Quiz aus PDFs/Notizen/Fach mit mehreren Fragetypen, Versuchen und Podcasts
create table public.quiz (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titel text not null check (char_length(titel) between 1 and 200),
  fach_id uuid null references public.fach(id) on delete set null,
  quellen jsonb not null default '[]',
  fragen jsonb not null default '[]',
  einstellungen jsonb not null default '{}',
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now()
);
create index quiz_user_idx on public.quiz (user_id, geaendert_am desc);
create trigger quiz_geaendert_am before update on public.quiz for each row execute function public.setze_geaendert_am();

create table public.quiz_versuch (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quiz(id) on delete cascade,
  modus text not null default 'alle' check (modus in ('alle', 'schwaechen')),
  antworten jsonb not null default '[]',
  punkte numeric not null default 0,
  max_punkte integer not null default 0,
  erstellt_am timestamptz not null default now()
);
create index quiz_versuch_quiz_idx on public.quiz_versuch (quiz_id, erstellt_am desc);
create index quiz_versuch_user_idx on public.quiz_versuch (user_id);

create table public.podcast (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titel text not null check (char_length(titel) between 1 and 200),
  fach_id uuid null references public.fach(id) on delete set null,
  quellen jsonb not null default '[]',
  skript jsonb not null default '[]',
  erstellt_am timestamptz not null default now()
);
create index podcast_user_idx on public.podcast (user_id, erstellt_am desc);

alter table public.quiz enable row level security;
alter table public.quiz_versuch enable row level security;
alter table public.podcast enable row level security;

create policy "quiz_eigene" on public.quiz for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (fach_id is null or exists (select 1 from public.fach f where f.id = fach_id and f.user_id = (select auth.uid()))));
create policy "quiz_versuch_eigene" on public.quiz_versuch for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.quiz q where q.id = quiz_id and q.user_id = (select auth.uid())));
create policy "podcast_eigene" on public.podcast for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (fach_id is null or exists (select 1 from public.fach f where f.id = fach_id and f.user_id = (select auth.uid()))));
