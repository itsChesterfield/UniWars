# Umsetzungsplan: Admin-System + Passkey-Anmeldung für UniWars

**Stack:** Next.js 16 (App Router, Server Components, Server Actions) · Supabase (Postgres, Auth, RLS) · Vercel
**Regeln für die Umsetzung:** siehe `AGENTS.md`. Diese Regeln gelten für jedes Paket.

---

## 0. Grundprinzipien (gelten überall)

1. **Der Server entscheidet, der Browser zeigt nur an.** Rolle, Feature-Freigabe, Sperre und Anmeldung werden immer serverseitig geprüft. Etwas per CSS zu verstecken ist kein Schutz.
2. **Doppelte Absicherung:** Jede Berechtigung wird zweimal durchgesetzt: (a) im Server-Code (Page, Server Action, Route Handler) und (b) in der Datenbank per RLS.
3. **Der Service-Key (`adminClient()` aus `src/lib/supabase/admin.ts`) wird nur benutzt, nachdem `requireAdmin()` erfolgreich war.** Er umgeht RLS, deshalb ist er das gefährlichste Werkzeug im Projekt.
4. **Serverseitig wird der Nutzer immer mit `supabase.auth.getUser()` ermittelt** (oder mit `getClaims()`, falls das im Projekt schon so verwendet wird), **nie mit `getSession()`.** `getSession()` liest nur das Cookie und kann gefälscht sein.
5. **Rollen und Feature-Flags werden nie zwischengespeichert** (kein `"use cache"`, kein `unstable_cache`). Erlaubt ist nur React `cache()` für die Dauer eines einzelnen Requests.

---

## 1. Festgelegte Entscheidungen (Annahmen)

Diese Punkte waren im ersten Plan offen. Sie sind hier entschieden und können vom Projektinhaber geändert werden:

| Thema | Entscheidung |
|---|---|
| Rollen | `user` < `moderator` < `admin` |
| Was darf ein Moderator? | **Vorerst nichts Zusätzliches**, außer Feature-Flags, die für „Admins + Mods" freigeschaltet sind. Kein Zugriff auf `/admin`. Moderationsrechte kommen in einem späteren, eigenen Plan. |
| Moderator-Badge | Ja, **gelb** mit dem Warn-Token aus `globals.css`. Gibt es kein passendes Token: **nachfragen, nicht selbst eins erfinden.** |
| Whitelist pflegen | **Nur direkt in der Datenbank** (SQL-Editor). Keine Admin-Seite dafür in diesem Plan. |
| Erster Admin | Wird einmalig per SQL gesetzt (siehe Paket 1, Schritt 1.6). |
| Öffentliche Registrierung | Wird in Supabase **abgeschaltet**. Konten legt nur noch der Server an, nach der Whitelist-Prüfung (Paket 6). |

---

## 2. Paket-Reihenfolge

Jedes Paket bekommt einen eigenen Branch und einen eigenen PR. Das nächste Paket beginnt erst, wenn der vorherige gemergt ist.

| # | Paket | Branch | Hängt ab von |
|---|---|---|---|
| 1 | Rollen (M1) + Guard + Badge | `feat/rollen` | – |
| 2 | Admin-Bereich: Nutzerliste, Statistik, Rollen ändern, Sperren, Audit-Log (M2) | `feat/admin-basis` | 1 |
| 3 | Feature-Flags (M3) | `feat/feature-flags` | 1, 2 |
| 4 | Ankündigungen (M4) | `feat/ankuendigungen` | 2 |
| 5 | Fehlerberichte (M5) | `feat/fehlerberichte` | 2 |
| 6a | Passkeys **zusätzlich** zum Passwort + Whitelist + Wiederherstellung (M6) | `feat/passkey-optional` | 1 |
| 6b | Passwort-Login abschalten | `feat/passkey-only` | 6a ist live und alle bestehenden Nutzer haben einen Passkey |

**Für jedes Paket gilt:** Am Ende kommt die Checkliste aus Abschnitt 9, und das Paket ist erst fertig, wenn alle Punkte erfüllt sind.

---

