# Arbeitsregeln für Claude in diesem Projekt

Sprache mit Max: Deutsch, kurz und verständlich.

## Ablauf bei jeder Änderung – auch bei „nur Text“ oder „nur ein Icon“

1. **Branch von `main`**, nie direkt auf `main` arbeiten.
2. **Vor dem PR mit aktuellem `main` zusammenführen** und den zusammengeführten Stand prüfen. Nach jedem Merge-Konflikt alles erneut prüfen (Styles inklusive).
3. **Automatische Prüfungen:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` **und** `npx next build --webpack` (Fehler wie eine fehlende `}` in `globals.css` fallen nur im Webpack-Build auf).
4. **Hallmark** (Anti-AI-Slop, siehe `DESIGN.md`): `sloplint --scope app --genre modern-minimal` über die geänderten Dateien **plus** `src/app/globals.css`. Ziel: 0 FAIL, 0 WARN im eigenen neuen Code; Altbestand nicht ungefragt anfassen.
   Hallmark liegt nicht im Repo: `git clone --depth 1 https://github.com/Nutlope/hallmark.git` in den Scratchpad, dann `node <pfad>/skills/hallmark/scripts/sloplint.mjs <dateien> --scope app --genre modern-minimal`. (Das PyPI-Paket `sloplint` ist ein anderes Werkzeug.)
5. **Screenshots** der betroffenen Seiten mit Playwright: 1440 px und 390 px, jeweils helles und dunkles Design, vorher/nachher. Jeden Screenshot selbst ansehen, bevor etwas als fertig gilt.
6. **PR mit Vercel-Preview.** Live (Merge in `main`) **nur nach ausdrücklichem „live“ von Max.**

## Weitere Regeln

- Fragt Max nur etwas („wie aufwändig“, „was bringt …“), antworten statt bauen.
- Keine Gedankenstriche in Texten, keine Emojis als Icons, Farben/Abstände/Schriften nur über Token (`DESIGN.md`).
- Datenbank-Migrationen über Supabase einspielen; Dateiname = Version in Supabase. Vorher prüfen, ob die **Live-Version** mit der Änderung klarkommt.
- Keine Force-Pushes. Keine Modellnamen in Commits oder PRs.

Für das automatische Team-Briefing vor dem Merge gilt außerdem [Abschnitt 7 in AGENTS.md](AGENTS.md#7-team-update-vor-dem-merge).
