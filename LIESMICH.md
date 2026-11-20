# Prüfwerkzeuge UniVerse (Branch wird nie gemergt)

Einrichten in einer neuen Sitzung (Repo liegt in /home/claude/uniwars):

    cd /home/claude/uniwars && git fetch -q origin werkzeuge/pruefung && mkdir -p /home/claude/wz && git archive FETCH_HEAD | tar -x -C /home/claude/wz && bash /home/claude/wz/einrichten.sh && bash /home/claude/pruefung/start.sh

Danach in /home/claude/pruefung:
- `python3 audit.py`: Rundgang 22 Seiten, beide Designs, 1440 und 390, axe, Querscrollen, Tippziele, abgeschnittene Texte. Ausgabe „keine Befunde“ oder Liste. `BILDER=0` ohne Fotos.
- Bereichsskripte mit Fotos in `bilder/` (`PREFIX=x python3 <skript>.py`): `klausur.py` (Klausurphase), `hub2.py` (Seitenleiste, Zeitband), `meld.py` (Meldungen), `rueck.py` (Rückfragen), `klein.py`, `woche.py`, `app.py` (installierbare App).
- Hallmark: `bash hm.sh <repo> <dateien>` je Datei FAIL/REFLEX/WARN; Vergleich mit main: `git worktree add /tmp/main origin/main`, dann `hm.sh /tmp/main ...`; Details `BASIS=/tmp/main python3 hmdiff.py <datei>`.
- `cssweg.py <datei> <regex>`: CSS-Regeln entfernen, deren Selektoren alle passen.

Ersatz-Server `mock.py` (Supabase-Auth und PostgREST) auf 127.0.0.1:54321. Schalter:
`/__modus?w=voll|leer|kaputt`, `/__theme?w=HELL|DUNKEL|SYSTEM`, `/__leiste?w=offen|hover|zu|auto|aus`, `/__klausur?w=an|aus|abgelehnt`, `/__langsam?ms=1500`, `/__einmal401?t=<tabelle>`.

Nach einem Sandbox-Neustart: `BAUEN=0 bash /home/claude/pruefung/start.sh`.
Neue oder geänderte Skripte hier einchecken (eigener Commit auf diesem Branch, normaler Push).
