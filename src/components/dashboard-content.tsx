"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { SearchBar } from "@/components/search-bar";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { HeuteView } from "@/components/heute-view";
import { FachManager } from "@/components/fach-manager";
import { StundenplanManager } from "@/components/stundenplan-manager";
import { DeadlineManager } from "@/components/deadline-manager";
import { TodoManager } from "@/components/todo-manager";
import { NoteManager } from "@/components/note-manager";
import { PruefungManager } from "@/components/pruefung-manager";
import {
  NotenPrognose,
  ZielnotenRechner,
  WasWaereWenn,
  BestandenUebersicht,
  LernzeitStatistik,
} from "@/components/rechner-section";
import { AnwesenheitUebersicht, StreakUebersicht } from "@/components/fortschritt-views";
import { LockedCard } from "@/components/locked-card";
import { SegmentedCard } from "@/components/segmented-card";
import { QuickAdd } from "@/components/quick-add";
import { NotificationBell } from "@/components/notification-bell";
import { WidgetToggle, istWidgetSichtbar } from "@/components/widget-toggle";
import type { Tables } from "@/lib/supabase/types";

type Fach = Tables<"fach">;
type Deadline = Tables<"deadline">;
type Todo = Tables<"todo">;
type Note = Tables<"note">;
type Pruefung = Tables<"pruefung">;
type Eintrag = Tables<"stundenplan_eintrag">;
type LernSession = Tables<"lern_session">;
type Benachrichtigung = Tables<"benachrichtigung">;
type Settings = Tables<"settings">;

function begruessung(): string {
  const stunde = new Date().getHours();
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Guten Tag";
  return "Guten Abend";
}

