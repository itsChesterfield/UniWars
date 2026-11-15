-- Unteraufgaben (als Deadline unter Todo/Pruefung/Deadline) konnten bisher
-- niemandem aus dem Team zugewiesen werden, weil deadline (anders als todo)
-- keine zugewiesen_an-Spalte hatte. Analog zu todo nachgezogen, damit man
-- beim Anlegen einer Unteraufgabe eine Person aus dem Team festlegen kann.

alter table public.deadline
  add column zugewiesen_an uuid null references auth.users(id) on delete set null;

-- Lese-/Aenderungs-Policy analog zu todo um zugewiesen_an erweitern (direkter
-- Spaltenvergleich, kein Self-Referencing-Subquery -- siehe Migration
-- 20260922162500 zur Begruendung, warum die einladung-Mitgliedschaft separat
-- statt ueber ist_mitglied() geprueft wird).

drop policy "eigene Zeilen lesen" on public.deadline;
create policy "eigene Zeilen lesen" on public.deadline
  for select using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = zugewiesen_an
    or exists (
      select 1 from public.einladung e
      where e.ziel_typ = 'deadline' and e.ziel_id = deadline.id
        and e.an_user_id = (select auth.uid()) and e.status = 'ANGENOMMEN'
    )
  );

drop policy "eigene Zeilen aendern" on public.deadline;
create policy "eigene Zeilen aendern" on public.deadline
  for update using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = zugewiesen_an
    or exists (
      select 1 from public.einladung e
      where e.ziel_typ = 'deadline' and e.ziel_id = deadline.id
        and e.an_user_id = (select auth.uid()) and e.status = 'ANGENOMMEN'
    )
  );
