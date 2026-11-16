"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { AnalyticsNutzer } from "@/components/analytics-nutzer";
import { NoteManager } from "@/components/note-manager";
import { KalenderButton } from "@/components/kalender-button";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { HeuteView } from "@/components/heute-view";
import { NaechsterTermin } from "@/components/naechster-termin";
import { FachManager } from "@/components/fach-manager";
import { StundenplanManager } from "@/components/stundenplan-manager";
import { DeadlineManager } from "@/components/deadline-manager";
import { TodoManager } from "@/components/todo-manager";
import { PruefungManager } from "@/components/pruefung-manager";
import {
  NotenPrognose,
  NotenDurchschnittProFach,
  ZielnotenRechner,
  WasWaereWenn,
  BestandenUebersicht,
  LernzeitStatistik,
} from "@/components/rechner-section";
import { AnwesenheitUebersicht, StreakUebersicht } from "@/components/fortschritt-views";
import { LockedCard } from "@/components/locked-card";
import { SegmentedCard } from "@/components/segmented-card";
import { QuickAdd } from "@/components/quick-add";
import { DetailAnsicht } from "@/components/detail-ansicht";
import { useAufgabenDetail } from "@/lib/use-aufgaben-detail";
import type { DetailZielTyp } from "@/app/aufgaben-detail/actions";
import type { Tables } from "@/lib/supabase/types";
import { BEREICHE, type Bereich } from "@/lib/dashboard-bereiche";
import { HubKontext } from "@/components/hub/hub-kontext";
import { HubUebersicht } from "@/components/hub/hub-uebersicht";
import type { FaelligeKarten } from "@/components/hub/hub-bausteine";