function heutigesDatum(): string {
  return new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function DashboardContent({
  faecher,
  deadlines,
  todos,
  notes,
  pruefungen,
  stundenplanEintraege,
  notenschnitt,
  lernSessions,
  benachrichtigungen,
  sichtbareWidgets,
  settings,
  username,
}: {
  faecher: Fach[];
  deadlines: Deadline[];
  todos: Todo[];
  notes: Note[];
  pruefungen: Pruefung[];
  stundenplanEintraege: Eintrag[];
  notenschnitt: number | null;
  lernSessions: LernSession[];
  benachrichtigungen: Benachrichtigung[];
  sichtbareWidgets: string[];
  settings: Settings;
  username: string;
}) {
  const searchParams = useSearchParams();
  const fachId = searchParams.get("fachId");

  useEffect(() => {
    posthog.capture("dashboard_geoeffnet");
  }, []);

  const gefilterteDeadlines = fachId ? deadlines.filter((d) => d.fach_id === fachId) : deadlines;
  const gefilterteTodos = fachId ? todos.filter((t) => t.fach_id === fachId) : todos;
  const gefilterteNotes = fachId ? notes.filter((n) => n.fach_id === fachId) : notes;
  const gefiltertePruefungen = fachId ? pruefungen.filter((p) => p.fach_id === fachId) : pruefungen;
  const gefilterteStundenplan = fachId
    ? stundenplanEintraege.filter((e) => e.fach_id === fachId)
    : stundenplanEintraege;

  const filterKey = fachId ?? "alle";
  const sichtbar = (key: string) => istWidgetSichtbar(sichtbareWidgets, key);

  const name = username;

  const stats = useMemo(() => {
    const heute = new Date().toISOString().slice(0, 10);
    const termineHeute = deadlines.filter((d) => d.faellig_am.slice(0, 10) === heute).length;
    const naechsteDeadline = [...deadlines]
      .filter((d) => !d.erledigt)
      .sort((a, b) => new Date(a.faellig_am).getTime() - new Date(b.faellig_am).getTime())[0];
    const offeneTodos = todos.filter((t) => !t.erledigt).length;
    return { termineHeute, naechsteDeadline, offeneTodos };
  }, [deadlines, todos]);

  const gesamtEcts = faecher.reduce((sum, f) => sum + (f.ects ?? 0), 0);

  return (
    <>
      <div className="dashboard-greeting">
        <h1>
          {begruessung()}, {name}
        </h1>
        <p>
          {heutigesDatum()}
          {stats.termineHeute > 0 && ` · ${stats.termineHeute} Deadline${stats.termineHeute === 1 ? "" : "s"} heute fällig`}
          {stats.offeneTodos > 0 && ` · ${stats.offeneTodos} offene To-Do${stats.offeneTodos === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="dashboard-toolbar">
        <SearchBar />
        <QuickAdd faecher={faecher} />
        <div className="dashboard-toolbar-rechts">
          <WidgetToggle initialSichtbareWidgets={sichtbareWidgets} />
          <NotificationBell initial={benachrichtigungen} />
          <div className="avatar">{name.slice(0, 2).toUpperCase()}</div>
        </div>
      </div>

      <FachFilterChips faecher={faecher} />

      <div className="dashboard-grid">
        {sichtbar("heute") && (
          <SegmentedCard
            title="Termine"
            subtitle={heutigesDatum()}
            className="span-12"
            segments={[
              {
                key: "heute",
                label: "Heute",
                content: (
                  <HeuteView
                    stundenplanEintraege={stundenplanEintraege}
                    deadlines={deadlines}
                    todos={todos}
                    faecher={faecher}
                  />
                ),
              },
              {
                key: "plan",
                label: "Stundenplan",
                content: (
                  <StundenplanManager
                    key={`stundenplan-${filterKey}`}
                    initialEintraege={gefilterteStundenplan}
                    deadlines={gefilterteDeadlines}
                    pruefungen={gefiltertePruefungen}
                    faecher={faecher}
                    embedded
                  />
                ),
              },
            ]}
          />
        )}

        {sichtbar("aufgaben") && (
          <section className="card span-7">
            <div className="ch">
              <span className="ct">Aufgaben, Fristen &amp; Noten</span>
              <span className="muted" style={{ fontSize: 12 }}>Neu anlegen über &quot;Schnell erfassen&quot;</span>
            </div>

            <h3 className="aufgaben-untertitel">Deadlines &amp; Fristen</h3>
            <DeadlineManager
              key={`deadline-${filterKey}`}
              initialDeadlines={gefilterteDeadlines}
              faecher={faecher}
              embedded
              versteckeErstellen
            />

            <h3 className="aufgaben-untertitel">To-Dos</h3>
            <TodoManager
              key={`todo-${filterKey}`}
              initialTodos={gefilterteTodos}
              faecher={faecher}
              embedded
              versteckeErstellen
            />

            <h3 className="aufgaben-untertitel">Prüfungen</h3>
            <PruefungManager
              key={`pruefung-${filterKey}`}
              initialPruefungen={gefiltertePruefungen}
              faecher={faecher}
              embedded
              versteckeErstellen
            />

            <h3 className="aufgaben-untertitel">Noten</h3>
            <NoteManager
              key={`note-${filterKey}`}
              initialNotes={gefilterteNotes}
              faecher={faecher}
              notenschnitt={notenschnitt}
              embedded
              versteckeErstellen
            />
          </section>
        )}

        {sichtbar("aufgaben") && (
          <SegmentedCard
            title="Noten-Rechner"
            className="span-5"
            segments={[
              {
                key: "prognose",
                label: "Prognose",
                content: <NotenPrognose notenschnitt={notenschnitt} notes={notes} />,
              },
              {
                key: "rechner",
                label: "Rechner",
                content: (
                  <div className="rechner-grid">
                    <ZielnotenRechner notes={notes} />
                    <WasWaereWenn notes={notes} />
                  </div>
                ),
              },
              {
                key: "status",
                label: "Status",
                content: <BestandenUebersicht pruefungen={pruefungen} />,
              },
            ]}
          />
        )}

        {sichtbar("fortschritt") && (
          <SegmentedCard
            title="Fortschritt"
            className="span-7"
            segments={[
              {
                key: "lernzeit",
                label: "Lernzeit",
                content: <LernzeitStatistik lernSessions={lernSessions} faecher={faecher} />,
              },
              {
                key: "anwesenheit",
                label: "Anwesenheit",
                content: <AnwesenheitUebersicht faecher={faecher} />,
              },
              {
                key: "streak",
                label: "Streak",
                content: <StreakUebersicht settings={settings} />,
              },
            ]}
          />
        )}

        <div className="span-5" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <LockedCard
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="6" width="13" height="14" rx="2" />
                <path d="M8 3h9a2 2 0 0 1 2 2v11" />
              </svg>
            }
            title="Karteikarten"
            description="Eigener Hub folgt — noch nicht Teil des Main Hub."
          />

          {sichtbar("faecher") && <FachManager initialFaecher={faecher} />}
        </div>

        <LockedCard
          className="span-12"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          }
          title="Bachelorarbeit-Tracker"
          description="Erscheint automatisch, sobald du bereit bist — mit Countdown & Meilensteinen."
          right={
            <div style={{ minWidth: 220 }}>
              <div className="rowb" style={{ marginBottom: 7 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Freischaltung ab 120 ECTS</span>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display), sans-serif" }}>
                  {gesamtEcts} / 120
                </span>
              </div>
              <div className="progress-track" style={{ height: 9 }}>
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min((gesamtEcts / 120) * 100, 100)}%`, background: "var(--faint)" }}
                />
              </div>
            </div>
          }
        />
      </div>
    </>
  );
}
