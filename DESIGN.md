# DESIGN.md – UniVerse

Verbindliche Gestaltungsregeln für UniVerse (Repo: UniWars). Stand 16.11.2026, entschieden von Didi Romrod.
Diese Datei ist die Quelle für Menschen und für KI-Werkzeuge: Wer UI baut, hält sich an diese Datei und bringt keinen eigenen Geschmack ein.

**Referenz zum Anklicken:** `docs/design/b3-dummy/index.html` (im Browser öffnen, unten links „Testwerkzeuge“ für Ladezeit, Leer, Fehler, Offline und Abmelden).
**Umsetzungsplan:** `docs/design/umsetzung.md`.

## 1. Grundsätze
- Moderner, besser und einfacher als die Konkurrenz, bei mehr Funktionen.
- Eigenständig, nicht nach Vorlage oder „KI-Look“. Bewährte Muster anerkannter Apps (Linear, Raycast, Notion, iOS) statt Experimente.
- Normale Groß- und Kleinschreibung überall, auch in der Wortmarke „UniVerse“ („Uni“ in Akzentfarbe).
- Jede Prüfung mit Hallmark (`sloplint --scope app`): 0 FAIL, 0 WARN.

## 2. Designs (Themes)
Zwei Basis-Designs, beide ohne Fotos. Farben nur über semantische Token, nie feste Werte in Komponenten.

| Token | Sternenhimmel (dunkel) | Hochschule (hell) |
|---|---|---|
| `--grund` | #08090b | #ecece9 |
| `--flaeche` / `-2` / `-3` | #0e1013 / #15181c / #1d2126 | #ffffff / #f7f7f5 / #efefec |
| `--text` / `-2` / `-3` | #ededef / #a8acb3 / #8a8f98 | #111419 / #4f555e / #61676f |
| `--linie` / `-2` | rgba(255,255,255,.075) / .13 | rgba(12,18,28,.09) / .16 |
| `--akzent` / `--akzent-text` | #E8BE6A / #EBC575 | #1f4e8c / #1f4e8c |
| `--auf-akzent` | #17110a | #ffffff |
| `--auf-fehler` / `--auf-warnung` (Text auf Fehler- und Warnflächen) | #17110a / #17110a | #ffffff / #ffffff |
| `--ok` / `--color-error` | #5fd39a / #e5484d | #1d8a57 / #c62a2f |
| `--warnung` | #E8BE6A | #946318 |
| Fachfarben `--f1`…`--f4` | #7FBFB6 #CFAE7A #8EA3C9 #A99CC4 | #2f7d74 #946318 #3d5f9e #6b4f9a |

- Umschalten über `data-theme="nacht" | "hochschule"` (heute auf `.dashboard`, später auf `<html>`). Datenbank: `settings.theme` HELL = Hochschule, DUNKEL = Sternenhimmel, dazu SYSTEM (Migration `20261116222117_design_b3_einstellungen`).
- Sternenhimmel hat leisen, unbewegten Sternenstaub im Grund, Hochschule nicht.
- Der Akzent markiert nur Hauptaktion, Auswahl und Zustand.

## 3. Schrift, Raster, Formen
- **Bricolage Grotesque** für alles (Überschriften 650, Text 400–550). **JetBrains Mono nur für Zahlen und Zeiten.** Nicht Inter.
- Größen: 12 / 13 / 14 (Text) / 16 / 18 / 20 / 28 / 40 px. Abstände nur auf dem 4-px-Raster (`--space-half` 2 px bis `--space-32` 128 px).
- Ecken: 6 px Arbeitsfläche und Karten, 8 px Bedienelemente, Pillen für Knöpfe.
- **Knöpfe getönt, ohne Rand:** Hauptknopf voll im Akzent (einer pro Bildschirm), Nebenknopf 14 % Akzent-Tönung, kleine Knöpfe 7 % Text-Tönung. Alle acht Zustände (normal, hover, fokus, aktiv, deaktiviert, laden, fehler, erfolg).
- **Flächen:** Eine eingelassene Arbeitsfläche (Ring plus weicher Schatten) auf dem Grund; innen Trennlinien statt umrandeter Kästen. Kein Glas, kein farbiges Leuchten.

## 4. Gerüst (B3)
- **Symbolleiste** 64 px links mit 15 Bereichen in drei Gruppen:
  - Täglich: Hub, Work Station, Karteikarten, Notizen
  - Studium: PDF Reader, Lernraum, Dateiablage, Literatur, Transkription, Chat
  - Werkzeuge: Textverarbeitung, Tabellen, Präsentationen, MindMap, Whiteboard
  - Darunter: UniVerse Studio, Einstellungen, Avatar mit Profil-Menü. Die gleitende Markierung zeigt den aktiven Bereich.
