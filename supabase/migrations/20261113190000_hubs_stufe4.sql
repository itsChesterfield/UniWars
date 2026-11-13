-- Hubs Stufe 4: MindMap und Whiteboard (siehe UniWars-Hubs-Spezifikation).
-- Inhalt jeweils als JSON (MM-07: Knoten mit id, text, x, y, farbe, parent_id; WB-06: Elemente).

create table public.mindmap (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fach_id uuid null references public.fach(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  daten jsonb not null default '{"knoten":[]}'::jsonb,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint mindmap_daten_groesse check (pg_column_size(daten) <= 2000000)
);

create index mindmap_user_idx on public.mindmap (user_id, geaendert_am desc);
create index mindmap_fach_idx on public.mindmap (fach_id);

create trigger mindmap_geaendert_am
  before update on public.mindmap
  for each row execute function public.setze_geaendert_am();

alter table public.mindmap enable row level security;

create policy "mindmap_select_eigene" on public.mindmap
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "mindmap_insert_eigene" on public.mindmap
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "mindmap_update_eigene" on public.mindmap
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "mindmap_delete_eigene" on public.mindmap
  for delete to authenticated using ((select auth.uid()) = user_id);

create table public.whiteboard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fach_id uuid null references public.fach(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  daten jsonb not null default '{"elemente":[]}'::jsonb,
  erstellt_am timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint whiteboard_daten_groesse check (pg_column_size(daten) <= 5000000)
);

create index whiteboard_user_idx on public.whiteboard (user_id, geaendert_am desc);
create index whiteboard_fach_idx on public.whiteboard (fach_id);

create trigger whiteboard_geaendert_am
  before update on public.whiteboard
  for each row execute function public.setze_geaendert_am();

alter table public.whiteboard enable row level security;

create policy "whiteboard_select_eigene" on public.whiteboard
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "whiteboard_insert_eigene" on public.whiteboard
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "whiteboard_update_eigene" on public.whiteboard
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "whiteboard_delete_eigene" on public.whiteboard
  for delete to authenticated using ((select auth.uid()) = user_id);
