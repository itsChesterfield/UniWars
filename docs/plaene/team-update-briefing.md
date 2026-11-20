# Team-Update-Briefing

Ein Paket für automatische Änderungszusammenfassungen, einen Dialog beim App-Start und den Verlauf unter **Einstellungen → Team-Updates**. Alle angemeldeten Konten sehen pro veröffentlichtem PR einen Eintrag in verständlichem Deutsch. Das Briefing beschreibt die Wirkung und kennzeichnet Vorbereitungen als solche.

## Pull Request

Der GitHub-Workflow `team-update-briefing.yml` liest PR-Titel, Beschreibung und die Liste der geänderten Dateien. Er führt ausschließlich Skripte aus dem Basis-Commit aus. Mistral erhält keine Roh-Diffs, Umgebungsvariablen oder Zugangsdaten. Die Ausgabe besteht aus einem Titel und ein bis drei Punkten. Fettdruck innerhalb eines Punkts ist erlaubt. Interne Verweise und vertrauliche Details bleiben im Pull Request.

Der Bot stellt den Entwurf im PR bereit und bindet ihn an den geprüften Head-Commit. Ein neuer Commit löst einen neuen Check aus. Korrekturen oder ein Ersatz bei einem KI-Ausfall können in der PR-Beschreibung stehen. Der Workflow validiert auch diese Eingabe.

```team-update
{"titel":"Die Team-Einstellungen sind leichter zu finden","punkte":["Der Verlauf steht direkt unter **Team-Updates**."]}
```

Das Team prüft die Aussagen im PR, insbesondere ob eine erwähnte Funktion bereits verfügbar ist. Die bisherige Freigabe für den Merge bleibt Teil des Ablaufs.

## Veröffentlichung und Verlauf

Der zweite Workflow reagiert auf GitHub-Meldungen zum Deployment und prüft zusätzlich zweimal pro Stunde. Maßgeblich ist der Commit des Deployments, auf das die konfigurierte Vercel-Produktionsdomain zeigt. Alle Merges ab dem festgelegten Start-Commit werden über die Hauptlinie ermittelt. Ein gemeinsames Deployment kann mehrere Einträge freigeben. Wiederholungen verwenden dieselbe PR-Nummer und denselben Merge-Commit. Zurückgerollte Einträge bleiben im Verlauf und verschwinden aus dem Dialog. Meldet der Abgleich fehlende PRs oder Texte, zeigt der Workflow den betroffenen Commit oder PR an. Fehlt ein Text nach einem ausnahmsweise umgangenen Pflichtcheck, kann **Team-Update erstellen → Run workflow** den Entwurf für einen bereits gemergten PR nachtragen. Anschließend den Produktionsabgleich erneut starten.

Der Dialog wird im angemeldeten App-Rahmen geöffnet, sobald vorhandene Dialoge geschlossen sind. Er fasst bis zu 20 ungelesene Einträge pro Anzeige zusammen. Weitere Einträge erscheinen nach dem Bestätigen. **Später** schließt den Dialog für den aktuellen App-Besuch. Die Datenbank speichert bestätigte Einträge kontobezogen, auch bei einem Gerätewechsel. Der Verlauf ist seitenweise abrufbar. Ein Ausfall des Briefings blockiert den App-Start nicht.

## Aktivierung

1. Den direkten Vorgänger von PR #98 auf `main` als `TEAM_UPDATE_START_SHA` hinterlegen. So erfasst der Abgleich auch das erste veröffentlichte Briefing.
2. Die Migration `20261120081409_team_updates.sql` gehört zur Live-Freigabe. Der KI-Agent spielt sie ein und prüft den Produktionsstand. Alle angemeldeten Konten erhalten automatisch Zugriff. Das Rollback-SQL entfernt beide Tabellen einschließlich Verlauf und Leseständen.
3. In GitHub die Variablen `TEAM_UPDATE_START_SHA`, `TEAM_UPDATE_PRODUKTIONSHOST` (Hostname ohne Protokoll), `TEAM_UPDATE_VERCEL_TEAM_ID`, `TEAM_UPDATE_VERCEL_PROJECT_ID` und `TEAM_UPDATE_SUPABASE_URL` hinterlegen. Das Modell lässt sich optional über `TEAM_UPDATE_MODELL` setzen. Die Secrets heißen `TEAM_UPDATE_MISTRAL_API_KEY`, `TEAM_UPDATE_VERCEL_TOKEN` und `TEAM_UPDATE_SUPABASE_KEY`. Für den Supabase-Abgleich einen eigenen serverseitigen Schlüssel verwenden.
4. `TEAM_UPDATES_AKTIV` auf `true` setzen und einen Test-PR durchlaufen lassen. Den Status **Team-Update / Briefing** als Pflichtprüfung für `main` eintragen. Pull Requests voraussetzen und Merge-Commits oder Squash-Merges erlauben. Rebase-Merges und direkte Pushes umgehen die eindeutige Zuordnung und sind für diesen Ablauf zu deaktivieren.
5. Den Test-PR veröffentlichen. Den Dialog und Verlauf mit zwei gewöhnlichen Konten prüfen. Ein bestätigter Eintrag soll auf einem weiteren Gerät desselben Kontos als gelesen gelten. Ohne Anmeldung prüfen, dass keine Briefing-Inhalte abgerufen werden können.

## Regressionen und Abnahme

- Einen PR nach der Generierung ändern. Nur der Kommentar zum finalen Head darf veröffentlicht werden. Einen ungültigen Entwurf, KI-Ausfall und eine deaktivierte Funktion durchspielen.
- Preview, gescheiterten Build, mehrere Merges in einer Veröffentlichung, doppelte Meldungen, verspätete Meldungen, Rollback und erneutes Deployment prüfen.
- Mit zwei Konten und zwei Tabs prüfen, dass Lesestatus und Schreibrechte getrennt bleiben. Nach dem Abmelden prüfen, dass kein Zugriff auf die Inhalte möglich ist. Beim Bestätigen eines offenen Dialogs gleichzeitig ein neues Update bereitstellen.
- Dialog bei 390 und 1440 Pixeln im hellen und dunklen Design prüfen. Lange Zeilen, vorhandenen Dialog, Tastatur, Fokus nach Schließen und fehlgeschlagenes Speichern abdecken.
- `node --test scripts/team-update*.test.mjs`, die SQL-Tests unter `supabase/tests` und die Prüfungen in `AGENTS.md` ausführen.
