# Dummy B3

Klickbarer Entwurf der UniVerse-Oberfläche. Drei Dateien, ohne Build. `index.html` im Browser öffnen (für die geteilte Ansicht über einen lokalen Server, zum Beispiel `npx serve docs/design/b3-dummy`).

- Alle 15 Bereiche, UniVerse Studio (⌘J), Befehlspalette (Strg/⌘+O), Schnell erfassen (Q), geteilte Ansicht, Personalisierung unter Einstellungen.
- Unten links „Testwerkzeuge“: Ladezeit beim ersten Öffnen, Zustand des Bereichs (Voll, Leer, Fehler), Abmelde-Hinweis, Offline.
- Daten sind Beispiele. Die App-Logik steckt nicht hier, nur Aussehen und Verhalten.
- Prüfung: Hallmark `sloplint --scope app` 0 FAIL, 0 WARN; Klicktests mit Playwright bei 1440 px und 390 px, beide Designs, reduzierte Bewegung.
