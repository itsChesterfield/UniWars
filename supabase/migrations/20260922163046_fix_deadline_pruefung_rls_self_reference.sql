-- Bug: Beim Anlegen einer Deadline/Pruefung (z.B. eines Termins) schlaegt die
-- automatische Rueckgabe der neu erstellten Zeile ("insert ... returning",
-- vom Supabase-JS-Client via .insert().select() erzeugt) mit einer
-- RLS-Verletzung (403, Postgres 42501) fehl. Produktions-Logs zeigen das
-- direkt: POST /rest/v1/deadline und /rest/v1/pruefung liefern 403, obwohl
-- der Insert selbst (ohne "returning") anstandslos durchlaeuft.
--
-- Ursache: Die SELECT-Policies auf deadline/pruefung riefen
-- ist_mitglied(...) -> ist_ersteller(...) auf, was per Subquery dieselbe
-- Tabelle erneut abfragt ("exists(select 1 from deadline where id = ...)").
-- Fuer "returning" wird die SELECT-Policy auf die gerade erst eingefuegte
-- Zeile angewandt; die self-referenzierende Subquery sieht diese neue Zeile
-- innerhalb desselben Statements aber nicht zuverlaessig (Snapshot-Sichtbarkeit),
-- wodurch die Policy fuer die eigene, gerade angelegte Zeile fehlschlaegt.
--
-- todo hatte dasselbe Muster, war aber unauffaellig, weil dort zusaetzlich
-- ein direkter "user_id = auth.uid()"-Check vorgeschaltet ist, der schon
-- alleine durchschlaegt. Fix hier: Fuer deadline/pruefung ebenfalls direkt
-- auf der eigenen Spalte user_id pruefen (kein Self-Referencing-Subquery
-- mehr auf dieselbe Tabelle) und die Mitgliedschaft ueber einladung separat
-- pruefen (andere Tabelle, kein Visibility-Problem).

drop policy "eigene Zeilen lesen" on public.deadline;
create policy "eigene Zeilen lesen" on public.deadline
  for select using (
    (select auth.uid()) = user_id
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
    or exists (
      select 1 from public.einladung e
      where e.ziel_typ = 'deadline' and e.ziel_id = deadline.id
        and e.an_user_id = (select auth.uid()) and e.status = 'ANGENOMMEN'
    )
  );

drop policy "eigene Zeilen loeschen" on public.deadline;
create policy "eigene Zeilen loeschen" on public.deadline
  for delete using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.einladung e
      where e.ziel_typ = 'deadline' and e.ziel_id = deadline.id
        and e.an_user_id = (select auth.uid()) and e.status = 'ANGENOMMEN'
    )
  );

drop policy "eigene Zeilen lesen" on public.pruefung;
create policy "eigene Zeilen lesen" on public.pruefung
  for select using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.einladung e
      where e.ziel_typ = 'pruefung' and e.ziel_id = pruefung.id
        and e.an_user_id = (select auth.uid()) and e.status = 'ANGENOMMEN'
    )
  );

drop policy "eigene Zeilen aendern" on public.pruefung;
create policy "eigene Zeilen aendern" on public.pruefung
  for update using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.einladung e
      where e.ziel_typ = 'pruefung' and e.ziel_id = pruefung.id
        and e.an_user_id = (select auth.uid()) and e.status = 'ANGENOMMEN'
    )
  );

drop policy "eigene Zeilen loeschen" on public.pruefung;
create policy "eigene Zeilen loeschen" on public.pruefung
  for delete using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.einladung e
      where e.ziel_typ = 'pruefung' and e.ziel_id = pruefung.id
        and e.an_user_id = (select auth.uid()) and e.status = 'ANGENOMMEN'
    )
  );
