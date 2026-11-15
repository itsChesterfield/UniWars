-- Indizes für alle Fremdschlüssel
create index if not exists idx_fach_user_id on fach(user_id);
create index if not exists idx_deadline_user_id on deadline(user_id);
create index if not exists idx_deadline_fach_id on deadline(fach_id);
create index if not exists idx_todo_user_id on todo(user_id);
create index if not exists idx_todo_fach_id on todo(fach_id);
create index if not exists idx_note_user_id on note(user_id);
create index if not exists idx_note_fach_id on note(fach_id);
create index if not exists idx_pruefung_user_id on pruefung(user_id);
create index if not exists idx_pruefung_fach_id on pruefung(fach_id);
create index if not exists idx_stundenplan_eintrag_user_id on stundenplan_eintrag(user_id);
create index if not exists idx_stundenplan_eintrag_fach_id on stundenplan_eintrag(fach_id);
create index if not exists idx_lern_session_user_id on lern_session(user_id);
create index if not exists idx_lern_session_fach_id on lern_session(fach_id);
create index if not exists idx_externer_feed_user_id on externer_feed(user_id);
create index if not exists idx_benachrichtigung_user_id on benachrichtigung(user_id);

-- RLS-Policies neu erstellen mit (select auth.uid()), damit die Funktion nicht
-- pro Zeile neu ausgewertet wird (siehe Postgres-Linter 0003_auth_rls_initplan)
do $$
declare
  t text;
begin
  foreach t in array array['fach','deadline','todo','note','pruefung','stundenplan_eintrag','lern_session','externer_feed','benachrichtigung']
  loop
    execute format('drop policy "eigene Zeilen lesen" on %I', t);
    execute format('drop policy "eigene Zeilen anlegen" on %I', t);
    execute format('drop policy "eigene Zeilen aendern" on %I', t);
    execute format('drop policy "eigene Zeilen loeschen" on %I', t);

    execute format('create policy "eigene Zeilen lesen" on %I for select using ((select auth.uid()) = user_id)', t);
    execute format('create policy "eigene Zeilen anlegen" on %I for insert with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "eigene Zeilen aendern" on %I for update using ((select auth.uid()) = user_id)', t);
    execute format('create policy "eigene Zeilen loeschen" on %I for delete using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

drop policy "eigene Zeile lesen" on settings;
drop policy "eigene Zeile anlegen" on settings;
drop policy "eigene Zeile aendern" on settings;
drop policy "eigene Zeile loeschen" on settings;

create policy "eigene Zeile lesen" on settings for select using ((select auth.uid()) = user_id);
create policy "eigene Zeile anlegen" on settings for insert with check ((select auth.uid()) = user_id);
create policy "eigene Zeile aendern" on settings for update using ((select auth.uid()) = user_id);
create policy "eigene Zeile loeschen" on settings for delete using ((select auth.uid()) = user_id);