## 3. Paket 1: Rollen + Guard + Badge

**Ziel:** Jeder Nutzer hat eine Rolle. Admins und Moderatoren sind überall am Namen erkennbar. `/admin` ist nur für Admins erreichbar, bisher mit einer leeren Seite.

### 1.1 Migration `supabase/migrations/<zeitstempel>_rollen.sql`

```sql
create type public.app_role as enum ('user', 'moderator', 'admin');

create table public.user_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        public.app_role not null default 'user',
  erstellt_am timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- Lesen: alle angemeldeten Nutzer (für die Badges)
create policy "user_roles lesen"
  on public.user_roles for select
  to authenticated
  using (true);

-- KEINE insert/update/delete-Policy. Schreiben nur mit dem Service-Key.

-- Rolle des aktuellen Nutzers. Fehlt die Zeile, ist die Rolle 'user'.
create or replace function public.aktuelle_rolle()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'user'::public.app_role
  );
$$;

-- Hat der aktuelle Nutzer mindestens diese Rolle?
create or replace function public.hat_rolle(min_rolle public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.aktuelle_rolle() >= min_rolle;
$$;
```

Wichtig:
- `hat_rolle` vergleicht mit `>=`. Das funktioniert, weil die Enum-Werte in der Reihenfolge `user < moderator < admin` angelegt sind. **Die Reihenfolge der Enum-Werte darf deshalb nie geändert werden.**
- **Kein Trigger nötig:** Fehlt die Zeile für einen Nutzer, gibt `aktuelle_rolle()` `'user'` zurück. Zeilen werden nur für Moderatoren und Admins angelegt.

### 1.2 Rollback `supabase/rollbacks/<zeitstempel>_rollen.sql`

```sql
drop function if exists public.hat_rolle(public.app_role);
drop function if exists public.aktuelle_rolle();
drop table if exists public.user_roles;
drop type if exists public.app_role;
```

### 1.3 Server-Logik `src/lib/rollen.ts`

- Die erste Zeile ist `import "server-only";`.
- `aktuelleRolle(): Promise<Rolle>`
  - holt den Nutzer mit `getUser()`, ohne Nutzer gibt sie `null` zurück,
  - ruft danach `rpc('aktuelle_rolle')` auf,
  - ist mit React `cache()` umschlossen (gilt nur innerhalb eines Requests).
- `rollenVon(userIds: string[]): Promise<Map<string, Rolle>>`
  - **holt die Rollen vieler Nutzer mit einer einzigen Abfrage** (`.in('user_id', ids)`). Fehlende IDs bekommen `'user'`.
  - So vermeidest du N Abfragen, wenn eine Liste mit N Namen angezeigt wird.
- `requireAdmin(): Promise<{ userId: string }>`
  - Kein Nutzer → `redirect('/login')`
  - Rolle ist nicht `admin` → `redirect('/hub')` (den passenden Hub-Pfad aus dem Projekt nehmen)
- `requireAdminAction(): Promise<{ userId: string }>`
  - Gleiche Prüfung, **wirft aber einen Fehler statt umzuleiten.** Diese Variante ist für Server Actions und Route Handler gedacht.

### 1.4 Guard für `/admin`

- `src/app/(hubs)/admin/layout.tsx`: ruft `await requireAdmin()` auf.
- **Zusätzlich ruft jede `page.tsx` unter `/admin` als erste Zeile `await requireAdmin()` auf.**
  Grund: Layouts werden bei Navigation innerhalb der App nicht neu ausgeführt. Der Check im Layout allein reicht also nicht.
- **Jede Server Action und jeder Route Handler für Admins ruft als erste Zeile `await requireAdminAction()` auf.** Server Actions sind öffentliche POST-Endpunkte. Ein Layout schützt sie nicht.
- Inhalt der Seite in diesem Paket: nur eine Überschrift „Admin" und die leeren Tabs (siehe Paket 2).
- Der Notch-Eintrag „Admin" wird serverseitig nur gerendert, wenn die Rolle `admin` ist.

### 1.5 Badge `src/components/RollenBadge.tsx`

