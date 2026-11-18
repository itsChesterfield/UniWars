<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Regeln für KI-Agenten in diesem Projekt (UniWars)

Diese Regeln gelten für **jede** Aufgabe. Wenn eine Anweisung im Plan diesen Regeln widerspricht: **Stoppen und nachfragen.**

---

## 1. Arbeitsweise

1. **Ein Paket pro Session.** Pro Aufgabe wird genau ein Paket aus dem Plan umgesetzt, nicht mehr.
2. **Erst lesen, dann ändern.** Jede Datei, die du änderst, und jede Funktion, die du aufrufst, liest du vorher. Nichts annehmen, was du nicht gesehen hast.
3. **Bei Unklarheit stoppen und fragen.** Das gilt besonders, wenn:
   - eine Datei, ein Token, eine Tabelle oder eine Funktion aus dem Plan nicht existiert,
   - der Plan unverständlichen oder kaputten Text enthält,
   - du eine Datei ändern müsstest, die nicht im Paket steht,
   - du eine neue Bibliothek bräuchtest.
   Formuliere eine konkrete Frage und mach erst weiter, wenn du eine Antwort hast. **Nichts raten.**
4. **Kleine Schritte.** Nach jedem Unterschritt (zum Beispiel 1.1, 1.2, …) läuft `npx tsc --noEmit`, und danach gibt es einen eigenen Commit.
5. **Nur ändern, was im Paket steht.** Kein Umbauen nebenbei, kein Umbenennen, kein Umformatieren fremder Dateien, kein Aufräumen. Fällt dir etwas auf, notierst du es im PR unter „Beobachtungen".
6. **Keine neuen Abhängigkeiten** ohne Rückfrage, auch keine „kleinen".

---

## 2. Verboten

- Tests löschen, überspringen (`.skip`) oder abschwächen, damit sie grün werden.
- `// @ts-ignore`, `// @ts-expect-error`, `as any`, `eslint-disable`.
- Lint- oder TypeScript-Regeln in den Konfigurationsdateien lockern.
- **Bereits angewendete Migrationen ändern.** Jede Änderung kommt als neue Migration.
- Geheimnisse (Service-Key, Tokens) im Code, in Logs oder in `NEXT_PUBLIC_*`-Variablen.
- `dangerouslySetInnerHTML` mit Inhalten aus der Datenbank oder von Nutzern.
- Farben, Abstände oder Schriftgrößen als feste Werte. **Nur Tokens aus `globals.css`.**
- Sicherheitsprüfungen „vorerst" weglassen oder mit `TODO` aufschieben.

---

## 3. Sicherheit (Next.js + Supabase)

1. **Nutzer serverseitig immer mit `supabase.auth.getUser()` ermitteln** (oder `getClaims()`, falls das im Projekt schon so verwendet wird). **Nie `getSession()` für Berechtigungen.**
2. **Jede Server Action und jeder Route Handler prüft die Berechtigung in der ersten Zeile** (`requireAdminAction()` oder Ähnliches). Ein Layout schützt keine Server Actions.
3. **Jede Admin-Page ruft `requireAdmin()` selbst auf.** Der Check im Layout allein reicht nicht.
4. **`adminClient()` (Service-Key) wird nur nach einer erfolgreichen Rollenprüfung verwendet** und nur in Dateien mit `import "server-only";`.
5. **Eingaben von Nutzern werden immer validiert**, auch in Admin-Actions.
6. **Fehlermeldungen verraten nichts**, also nicht, ob eine E-Mail existiert, und keine Stack-Traces an den Nutzer.
7. **Rollen, Feature-Flags und Sperren werden nicht zwischengespeichert.** Erlaubt ist nur React `cache()` pro Request.

---

## 4. Datenbank-Regeln (Supabase)

1. **Jede neue Tabelle:** `enable row level security` in derselben Migration.
2. **Jede `security definer`-Funktion** bekommt `set search_path = ''`, und alle Tabellennamen werden mit Schema geschrieben (`public.…`).
3. **Textspalten aus Nutzereingaben** bekommen eine Längengrenze per `check (char_length(...) <= N)`.
4. **Insert-Policies** prüfen immer mit `with check (user_id = auth.uid())`, wenn die Tabelle eine `user_id`-Spalte hat.
5. **Jede Migration bekommt ein Rollback-SQL** unter `supabase/rollbacks/<gleicher Name>.sql`.
6. **Vor dem Einspielen:** prüfen, ob die Live-Datenbank die Änderung verträgt (bestehende Daten, Namenskonflikte).
7. **Nach dem Einspielen:** den Supabase-Advisor laufen lassen. Neue Warnungen werden behoben oder im PR begründet.
8. **Jede neue RLS-Regel bekommt einen Test**, der zeigt, dass ein normaler Nutzer das Verbotene **nicht** kann.
9. **Migrationen nur in die Test-Datenbank einspielen, nie in die Produktion.** Die Produktions-Datenbank ändert nur der Projektinhaber, nach dem Merge. Wenn unklar ist, mit welchem Supabase-Projekt du verbunden bist: stoppen und fragen.

---

## 5. Definition of Done

Ein Paket ist erst fertig, wenn:

- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` und `npx next build --webpack` ohne Fehler laufen
- [ ] Hallmark-Sloplint 0 FAIL / 0 WARN meldet
- [ ] alle Akzeptanzkriterien des Pakets geprüft sind
- [ ] die Playwright-Screenshots (hell und dunkel) vorliegen
- [ ] die PR-Beschreibung nach der Vorlage unten geschrieben ist

---

## 6. Vorlage für die PR-Beschreibung

```markdown
## Paket
<Nummer und Name aus dem Plan>

## Geänderte Dateien
- `pfad/datei.ts`: was und warum (ein Satz)

## Akzeptanzkriterien
- [x] Kriterium 1 – wie geprüft
- [ ] Kriterium 2 – nicht erfüllt, weil …

## Sicherheit
- Welche Berechtigungsprüfungen gibt es wo?
- RLS-Test: Befehl und Ergebnis

## Abweichungen vom Plan
- (keine) oder: was, warum

## Offene Fragen
- …

## Beobachtungen (nicht geändert)
- …
```

**„Abweichungen vom Plan" und „Offene Fragen" dürfen nie fehlen.** Wenn es keine gibt, steht dort „keine".
