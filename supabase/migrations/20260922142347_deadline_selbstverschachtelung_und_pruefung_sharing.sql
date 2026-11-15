-- Eine Deadline kann jetzt ebenfalls Unteraufgaben (weitere Deadlines) haben,
-- nicht nur Todo/Pruefung als Elternobjekt.
alter table public.deadline
  add column parent_deadline_id uuid references public.deadline(id) on delete cascade;
create index deadline_parent_deadline_id_idx on public.deadline(parent_deadline_id);

-- Pruefung-RLS auf echte Mitgliedschaft ausweiten (analog zu deadline aus
-- Paket 1), damit eine ueber die Detailansicht eingeladene Person eine
-- geteilte Pruefung auch tatsaechlich sehen/bearbeiten kann.
drop policy "eigene Zeilen lesen" on public.pruefung;
create policy "eigene Zeilen lesen" on public.pruefung
  for select using ( public.ist_mitglied('pruefung', id) );

drop policy "eigene Zeilen aendern" on public.pruefung;
create policy "eigene Zeilen aendern" on public.pruefung
  for update using ( public.ist_mitglied('pruefung', id) );

drop policy "eigene Zeilen loeschen" on public.pruefung;
create policy "eigene Zeilen loeschen" on public.pruefung
  for delete using ( public.ist_mitglied('pruefung', id) );