- Props: `rolle: Rolle`
- `admin` → rote Pille mit dem Text „Admin", Farbe aus `--fehler-text`
- `moderator` → gelbe Pille mit dem Text „Mod", Farbe aus dem Warn-Token (siehe Abschnitt 1)
- `user` → rendert nichts
- Es ist echter Text, also kein `aria-hidden`. Der Kontrast muss Hallmark bestehen.
- **Nur Tokens verwenden, keine Farbwerte direkt hineinschreiben.**

**Einbau:** Zuerst alle Stellen suchen, an denen `anzeigeName(` vorkommt:

```bash
grep -rn "anzeigeName(" src/
```

Die gefundenen Stellen **auflisten und im PR nennen**. An jeder Stelle die Rolle über `rollenVon()` holen (eine Abfrage pro Liste) und `<RollenBadge>` daneben setzen.
Erwartet werden: Hub-Seitenleiste, Einstellungen/Profil, Fokusraum-Mitglieder, Chat, geteilte Ansichten. Werden weitere Stellen gefunden: auflisten und nachfragen, bevor du sie änderst.

### 1.6 Ersten Admin setzen (macht der Projektinhaber, nicht der KI-Agent)

```sql
insert into public.user_roles (user_id, role)
values ('<eigene-user-id>', 'admin')
on conflict (user_id) do update set role = 'admin';
```

### 1.7 Tests

- `src/lib/rollen.test.ts`: `rollenVon()` gibt für fehlende IDs `'user'` zurück; `requireAdminAction()` wirft bei `user` und `moderator`.
- **RLS-Test (das Wichtigste in diesem Paket):** Ein angemeldeter normaler Nutzer versucht, `update user_roles set role = 'admin'` auszuführen → das muss fehlschlagen, oder es dürfen 0 Zeilen geändert werden.
  - Mit lokalem Supabase (`supabase start`): als Integrationstest.
  - Ohne lokales Supabase: manuell im SQL-Editor testen und das Ergebnis im PR dokumentieren:
    ```sql
    set role authenticated;
    set request.jwt.claims = '{"sub":"<user-id-eines-normalen-nutzers>"}';
    update public.user_roles set role = 'admin';  -- erwartet: 0 Zeilen
    reset role;
    ```

### 1.8 Akzeptanzkriterien

- [ ] Ein normaler Nutzer, der `/admin` aufruft, wird zum Hub umgeleitet, auch über die direkte URL.
- [ ] Ein Admin sieht `/admin` und den Notch-Eintrag. Ein normaler Nutzer sieht den Notch-Eintrag nicht, auch nicht im HTML-Quelltext.
- [ ] Das rote Badge steht überall neben dem Namen eines Admins, das gelbe neben dem eines Moderators.
- [ ] Der RLS-Test ist bestanden.
- [ ] Der Supabase-Advisor zeigt für die neuen Objekte keine Warnungen.

### 1.9 Nicht ändern

- Login und Registrierung
- `src/lib/supabase/admin.ts`
- Bestehende Migrationen

---

## 4. Paket 2: Admin-Bereich (Basis) + Audit-Log

**Ziel:** Ein Admin sieht Statistiken und alle Nutzer, kann Rollen ändern und Nutzer sperren oder löschen. Jede dieser Aktionen wird protokolliert.

### 2.1 Migration `<zeitstempel>_admin_log.sql`

```sql
create table public.admin_log (
  id          bigint generated always as identity primary key,
  admin_id    uuid references auth.users(id) on delete set null,
  aktion      text not null check (char_length(aktion) <= 50),
  ziel_user   uuid,
  details     jsonb,
  erstellt_am timestamptz not null default now()
);

alter table public.admin_log enable row level security;

create policy "admin_log lesen nur admins"
  on public.admin_log for select
  to authenticated
  using (public.hat_rolle('admin'));

-- Schreiben nur mit dem Service-Key.
```

Dazu gehört ein Rollback-SQL wie in Paket 1.

### 2.2 Tabs unter `/admin`

