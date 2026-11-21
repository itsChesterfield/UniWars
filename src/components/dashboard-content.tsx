"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { AnalyticsNutzer } from "@/components/analytics-nutzer";
import { NoteManager } from "@/components/note-manager";
import { useNeueIds } from "@/components/bewegung/neue-ids";
import { KalenderButton } from "@/components/kalender-button";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { HeuteView } from "@/components/heute-view";
import { NaechsterTermin } from "@/components/naechster-termin";
import { FachManager } from "@/components/fach-manager";
import { StundenplanManager } from "@/components/stundenplan-manager";
import { DeadlineManager } from "@/components/deadline-manager";
import { TodoManager } from "@/components/todo-manager";
import { RollText } from "@/components/bewegung/roll-text";
import { PruefungManager } from "@/components/pruefung-manager";
import {
  NotenKopf,
  NotenDurchschnittProFach,
  NotenRechner,
} from "@/components/rechner-section";
import { Zustand } from "@/components/zustand";
import { gesamtnote } from "@/lib/noten";
import { FortschrittSeite } from "@/components/fortschritt-views";
import { SegmentedCard } from "@/components/segmented-card";
import { ErfassenKnopf, FachNeuKnopf, HauptErfassenKnopf } from "@/components/erfassen-knopf";
import type { Speiseplan } from "@/lib/mensa";
import { DetailAnsicht } from "@/components/detail-ansicht";
import { useAufgabenDetail } from "@/lib/use-aufgaben-detail";
import type { DetailZielTyp } from "@/app/aufgaben-detail/actions";
import type { Tables } from "@/lib/supabase/types";
import { BEREICHE, type Bereich } from "@/lib/dashboard-bereiche";
import { HubBuehne, type BuehneDaten } from "@/components/hub/hub-buehne";
import { HauptNotch } from "@/components/haupt-notch";
import { Bereichskopf } from "@/components/hubs/bereichskopf";
import { kopfAufgaben, kopfFortschritt, kopfNoten, kopfTermine, minutenDieseWoche } from "@/lib/bereichskopf";
import type { FaelligeKarten, ThemaStand } from "@/components/hub/hub-daten";
import { darstellungLesen } from "@/lib/personalisierung";

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
  ectsJeFach,
  lernSessions,
  settings,
  username,
  userId,
  kalender,
  karten,
  serverJetzt,
  bereich: bereichStart = "uebersicht",
  mensa = null,
  semester = null,
  dateien = [],
  themen = [],
}: {
  faecher: Fach[];
  deadlines: Deadline[];
  todos: Todo[];
  notes: Note[];
  pruefungen: Pruefung[];
  stundenplanEintraege: Eintrag[];
  /** ECTS je Fach, auch archivierter Fächer, für die Gesamtnote */
  ectsJeFach: Record<string, number | null>;
  lernSessions: LernSession[];
  settings: Settings;
  username: string;
  userId: string;
  kalender: { konfiguriert: boolean; verbunden: boolean; probleme: string[] };
  /** heute fällige Karteikarten, für die Übersicht */
  karten: FaelligeKarten;
  /** Zeitpunkt der Anfrage auf dem Server (ISO), für den ersten Stand der Uhr im Hub */
  serverJetzt: string;
  /** Übersicht oder ein einzelner Bereich als eigene Seite (Kontextspalte) */
  bereich?: Bereich;
  /** Speiseplan der gewählten Mensa (nur Übersicht) */
  mensa?: Speiseplan | null;
  /** Kurzinfo zum Semester für „Diese Woche“ */
  semester?: string | null;
  /** zuletzt geänderte Dateien (Szene „Zuletzt geöffnet“ der Hub-Bühne) */
  dateien?: BuehneDaten["dateien"];
  /** Wissensstand pro Thema (Klausurphase im Hub) */
  themen?: ThemaStand[];
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
  const neueNoten = useNeueIds(notes);



  const terminKarte = (klasse: string) => (
        <SegmentedCard
          title="Termine"
          titelVerstecken
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
          key={searchParams.get("vorlesung") ? "direkte-vorlesung" : "termine"}
          startSegment={searchParams.get("vorlesung") ? "plan" : undefined}
          segments={[
            {
              key: "heute",
              label: "Heute",
              content: (
                <HeuteView
                  stundenplanEintraege={stundenplanEintraege}
                  deadlines={deadlines}
                  todos={todos}
                  pruefungen={pruefungen}
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

  // Design B3: keine Karte, drei Abschnitte mit Trennlinien. Neu anlegen über „Schnell erfassen“ im Seitenkopf.
  const aufgabenKarte = (klasse: string) => (
        <div className={`aufgaben-seite ${klasse}`}>
          <section aria-labelledby="abschnitt-deadlines">
            <DeadlineManager
              kopf={(offen) => <AbschnittKopf id="abschnitt-deadlines" titel="Deadlines" offen={offen} />}
              key={`deadline-${filterKey}`}
              initialDeadlines={gefilterteDeadlines}
              faecher={faecher}
              embedded
              versteckeErstellen
              userId={userId}
            />

          </section>
          <section aria-labelledby="abschnitt-todos">
            <TodoManager
              kopf={(offen) => <AbschnittKopf id="abschnitt-todos" titel="To-Dos" offen={offen} />}
              key={`todo-${filterKey}`}
              initialTodos={gefilterteTodos}
              faecher={faecher}
              deadlines={gefilterteDeadlines}
              embedded
              versteckeErstellen
              userId={userId}
            />

          </section>
          <section aria-labelledby="abschnitt-pruefungen">
            <h2 id="abschnitt-pruefungen" className="abschnitt-titel">Prüfungen</h2>
            <PruefungManager
              key={`pruefung-${filterKey}`}
              initialPruefungen={gefiltertePruefungen}
              faecher={faecher}
              deadlines={gefilterteDeadlines}
              embedded
              versteckeErstellen
              userId={userId}
            />
          </section>
        </div>
  );

  // Design B3, Noten: Schnitt groß, darunter Noten, Schnitt pro Fach und Rechner als Abschnitte (kein Segment, keine Karte)
  const gefilterteNotes = fachId ? notes.filter((n) => n.fach_id === fachId) : notes;
  // Gesamtnote wie an der Uni: Module nach ECTS, Teilnoten nach Anteil, abgeschnitten (lib/noten.ts)
  const ectsVon = (id: string) => ectsJeFach[id] ?? null;
  const gesamt = gesamtnote(notes, ectsVon);
  const gefiltertGesamt = fachId ? gesamtnote(gefilterteNotes, ectsVon) : gesamt;
  const mitNote = new Set(notes.filter((n) => n.wert !== null).map((n) => n.fach_id));
  const offeneEctsListe = faecher.filter((f) => !mitNote.has(f.id) && (f.ects ?? 0) > 0).map((f) => f.ects as number);
  const offeneEcts = { naechstes: offeneEctsListe[0] ?? null, summe: offeneEctsListe.reduce((a, b) => a + b, 0) };
  const filterFach = fachId ? faecher.find((f) => f.id === fachId) : undefined;
  const notenBlock = (klasse: string) =>
    notes.length === 0 ? (
      <div className={klasse}>
        <Zustand
          art="leer"
          icon="noten"
          titel="Noch keine Noten."
          aktion={<ErfassenKnopf modus="NOTE">Note erfassen</ErfassenKnopf>}
        >
          Trag deine Noten ein und bei den Fächern die ECTS. Dann siehst du hier deine Gesamtnote, die Modulnoten und was du für dein Ziel brauchst.
        </Zustand>
      </div>
    ) : (
      <div className={`noten-seite ${klasse}`}>
        {gefilterteNotes.length > 0 && (
          <NotenKopf
            gesamt={gefiltertGesamt}
            fachName={filterFach?.name}
            fachNamen={(id) => faecher.find((f) => f.id === id)?.name ?? "ein archiviertes Fach"}
            pruefungen={gefiltertePruefungen}
          />
        )}
        <section aria-labelledby="abschnitt-noten">
          <h2 id="abschnitt-noten" className="abschnitt-titel">
            Noten
          </h2>
          <NoteManager
            key={`noten-${filterKey}`}
            initialNotes={gefilterteNotes}
            neuIds={neueNoten}
            faecher={faecher}
            embedded
            versteckeErstellen
          />
        </section>
        {!fachId && <NotenDurchschnittProFach gesamt={gesamt} faecher={faecher} />}
        {!fachId && <NotenRechner key={`${gesamt.wert}-${offeneEcts.summe}`} gesamt={gesamt} offeneEcts={offeneEcts} />}
      </div>
    );

  // Die Notch wechselt den Bereich ohne Server-Aufruf (nur die Adresse ändert sich): Bereich aus der Adresse lesen
  const pfad = usePathname();
  const bereich: Bereich = BEREICHE.find((b) => b.href === pfad)?.bereich ?? bereichStart;
  const info = BEREICHE.find((b) => b.bereich === bereich) ?? BEREICHE[0];
  // Kopf wie im Hub: eine Zahl und ein Satz, was in diesem Bereich gerade zählt
  const kopfJetzt = new Date(serverJetzt);
  const kopf =
    bereich === "termine"
      ? kopfTermine({ stundenplan: stundenplanEintraege, deadlines, pruefungen, fachName: (id) => faecher.find((f) => f.id === id)?.name ?? null }, kopfJetzt)
      : bereich === "aufgaben"
        ? kopfAufgaben({ deadlines, todos, pruefungen }, kopfJetzt)
        : bereich === "noten"
          ? kopfNoten(fachId ? (gefiltertGesamt.module[0]?.note ?? null) : gesamt.wert, gefilterteNotes.filter((n) => n.wert !== null).length)
          : bereich === "fortschritt"
            ? kopfFortschritt(settings.streak_count, minutenDieseWoche(lernSessions, kopfJetzt))
            : { zahl: null, einheit: "", lage: null };

  // Hauptknopf passend zur Seite (Aufgabe 4, A4)
  const hauptAktion =
    bereich === "termine" ? (
      <HauptErfassenKnopf modus="TERMIN">Termin</HauptErfassenKnopf>
    ) : bereich === "aufgaben" ? (
      <HauptErfassenKnopf>Aufgabe</HauptErfassenKnopf>
    ) : bereich === "noten" ? (
      <HauptErfassenKnopf modus="NOTE">Note</HauptErfassenKnopf>
    ) : bereich === "faecher" && faecher.length > 0 ? (
      <FachNeuKnopf />
    ) : undefined;

  return (
    <>
      <AnalyticsNutzer userId={userId} username={username} />
      {/* Bereiche des Zentralen Hubs als Notch oben (statt Kontextspalte) */}
      <HauptNotch aktiv={bereich} />

      {bereich === "uebersicht" ? (
        <div key="uebersicht" className="bereich-ein">
          <HubBuehne
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
              themen,
              darstellung: darstellungLesen(settings.darstellung),
              serverJetzt,
              mensa,
              mensaGewaehlt: Boolean(settings.mensa_id),
              semester,
              notenschnitt: gesamt.wert,
              dateien,
            }}
          />
        </div>
      ) : (
        <div key={bereich} className="hubseite bereich-ein">
          <Bereichskopf titel={info.name} untertitel={bereich === "faecher" && faecher.length ? undefined : info.untertitel} {...kopf} aktionen={hauptAktion} />

          {(bereich === "termine" || bereich === "aufgaben" || bereich === "noten") && <FachFilterChips faecher={faecher} />}

          {bereich === "termine" && <div className="dashboard-grid">{terminKarte("span-12")}</div>}
          {bereich === "aufgaben" && <div className="dashboard-grid">{aufgabenKarte("span-12")}</div>}
          {bereich === "noten" && <div className="dashboard-grid">{notenBlock("span-12")}</div>}
          {bereich === "fortschritt" && (
            <div className="dashboard-grid">
              <div className="span-12">
                <FortschrittSeite lernSessions={lernSessions} faecher={faecher} settings={settings} />
              </div>
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

/** Abschnittskopf mit der Zahl offener Einträge; die Zahl rollt beim Abhaken (Bewegung) */
function AbschnittKopf({ id, titel, offen }: { id: string; titel: string; offen: number | null }) {
  return (
    <h2 id={id} className="abschnitt-titel">
      {titel}
      {offen != null && <RollText wert={`${offen} offen`} className="abschnitt-zahl" />}
    </h2>
  );
}
