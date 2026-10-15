# UniWars

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E) ![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)

UniWars ist ein Studien-Organizer für Studierende. Deadlines, Prüfungen, To-dos, Stundenplan und Noten liegen an einem Ort, und Gruppenarbeiten lassen sich mit Kommiliton:innen teilen.

## Funktionen

- **Dashboard „Heute“** – was heute ansteht: Vorlesungen, fällige Deadlines und offene To-dos
- **Deadlines, Prüfungen und To-dos** – mit Unteraufgaben, Anhängen und Detailansicht
- **Quick-Add** – Einträge in natürlicher Sprache anlegen, z. B. „Abgabe Übungsblatt 3 nächsten Freitag“. Typ (Prüfung, Abgabe, Termin, Gruppenarbeit) und Datum werden automatisch erkannt
- **Fächer und Stundenplan** – mit Filter nach Fach und Übersicht über Fehltage
- **Noten** – Noten erfassen und Durchschnitt berechnen
- **Teilen** – Deadlines und Prüfungen per Einladung mit anderen teilen und Aufgaben zuweisen
- **Google-Kalender-Sync** – Einträge landen automatisch in einem eigenen Kalender „UniWars“
- **Streaks** – tägliche Lern-Serie mit „Freeze“-Tagen
- **Benachrichtigungen** und eine Suche über alle Einträge
- **Analytics nur mit Einwilligung** (PostHog, EU-Server)

## Technik

| Bereich | Umsetzung |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Backend | Next.js Server Actions und Route Handler |
| Datenbank & Auth | Supabase (PostgreSQL, Supabase Auth) |
| Datenzugriff | Row Level Security: jede Tabelle hat Policies, sodass Nutzer nur eigene oder geteilte Einträge sehen |
| Kalender | Google Calendar API über OAuth; Tokens werden mit AES-256-GCM verschlüsselt gespeichert |
| Datumserkennung | `chrono-node` plus eigene Schlüsselwort-Erkennung |
| Tests | Node Test Runner (`node --test`) |
| Hosting | Vercel (Region Frankfurt) |

## Lokal starten

Voraussetzungen: Node.js 20+, ein Supabase-Projekt

```bash
git clone https://github.com/itsChesterfield/UniWars.git
cd UniWars
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev
```

Danach läuft die App unter http://localhost:3000.

Das Datenbankschema liegt als Migrationen in `supabase/migrations/`.

## Tests

```bash
npm test
```

## Projektstruktur

```
src/
├── app/          Seiten, Server Actions und Route Handler (je Bereich ein Ordner)
├── components/   UI-Komponenten (Dashboard, Manager, Dialoge)
└── lib/          Logik: Supabase-Clients, Kalender-Sync, Streaks, Typ-Erkennung
supabase/
└── migrations/   SQL-Schema inkl. Row-Level-Security-Policies
```

## Autor

Max Danigel – Student Angewandte Informatik, HTW Berlin