In diesem Paket werden diese Tabs umgesetzt: **Statistik · Nutzerliste · Rollen · Sperren**.
Die übrigen Tabs (Feature-Flags, Ankündigungen, Fehler) werden als deaktivierte Tabs angezeigt und in den späteren Paketen umgesetzt. Der Tab „Räume" ist nicht Teil dieses Plans; dafür kommt ein eigener Plan.

### 2.3 Statistik (genaue Definitionen)

| Kennzahl | Definition |
|---|---|
| Nutzer gesamt | Anzahl der Nutzer in `auth.users` |
| Neu diese Woche | `created_at` liegt innerhalb der letzten 7 Tage |
| Heute angemeldet | `last_sign_in_at` liegt seit 00:00 Uhr Europe/Berlin |

**Hinweis:** „Heute angemeldet" ist nicht dasselbe wie „heute aktiv". Wer schon angemeldet war, zählt nicht mit. Die Kennzahl in der Oberfläche deshalb genau so beschriften.

Die Werte werden mit `adminClient().auth.admin.listUsers()` ermittelt, mit Paginierung (Seiten zu 1000). Für mehr als einige Tausend Nutzer ist das zu langsam; das reicht für jetzt.

### 2.4 Nutzerliste

- Spalten: Anzeigename, E-Mail, registriert am, letzte Anmeldung, Rolle, Status (aktiv/gesperrt)
- Paginierung mit 50 Nutzern pro Seite

### 2.5 Server Actions `src/app/(hubs)/admin/actions.ts`

Jede Action folgt demselben Ablauf:

1. `const { userId } = await requireAdminAction();`
2. Eingaben validieren. Wenn `zod` im Projekt vorhanden ist, damit; sonst nachfragen und keine neue Bibliothek installieren.
3. Die Schutzregeln prüfen (siehe unten).
4. Die Änderung mit `adminClient()` ausführen.
5. Einen Eintrag in `admin_log` schreiben.
6. `revalidatePath('/admin')` aufrufen.

**`rolleAendern(zielUserId, neueRolle)`**
- Ein Admin darf **seine eigene Rolle nicht ändern** → Fehler: „Du kannst deine eigene Rolle nicht ändern."
- **Der letzte Admin darf nicht herabgestuft werden.** Vorher die Admins zählen; ist das Ergebnis 1 und das Ziel ist ein Admin → Fehler.
- Schreiben per Upsert in `user_roles`.

**`nutzerSperren(zielUserId)` / `nutzerEntsperren(zielUserId)`**
- Sperren: `auth.admin.updateUserById(id, { ban_duration: '876000h' })`
- Entsperren: `ban_duration: 'none'`
- Ein Admin darf sich nicht selbst sperren, und Admins dürfen nicht gesperrt werden (zuerst herabstufen).
- **Bekannte Einschränkung:** Ein gesperrter Nutzer bleibt angemeldet, bis sein Access-Token abläuft (Standard: 1 Stunde). In der Oberfläche dazuschreiben: „Wirkt spätestens nach 1 Stunde."

**`nutzerLoeschen(zielUserId)`**
- Es gibt eine Bestätigung in der Oberfläche: Der Admin muss die E-Mail des Nutzers eintippen.
- `auth.admin.deleteUser(id)`
- **Vorher prüfen:** Hängen alle Tabellen mit Nutzerbezug per `on delete cascade` an `auth.users`? Die Prüfung im SQL-Editor ausführen und das Ergebnis im PR auflisten. Fehlt die Kaskade bei einer Tabelle: **stoppen und nachfragen.**

### 2.6 Akzeptanzkriterien

- [ ] Alle vier Tabs funktionieren.
- [ ] Man kann sich nicht selbst herabstufen, nicht den letzten Admin entfernen und keinen Admin sperren.
- [ ] Jede Aktion erzeugt einen Eintrag in `admin_log`.
- [ ] Ein direkter POST auf die Server Action durch einen normalen Nutzer schlägt fehl (Unit-Test: `requireAdminAction` wird gemockt und wirft).

---

## 5. Paket 3: Feature-Flags

