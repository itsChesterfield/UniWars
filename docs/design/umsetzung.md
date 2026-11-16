# Umsetzung des Designs B3 im Repo

Stand 16.11.2026. Grundlage: `DESIGN.md` und der Dummy in `docs/design/b3-dummy/`.
Dieser Branch (`design/b3-referenz`) enthält nur Unterlagen, keinen App-Code. Er kann ohne Konflikte zusammengeführt werden.

## Vorher mit Max abstimmen
| Thema | Im Repo heute | Im Design | Vorschlag |
|---|---|---|---|
| Schrift | Inter (Commit „Schlichtere Schrift“) | Bricolage Grotesque, JetBrains Mono für Zahlen | Bricolage über `next/font` |
| Befehlspalette | Strg/⌘+O | ⌘K | ⌘K als Hauptkürzel, Strg+O bleibt zusätzlich |
| Dashboard-Überschrift | wechselnde persönliche Überschrift („Kaffee und Uni, Max?“) als h1 | h1 = nächste Aufgabe („Statistik-Übung abgeben.“); die Begrüßung steht als erster Satz in „Dein Tag“ | Begrüßung in „Dein Tag“ verschieben |
| Übersicht | „Dein Tag“ und Termine | Raster mit Als Nächstes, Überblick, Heute, Dein Tag, Diese Woche, anpassbar | `settings.hub_layout` statt `sichtbare_widgets` |
| Hub-Bereiche | Notch oben (Übersicht, Termine, Aufgaben, Noten, Fortschritt, Fächer) | dieselben Seiten in der Kontextspalte | Inhalte bleiben, nur der Ort ändert sich |
| Studio | Leiste rechts per Strg+J, Hinweis in der Seitenleiste | Leiste rechts als eigene eingelassene Fläche, Knopf in der Symbolleiste, „Sieht gerade …“ | Komponente behalten, Hülle neu |
| Geteilte Ansicht | iframe, Ziehen an den Rand | gleich, plus „Daneben öffnen“ in der Palette (Weg ohne Ziehen) | Palette-Befehl ergänzen |
| Design-Einstellung | Hell, Dunkel, Seitenleiste eingeklappt | Sternenhimmel, Hochschule, Wie das System; persönliche Darstellung | Migrationsentwurf unten |
| Benachrichtigungen | Glocke im Dashboard-Kopf | Glocke in der Kopfleiste aller Bereiche | Komponente wiederverwenden |

## Schritte als kleine Pull Requests
Jeder Schritt auf eigenem Branch, Vercel-Vorschau, `npm run lint`, `npm test`, Hallmark `sloplint --scope app` über die geänderten Dateien.

1. **Token und Schriften** – `src/app/globals.css`: Token-Ebene aus `DESIGN.md` Abschnitt 2 und 3 als `:root[data-theme=…]`; alte Variablen zunächst auf die neuen abbilden, damit nichts bricht. `next/font` für Bricolage und JetBrains Mono in `src/app/layout.tsx`.
2. **Gerüst** – `src/app/(hubs)/layout.tsx`, `src/components/sidebar.tsx`: Symbolleiste, Kontextspalte, eingelassene Arbeitsfläche, Kopfleiste mit Sync, Glocke, Fokus-Timer. Studio-Knopf und Profil-Menü. Handy-Tab-Leiste.
3. **Übergänge und Zustände** – View Transitions zwischen Bereichen (Next.js/React bieten dafür eigene Unterstützung; vorher in `node_modules/next/dist/docs/` prüfen, siehe AGENTS.md), Skelett nach 300 ms, Leer- und Fehlerzustände je Bereich, Offline-Status.
4. **Zentraler Hub** – Unterseiten in die Kontextspalte, Übersicht als Raster mit S/M/L, Bearbeiten-Modus (Bibliothek: `@dnd-kit/sortable` mit Tastatur-Sensor), „Dein Tag“ zusammenführen.
5. **Personalisierung** – Einstellungsseite, Migration (unten) anwenden, Symbolleiste-Reihenfolge, Darstellung.
6. **Bereiche einzeln** – Karteikarten (inkl. Quiz), Notizen, PDF Reader, Lernraum, Transkription (inkl. Podcast), dann die übrigen.

## Datenbank (Entwurf, noch nicht angewendet)
`docs/design/entwurf-migration-b3.sql` – liegt bewusst nicht in `supabase/migrations`.
- Stand 16.11., 23:15: Datenbank und Repo haben dieselben 39 Migrationen.
- `settings` hat RLS „eigene Zeile“ für alle Befehle; neue Spalten sind damit abgedeckt.
- Offen und unabhängig vom Design (Supabase-Advisor): `ist_username_verfuegbar` anonym aufrufbar, 22 SECURITY-DEFINER-Funktionen per RPC aufrufbar (darunter die KI-Kontingent-Buchung), Schutz gegen geleakte Passwörter aus.

## Was der Dummy nur vortäuscht
Ladezeiten, Fehler, Offline, Studio-Antworten, Quiz- und Podcast-Erstellung, Benachrichtigungen und Abmelden sind simuliert. In der App braucht jeder dieser Zustände die passende Datenlogik.
