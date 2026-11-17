-- Semestertermine je Hochschule, gemeinsam gepflegt: Was eine Person einträgt, sehen alle derselben Hochschule.
-- Ohne Eintrag nutzt die App Standardwerte nach Hochschulart (Uni/FH).
create table public.hochschule_semester (
  hochschule_id text not null references public.hochschule (id) on delete cascade,
  semester text not null check (semester ~ '^\d{4}[SW]$'),   -- z. B. 2026W = Wintersemester 2026/27
  vorlesung_beginn date not null,
  vorlesung_ende date not null,
  pruefung_beginn date,
  pruefung_ende date,
  rueckmeldung_bis date,
  geaendert_von uuid references auth.users (id) on delete set null,
  geaendert_am timestamptz not null default now(),
  primary key (hochschule_id, semester),
  check (vorlesung_ende > vorlesung_beginn),
  check (pruefung_ende is null or pruefung_beginn is null or pruefung_ende >= pruefung_beginn)
);
alter table public.hochschule_semester enable row level security;

create policy "Semestertermine lesen" on public.hochschule_semester for select to authenticated using (true);

-- Eintragen und ändern darf, wer diese Hochschule im Profil gewählt hat
create policy "Semestertermine der eigenen Hochschule eintragen" on public.hochschule_semester for insert to authenticated
  with check (
    geaendert_von = (select auth.uid())
    and exists (select 1 from public.settings s where s.user_id = (select auth.uid()) and s.hochschule_id = hochschule_semester.hochschule_id)
  );
create policy "Semestertermine der eigenen Hochschule ändern" on public.hochschule_semester for update to authenticated
  using (exists (select 1 from public.settings s where s.user_id = (select auth.uid()) and s.hochschule_id = hochschule_semester.hochschule_id))
  with check (
    geaendert_von = (select auth.uid())
    and exists (select 1 from public.settings s where s.user_id = (select auth.uid()) and s.hochschule_id = hochschule_semester.hochschule_id)
  );