**Ziel:** Ein Admin legt fest, welche Rollen ein Modul (zum Beispiel `mindmap`) sehen. Die Änderung wirkt beim nächsten Seitenaufruf.

### 3.1 Migration `<zeitstempel>_feature_flags.sql`

```sql
create table public.feature_flags (
  name                 text primary key check (name ~ '^[a-z0-9_-]{1,40}$'),
  beschreibung         text check (char_length(beschreibung) <= 200),
  freigeschaltet_fuer  public.app_role[] not null default array['admin']::public.app_role[]
);

alter table public.feature_flags enable row level security;

create policy "feature_flags lesen"
  on public.feature_flags for select
  to authenticated
  using (true);

-- Gibt true zurück, wenn der aktuelle Nutzer das Modul sehen darf.
-- Ein unbekanntes Modul gibt false zurück (sicher bei Tippfehlern).
create or replace function public.feature_sichtbar(flag text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select public.aktuelle_rolle() = any(freigeschaltet_fuer)
       from public.feature_flags where name = flag),
    false
  );
$$;
```

Dazu gehört ein Rollback-SQL.

### 3.2 Durchsetzung an drei Stellen

1. **Navigation:** `sichtbareFeatures()` in `src/lib/features.ts` (mit `server-only` und React `cache()`) filtert die Einträge serverseitig.
2. **Route:** Jede Seite eines Moduls ruft als erste Zeile `await requireFeature('mindmap')` auf. Ist das Modul nicht freigeschaltet → `notFound()`.
3. **Daten:** Die RLS-Policies der Tabellen eines Moduls bekommen zusätzlich `and public.feature_sichtbar('mindmap')`.
   → Für jedes Modul die betroffenen Tabellen auflisten und **vor der Änderung nachfragen**.

### 3.3 Schalter in der Oberfläche

Der Schalter hat drei Stufen: „Nur Admins" = `{admin}` · „Admins + Mods" = `{admin, moderator}` · „Alle" = `{admin, moderator, user}`.
Die Server Action folgt dem Ablauf aus Abschnitt 2.5 (inklusive Log-Eintrag und `revalidatePath('/', 'layout')`).

### 3.4 Akzeptanzkriterien

- [ ] Ist ein Modul auf „Nur Admins" gestellt, bekommt ein normaler Nutzer beim direkten Aufruf der URL einen 404-Fehler.
- [ ] Die Daten des Moduls sind für einen normalen Nutzer auch über die Supabase-API nicht lesbar (RLS-Test).
- [ ] Nach einer Änderung am Schalter wirkt die Änderung beim nächsten Seitenaufruf, ohne neues Deployment.

---

## 6. Paket 4: Ankündigungen

### 4.1 Migration

```sql
create table public.announcements (
  id           bigint generated always as identity primary key,
  titel        text not null check (char_length(titel) between 1 and 100),
  text         text not null check (char_length(text) between 1 and 1000),
  aktiv        boolean not null default true,
  erstellt_am  timestamptz not null default now(),
  erstellt_von uuid references auth.users(id) on delete set null
);

alter table public.announcements enable row level security;

create policy "announcements lesen"
  on public.announcements for select
  to authenticated
  using (aktiv = true or public.hat_rolle('admin'));
```

Dazu gehört ein Rollback-SQL.

### 4.2 Anzeige

- Der Hub zeigt die **neueste aktive** Ankündigung als Banner (serverseitig geladen).
- Der Text wird **nur als normaler Text** gerendert, **kein `dangerouslySetInnerHTML`**. Damit kann niemand HTML oder Skripte einschleusen.
- Ein Nutzer kann das Banner schließen. Das wird in `localStorage` gespeichert (mit `try/catch`), zusammen mit der ID der Ankündigung.

### 4.3 Admin-Tab

Formular (Titel, Text) und eine Liste aller Ankündigungen mit „Deaktivieren"-Button. Die Actions folgen dem Ablauf aus Abschnitt 2.5.

---

## 7. Paket 5: Fehlerberichte

### 5.1 Migration

