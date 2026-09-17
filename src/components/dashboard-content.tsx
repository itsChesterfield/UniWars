"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { SearchBar } from "@/components/search-bar";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { HeuteView } from "@/components/heute-view";
import { KalenderWoche } from "@/components/kalender-woche";
import { FachManager } from "@/components/fach-manager";
import { StundenplanManager } from "@/components/stundenplan-manager";
import { DeadlineManager } from "@/components/deadline-manager";
import { TodoManager } from "@/components/todo-manager";
import { NoteManager } from "@/components/note-manager";
import { PruefungManager } from "@/components/pruefung-manager";
import type { Tables } from "@/lib/supabase/types";

type Fach = Tables<"fach">;
type Deadline = Tables<"deadline">;
type Todo = Tables<"todo">;
type Note = Tables<"note">;
type Pruefung = Tables<"pruefung">;
type Eintrag = Tables<"stundenplan_eintrag">;

export function DashboardContent({
  faecher,
  deadlines,
  todos,
  notes,
  pruefungen,
  stundenplanEintraege,
  notenschnitt,
}: {
  faecher: Fach[];
  deadlines: Deadline[];
  todos: Todo[];
  notes: Note[];
  pruefungen: Pruefung[];
  stundenplanEintraege: Eintrag[];
  notenschnitt: number | null;
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

  return (
    <>
      <div className="dashboard-toolbar">
        <SearchBar />
        <FachFilterChips faecher={faecher} />
      </div>

      <HeuteView
        stundenplanEintraege={stundenplanEintraege}
        deadlines={deadlines}
        todos={todos}
        faecher={faecher}
      />

      <FachManager initialFaecher={faecher} />

      <KalenderWoche
        stundenplanEintraege={gefilterteStundenplan}
        deadlines={gefilterteDeadlines}
        pruefungen={gefiltertePruefungen}
        faecher={faecher}
      />

      <StundenplanManager
        key={`stundenplan-${filterKey}`}
        initialEintraege={gefilterteStundenplan}
        faecher={faecher}
      />
      <DeadlineManager
        key={`deadline-${filterKey}`}
        initialDeadlines={gefilterteDeadlines}
        faecher={faecher}
      />
      <TodoManager key={`todo-${filterKey}`} initialTodos={gefilterteTodos} faecher={faecher} />
      <NoteManager
        key={`note-${filterKey}`}
        initialNotes={gefilterteNotes}
        faecher={faecher}
        notenschnitt={notenschnitt}
      />
      <PruefungManager
        key={`pruefung-${filterKey}`}
        initialPruefungen={gefiltertePruefungen}
        faecher={faecher}
      />
    </>
  );
}