- **Kontextspalte** 272 px je Bereich (Navigation innerhalb des Bereichs, zum Beispiel Hub-Unterseiten, Notizenliste, Fächer im Lernraum).
- **Kopfleiste** in der Arbeitsfläche: Pfad, Fokus-Timer, Sync-Status (Synchron, Wird abgeglichen, Offline), Benachrichtigungen, Uhrzeit. **Kein Design-Schalter** (Standard aus, in der Personalisierung einschaltbar).
- **UniVerse Studio** (⌘J): eine Leiste rechts, der Inhalt rückt zur Seite. Zeigt „Sieht gerade …“, nimmt markierten Text mit, Neuer Chat, Privater Chat, Groß/Klein. Am Handy als Vollbild.
- **Befehlspalette** Strg/⌘+O (einziges Kürzel), **Schnell erfassen** mit Q.
- **Geteilte Ansicht:** Bereich aus der Symbolleiste an den rechten oder unteren Rand ziehen, oder ohne Ziehen über die Palette „… daneben öffnen“. Kopf der zweiten Ansicht: Bereich wählen, drehen, als Hauptansicht öffnen, schließen. Trenner per Maus, Pfeiltasten, Doppelklick 50/50.
- **Handy (unter 60 rem):** Tab-Leiste unten (die ersten vier Bereiche der Symbolleiste plus „Alles“), Kontextspalte als aufklappbare Leiste oben, Studio und Avatar in der Kopfleiste.

## 5. Zentraler Hub
- Unterseiten in der Kontextspalte: Übersicht, Termine, Aufgaben, Noten, Fortschritt, Fächer. Termine, Aufgaben und Noten haben einen Fach-Filter.
- **Übersicht auf 3-Spalten-Raster**, Bausteine in S (⅓), M (⅔) oder L (voll); jeder Baustein erlaubt nur passende Größen. Bleibt in einer Zeile Platz, füllt der Baustein davor die Zeile.
- Standard („Ausgewogen“): Als Nächstes L · Überblick L · Heute M + Dein Tag S · Diese Woche L. „Wiederholen“ ist aus. Voreinstellungen: Ruhig, Ausgewogen, Alles.
- **Dein Tag:** KI-Begrüßung (Max' Tages-Briefing) plus drei Lernblöcke mit Grund, „Einplanen“, „Mit Studio planen“.
- **Anpassen = Bearbeiten direkt im Hub:** Griff (Maus, Touch, Tastatur), Pfeile nach vorn und hinten (WCAG 2.5.7), Breite S/M/L, Ausblenden in eine Ablage, Rückgängig (auch ⌘Z), „Fertig“.

## 6. Personalisierung (Einstellungen › Personalisierung, eigene Seite)
- Design: Sternenhimmel, Hochschule, Wie das System (mit echter Vorschau). Design-Schalter in der Kopfleiste optional.
- Zentraler Hub: Voreinstellung und „Hub anordnen“.
- Symbolleiste: Reihenfolge innerhalb der Gruppen (ziehen oder Pfeile), Bereiche ausblenden (Hub immer sichtbar, Ausgeblendete bleiben über die Suche erreichbar).
- Darstellung, nur persönlich: Schriftgröße (Normal, Groß), Dichte (Normal, Kompakt), Bewegung (Wie das System, Reduziert).
- Später mit dem Baukasten: eigene Farben, Hintergrund, Sticker, Teilen. Designs werden als Daten (JSON-Rezept) gespeichert, nie als CSS.
- Weitere Einstellungen: Profil, Konto, Datenschutz und KI, Studio und Gedächtnis (Persönlichkeit Lernbuddy, Coach, Sachlich; „Was Studio über dich weiß“ mit Vergessen).

## 7. Bewegung
- Token: 120 ms (Mikro), 200 ms (kurz), 320 ms, 640 ms nur für die Lichtspur. Ein: `cubic-bezier(.22,.9,.24,1)`, aus: `cubic-bezier(.4,0,.9,.5)`.
- Nur `transform` und `opacity`, nie `transition: all`, nie Breite oder Höhe animieren.
- **Wechsel zwischen Bereichen:** View Transitions, „mit Richtung“: altes Bild 100 ms aus, neues 200 ms ein, 60 ms später, 12 px aus der Klickrichtung. Symbolleiste und Kopfleiste stehen still.
- **Laden:** Skelett erst nach 300 ms, dann mindestens 400 ms, in der Form des Bereichs. Laden = Umlauf, Speichern = Lichtspur wird Haken.
- Reduzierte Bewegung (System oder Einstellung): nur Überblenden in 120 ms.

## 8. Zustände
- Jeder Bereich, der Daten lädt, hat vier Zustände: Laden, Leer, Fehler, Voll.
- Leer: was hierher gehört und genau eine Aktion, die es füllt.
- Fehler: was kaputt ist, was nicht betroffen ist, und eine Aktion („Erneut versuchen“ zeigt den Ladezustand im Knopf). Wo möglich nur die Region, der Rest bleibt benutzbar.
- Offline: Kopfleiste „Offline“, KI-Bereiche (Studio, Transkription, Chat) sagen, was später passiert.
- Automatisch abmelden nach 5 Minuten: 30 Sekunden vorher Hinweis mit „Angemeldet bleiben“.

## 9. Verboten, außer begründet (Hallmark)
Lila-Blau-Verläufe, Glas oder Leuchten ohne Zweck, Eyebrows, Labels in Großbuchstaben oder Mono, Punkte als Deko, einseitige Farbkante an Karten, Karte in Karte, Icon im Kästchen als Reflex, drei gleiche Karten unter einem Hero, Emojis als Icons, Erfolgs-Toasts bei sichtbaren Aktionen, Bedienung nur bei Hover, Fokusrahmen unter 2 px, Farben oder Schriften außerhalb der Token.