```sql
create table public.client_fehler (
  id          bigint generated always as identity primary key,
  seite       text not null check (char_length(seite) <= 300),
  meldung     text not null check (char_length(meldung) <= 500),
  details     text check (char_length(details) <= 5000),
  user_id     uuid references auth.users(id) on delete cascade,
  erstellt_am timestamptz not null default now()
);

alter table public.client_fehler enable row level security;

-- Einfügen nur unter der eigenen ID
create policy "client_fehler einfuegen"
  on public.client_fehler for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "client_fehler lesen nur admins"
  on public.client_fehler for select
  to authenticated
  using (public.hat_rolle('admin'));
```

Dazu gehört ein Rollback-SQL.

### 5.2 Logger

- `error.tsx` und `global-error.tsx` schreiben einmal pro Fehler (in `useEffect`) einen Eintrag.
- Die Texte werden **vor dem Senden gekürzt**, damit sie zu den Längengrenzen passen.
- **Keine Formulardaten, keine Tokens und keine E-Mails in `details`** mitschicken. Nur `error.message`, `error.digest` und den Stack.
- Schlägt das Schreiben fehl, wird das ignoriert. Die Fehlerseite selbst darf dadurch nicht abstürzen.
- Ist der Nutzer nicht angemeldet, wird nichts geschrieben.

### 5.3 Tab „Fehler"

Die neuesten 100 Einträge, jeweils mit einer Klartextzeile und aufklappbaren Details.

---

## 8. Paket 6: Passkey-Anmeldung

### Wichtige Fakten zu Supabase-Passkeys (vor der Umsetzung lesen)

- Die Funktion ist **Beta/experimentell** und muss im Client mit `auth: { experimental: { passkey: true } }` eingeschaltet werden. Die API kann sich ändern. Vor der Umsetzung die aktuelle Doku lesen: https://supabase.com/docs/guides/auth/passkeys
- **Anmelden braucht keine E-Mail:** `signInWithPasskey()` – der Authenticator wählt den Account.
- **Ein Passkey kann nur für einen bereits angemeldeten Nutzer registriert werden** (`registerPasskey()`).
- **Die RP-ID** (die Domain) wird einmal festgelegt und danach nicht mehr geändert. Passkeys funktionieren deshalb **nicht auf `*.vercel.app`-Previews**. Getestet wird lokal (localhost) oder auf einem eigenen Test-Projekt.

### 6.0 Vorbereitung (macht der Projektinhaber)

- In den Supabase-Einstellungen **„Allow new users to sign up" ausschalten.** Sonst kann jeder mit dem öffentlichen Key die Whitelist umgehen und sich direkt über die API registrieren.
- Passkeys aktivieren und die RP-ID auf die Produktionsdomain setzen.

### 6.1 Migration `<zeitstempel>_passkey_vorbereitung.sql`

```sql
create table public.erlaubte_emails (
  email      text primary key check (email = lower(email)),
  erstellt_am timestamptz not null default now()
);
alter table public.erlaubte_emails enable row level security;
-- Keine Policies: Nur der Service-Key kommt an die Tabelle.

create table public.wiederherstellungs_codes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  code_hash  text not null,
  benutzt_am timestamptz,
  erstellt_am timestamptz not null default now()
);
alter table public.wiederherstellungs_codes enable row level security;
-- Keine Policies.

create table public.wiederherstellungs_versuche (
  id          bigint generated always as identity primary key,
  email       text not null,
  ip          text,
  erstellt_am timestamptz not null default now()
);
alter table public.wiederherstellungs_versuche enable row level security;
-- Keine Policies.
```

Dazu gehört ein Rollback-SQL.

### 6.2 Registrierung (neuer Nutzer)

1. Die Seite `/registrieren` hat ein E-Mail-Feld und den Button „Weiter".
2. Die Server Action:
   - normalisiert die E-Mail (`trim().toLowerCase()`),
   - prüft mit `adminClient()`, ob die E-Mail in `erlaubte_emails` steht,
   - steht sie drin → `adminClient().auth.admin.inviteUserByEmail(email)` (legt den Nutzer an und schickt einen Link),
   - **Die Antwort ist immer gleich:** „Wenn diese E-Mail freigeschaltet ist, bekommst du eine Nachricht." So kann niemand herausfinden, welche E-Mails auf der Liste stehen.
