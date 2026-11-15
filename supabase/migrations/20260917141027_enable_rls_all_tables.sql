do $$
declare
  t text;
begin
  foreach t in array array['fach','deadline','todo','note','pruefung','stundenplan_eintrag','lern_session','externer_feed','benachrichtigung']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "eigene Zeilen lesen" on %I for select using (auth.uid() = user_id)', t);
    execute format('create policy "eigene Zeilen anlegen" on %I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "eigene Zeilen aendern" on %I for update using (auth.uid() = user_id)', t);
    execute format('create policy "eigene Zeilen loeschen" on %I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- settings: user_id ist hier der Primärschlüssel selbst, gleiches Muster
alter table settings enable row level security;
create policy "eigene Zeile lesen" on settings for select using (auth.uid() = user_id);
create policy "eigene Zeile anlegen" on settings for insert with check (auth.uid() = user_id);
create policy "eigene Zeile aendern" on settings for update using (auth.uid() = user_id);
create policy "eigene Zeile loeschen" on settings for delete using (auth.uid() = user_id);