type Fach = Tables<"fach">;
type Deadline = Tables<"deadline">;
type Todo = Tables<"todo">;
type Note = Tables<"note">;
type Pruefung = Tables<"pruefung">;
type Eintrag = Tables<"stundenplan_eintrag">;
type LernSession = Tables<"lern_session">;
type Settings = Tables<"settings">;

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
  settings,
  username,
  userId,
  kalender,
  karten,
  bereich = "uebersicht",
}: {
  faecher: Fach[];
  deadlines: Deadline[];
  todos: Todo[];
  notes: Note[];
  pruefungen: Pruefung[];
  stundenplanEintraege: Eintrag[];
  notenschnitt: number | null;
  lernSessions: LernSession[];
  settings: Settings;
  username: string;
  userId: string;
  kalender: { konfiguriert: boolean; verbunden: boolean; probleme: string[] };
  /** heute fällige Karteikarten, für die Übersicht */
  karten: FaelligeKarten;
  /** Übersicht oder ein einzelner Bereich als eigene Seite (Kontextspalte) */
  bereich?: Bereich;
}) {
  const searchParams = useSearchParams();
  const fachId = searchParams.get("fachId");
  const detailParam = searchParams.get("detail");
  const { schliesse: schliesseDetail } = useAufgabenDetail();
  const [detailZielTypRoh, detailZielId] = detailParam ? detailParam.split(":") : [null, null];
  const detailZielTyp: DetailZielTyp | null =
    detailZielTypRoh === "todo" || detailZielTypRoh === "deadline" || detailZielTypRoh === "pruefung"
      ? detailZielTypRoh
      : null;

  useEffect(() => {
    track("dashboard_geoeffnet");
  }, []);

  const gefilterteDeadlines = fachId ? deadlines.filter((d) => d.fach_id === fachId) : deadlines;
  const gefilterteTodos = fachId ? todos.filter((t) => t.fach_id === fachId) : todos;
  const gefiltertePruefungen = fachId ? pruefungen.filter((p) => p.fach_id === fachId) : pruefungen;
  const gefilterteStundenplan = fachId
    ? stundenplanEintraege.filter((e) => e.fach_id === fachId)
    : stundenplanEintraege;

  // Manager kopieren ihre Props in lokalen State; bei frischen Serverdaten neu aufbauen.
  const [datenStand, setDatenStand] = useState({ deadlines, todos, pruefungen, notes, version: 0 });
  if (
    datenStand.deadlines !== deadlines ||
    datenStand.todos !== todos ||
    datenStand.pruefungen !== pruefungen ||
    datenStand.notes !== notes
  ) {
    setDatenStand({ deadlines, todos, pruefungen, notes, version: datenStand.version + 1 });
  }

  const filterKey = `${fachId ?? "alle"}-${datenStand.version}`;

  const gesamtEcts = faecher.reduce((sum, f) => sum + (f.ects ?? 0), 0);


  const terminKarte = (klasse: string) => (
        <SegmentedCard
          title="Termine"
          subtitle={heutigesDatum()}
          className={klasse}
          aktion={
            <KalenderButton
              konfiguriert={kalender.konfiguriert}
              verbunden={kalender.verbunden}
              probleme={kalender.probleme}
            />
          }
          banner={
            <NaechsterTermin deadlines={deadlines} pruefungen={pruefungen} faecher={faecher} />
          }
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
                  kalenderVerbunden={kalender.verbunden}
                  embedded
                />
              ),
            },
          ]}
        />
  );

  const aufgabenKarte = (klasse: string, scroll: boolean) => (
        <section className={`card ${klasse}`}>
          <div className="ch">
            <span className="ct">Aufgaben &amp; Fristen</span>
            <span className="muted" style={{ fontSize: 12 }}>Neu anlegen über &quot;Schnell erfassen&quot;</span>
          </div>

          <div className={scroll ? "aufgaben-scroll" : "aufgaben-voll"}>
            <h3 className="aufgaben-untertitel">Deadlines &amp; Fristen</h3>
            <DeadlineManager
              key={`deadline-${filterKey}`}
              initialDeadlines={gefilterteDeadlines}
              faecher={faecher}
              embedded
              versteckeErstellen
              userId={userId}
            />

            <h3 className="aufgaben-untertitel">To-Dos</h3>
            <TodoManager
              key={`todo-${filterKey}`}
              initialTodos={gefilterteTodos}
              faecher={faecher}
              deadlines={gefilterteDeadlines}
              embedded
              versteckeErstellen
              userId={userId}
            />

            <h3 className="aufgaben-untertitel">Prüfungen</h3>
            <PruefungManager
              key={`pruefung-${filterKey}`}
              initialPruefungen={gefiltertePruefungen}
              faecher={faecher}
              deadlines={gefilterteDeadlines}
              embedded
              versteckeErstellen
              userId={userId}
            />
          </div>
        </section>
  );

  const notenBlock = (klasse: string) => (
        <div className={klasse} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <SegmentedCard
            title="Noten-Rechner"
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
                key: "noten",
                label: "Noten",
                content: (
                  <NoteManager
                    key={`noten-${filterKey}`}
                    initialNotes={notes}
                    faecher={faecher}
                    notenschnitt={notenschnitt}
                    embedded
                  />
                ),
              },
              {
                key: "status",
                label: "Status",
                content: <BestandenUebersicht pruefungen={pruefungen} />,
              },
            ]}
          />

          <section className="card">
            <div className="ch">
              <span className="ct">Durchschnitt pro Fach</span>
            </div>
            <NotenDurchschnittProFach notes={notes} faecher={faecher} />
          </section>
        </div>
  );

  const fortschrittKarte = (klasse: string) => (
        <SegmentedCard
          title="Fortschritt"
          className={klasse}
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
  );

  const bachelorKarte = (
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
  );

  const info = BEREICHE.find((b) => b.bereich === bereich) ?? BEREICHE[0];

  return (
    <>
      <AnalyticsNutzer userId={userId} username={username} />
      <HubKontext aktiv={bereich} faecher={faecher} deadlines={deadlines} pruefungen={pruefungen} mobil />

      {bereich === "uebersicht" ? (
        <>
          <HubUebersicht
            d={{
              name: username,
              faecher,
              deadlines,
              todos,
              pruefungen,
              stundenplan: stundenplanEintraege,
              lernSessions,
              streak: settings.streak_count,
              karten,
            }}
            layoutRoh={settings.hub_layout}
          />
          <QuickAdd faecher={faecher} todos={todos} pruefungen={pruefungen} ohneKnopf />
        </>
      ) : (
        <div className="hubseite">
          <header className="seitenkopf">
            <div>
              <h1>{info.name}</h1>
              <p>{info.untertitel}</p>
            </div>
            <div className="rechts">
              <QuickAdd faecher={faecher} todos={todos} pruefungen={pruefungen} />
            </div>
          </header>

          {(bereich === "termine" || bereich === "aufgaben" || bereich === "noten") && <FachFilterChips faecher={faecher} />}

          {bereich === "termine" && <div className="dashboard-grid">{terminKarte("span-12")}</div>}
          {bereich === "aufgaben" && <div className="dashboard-grid">{aufgabenKarte("span-12", false)}</div>}
          {bereich === "noten" && <div className="dashboard-grid">{notenBlock("span-12")}</div>}
          {bereich === "fortschritt" && (
            <div className="dashboard-grid">
              {fortschrittKarte("span-12")}
              {bachelorKarte}
            </div>
          )}
          {bereich === "faecher" && (
            <div className="dashboard-grid">
              <div className="span-12">
                <FachManager initialFaecher={faecher} />
              </div>
            </div>
          )}
        </div>
      )}

      {detailZielTyp && detailZielId && (
        <DetailAnsicht zielTyp={detailZielTyp} zielId={detailZielId} onClose={schliesseDetail} />
      )}
    </>
  );
}