3. Der Nutzer klickt auf den Link und ist danach angemeldet.
4. Die Seite `/passkey-einrichten` ruft `registerPasskey()` auf.
5. Danach erzeugt der Server **10 Wiederherstellungscodes** (je 16 Zeichen, Alphabet ohne verwechselbare Zeichen wie `0/O/1/l`, erzeugt mit `crypto.randomBytes`), speichert **nur die Hashes** (bcrypt, `cost >= 10`) und zeigt die Codes **genau einmal** an, mit „Herunterladen" und „Ich habe sie gespeichert".

### 6.3 Anmeldung

- Die Seite `/login` hat nur noch den Button „Mit Passkey anmelden" → `signInWithPasskey()`. **Kein E-Mail-Feld.**
- In Paket 6a bleibt das Passwort-Login daneben bestehen.

### 6.4 Konto wiederherstellen

1. Die Seite `/wiederherstellen` hat ein E-Mail-Feld und ein Code-Feld.
2. Die Server Action:
   - **Rate-Limit:** Gibt es für diese E-Mail **oder** diese IP in den letzten 15 Minuten 5 oder mehr Einträge in `wiederherstellungs_versuche` → abbrechen.
   - Den Versuch eintragen.
   - Alle unbenutzten Code-Hashes des Nutzers mit `bcrypt.compare` gegen den eingegebenen Code prüfen.
   - **Auf jeden Fehlschlag gleich antworten**, egal ob die E-Mail unbekannt, der Code falsch oder das Limit erreicht ist: „Wiederherstellung fehlgeschlagen."
   - Ist der Code richtig: `benutzt_am` setzen, eine Sitzung erzeugen (`auth.admin.generateLink({ type: 'magiclink', email })` und danach serverseitig `verifyOtp({ type: 'magiclink', token_hash })`) und zu `/passkey-einrichten` weiterleiten.
3. In den Einstellungen gibt es „Neue Codes erzeugen". Das macht die alten Codes ungültig.

**Neue Bibliothek:** `bcryptjs` (reines JavaScript, läuft auf Vercel). **Vor der Installation nachfragen.**

### 6.5 Einstellungen

- Alle Passkeys auflisten (`passkey.list()`), umbenennen und löschen.
- „Weiteren Passkey hinzufügen".
- **Der letzte Passkey kann nicht gelöscht werden.**

### 6.6 Paket 6b: Passwort-Login abschalten

Erst umsetzen, wenn **alle bestehenden Nutzer einen Passkey haben**. Das prüft der Projektinhaber.

- In 6a zeigt die App jedem Nutzer ohne Passkey nach dem Login ein Banner: „Richte jetzt einen Passkey ein".
- In 6b werden `forgot-password`, `reset-password` und das Passwort-Formular entfernt, und in Supabase wird Email+Passwort deaktiviert.

### 6.7 Akzeptanzkriterien

- [ ] Eine E-Mail, die nicht auf der Whitelist steht, bekommt dieselbe Antwort wie eine freigeschaltete, aber es wird kein Konto angelegt.
- [ ] Ein direkter `signUp`-Aufruf mit dem öffentlichen Key schlägt fehl.
- [ ] Nach 5 falschen Wiederherstellungs-Codes ist für 15 Minuten Schluss.
- [ ] Ein Code funktioniert nur einmal.
- [ ] In der Datenbank steht nirgends ein Code im Klartext.

---

## 9. Checkliste vor jedem PR

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
npx next build --webpack
```

- [ ] Hallmark-Sloplint über alle geänderten Dateien und `globals.css`: 0 FAIL / 0 WARN
- [ ] Playwright-Screenshots der betroffenen Seiten in hell und dunkel, vorher und nachher, selbst angesehen
- [ ] Bei neuen Migrationen: Supabase-Advisor ohne neue Warnungen, Rollback-SQL vorhanden, RLS-Test dokumentiert
- [ ] Die PR-Beschreibung folgt der Vorlage aus `AGENTS.md`
