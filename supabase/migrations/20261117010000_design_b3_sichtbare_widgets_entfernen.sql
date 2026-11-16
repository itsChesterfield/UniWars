-- Design B3, Schritt 5: Die Übersicht des Zentralen Hubs steht seit Schritt 4 in settings.hub_layout.
-- sichtbare_widgets wird nirgends mehr gelesen oder geschrieben (widget-toggle.tsx ist entfernt).
-- Geprüft am 17.11.2026: keine Funktion und keine Sicht hängt an der Spalte.
-- Noch NICHT angewendet – Didi spielt sie nach dem Zusammenführen ein (löscht nur Testdaten).
alter table public.settings drop column if exists sichtbare_widgets;
