"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import { toggleDeadlineErledigt } from "@/app/deadline/actions";
import { toggleTodoErledigt } from "@/app/todo/actions";
import { useAufgabenDetail } from "@/lib/use-aufgaben-detail";
import type { Tables, Enums } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";
import { Icon } from "@/components/nav-icon";
import { Zustand } from "@/components/zustand";
import { ErfassenKnopf } from "@/components/erfassen-knopf";
import { berlinDatum, berlinUhrzeit } from "@/lib/zeit";
import { oberaufgabe } from "@/lib/hub-buehne";

type Deadline = Tables<"deadline">;
type Todo = Tables<"todo">;
type Eintrag = Tables<"stundenplan_eintrag">;

const JS_TAG_ZU_WOCHENTAG: Record<number, Enums<"wochentag">> = {
  0: "SO",
  1: "MO",
  2: "DI",
  3: "MI",
  4: "DO",
  5: "FR",
  6: "SA",
};

type TimelineEintrag = {
  key: string;
  typ: "Unterricht" | "Deadline" | "To-Do";
  zeit: string | null;
  titel: string;
  /** Unteraufgabe: Titel der Aufgabe, zu der sie gehört */
  teilVon?: string | null;
  erledigt: boolean;
  onToggle: (() => void) | null;
  ziel: { zielTyp: "deadline" | "todo"; zielId: string } | null;
};

export function HeuteView({
  stundenplanEintraege,
  deadlines,
  todos,
  pruefungen = [],
  faecher,
}: {
  stundenplanEintraege: Eintrag[];
  deadlines: Deadline[];
  todos: Todo[];
  pruefungen?: { id: string; titel: string }[];
  faecher: FachOption[];
}) {
  const heutigerTag = JS_TAG_ZU_WOCHENTAG[new Date().getDay()];
  const heute = berlinDatum(new Date());
  const teilVon = (f: Deadline) => oberaufgabe(f, { deadlines, todos, pruefungen });

  const [erledigteDeadlines, setErledigteDeadlines] = useState<Set<string>>(
    () => new Set(deadlines.filter((d) => d.erledigt).map((d) => d.id)),
  );
  const [erledigteTodos, setErledigteTodos] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const { oeffne } = useAufgabenDetail();

  function deadlineUmschalten(id: string) {
    const neu = !erledigteDeadlines.has(id);
    setErledigteDeadlines((prev) => {
      const next = new Set(prev);
      if (neu) next.add(id);
      else next.delete(id);
      return next;
    });
    startTransition(async () => {
      await toggleDeadlineErledigt(id, neu);
      if (neu) posthog.capture("deadline_erledigt", { deadline_id: id });
    });
  }

  function todoAbhaken(id: string) {
    setErledigteTodos((prev) => new Set(prev).add(id));
    startTransition(async () => {
      await toggleTodoErledigt(id, true);
      posthog.capture("todo_erledigt", { todo_id: id });
    });
  }

  const unterrichtHeute: TimelineEintrag[] = stundenplanEintraege
    .filter((e) => e.tag === heutigerTag)
    .map((e) => ({
      key: `u-${e.id}`,
      typ: "Unterricht",
      zeit: e.start_zeit.slice(0, 5),
      titel: faecher.find((f) => f.id === e.fach_id)?.name ?? "Unterricht",
      erledigt: false,
      onToggle: null,
      ziel: null,
    }));

  const deadlinesHeute: TimelineEintrag[] = deadlines
    .filter((d) => berlinDatum(new Date(d.faellig_am)) === heute)
    .map((d) => ({
      key: `d-${d.id}`,
      typ: "Deadline",
      zeit: berlinUhrzeit(new Date(d.faellig_am)),
      titel: d.titel,
      teilVon: teilVon(d),
      erledigt: erledigteDeadlines.has(d.id),
      onToggle: () => deadlineUmschalten(d.id),
      ziel: { zielTyp: "deadline" as const, zielId: d.id },
    }));

  // Nur To-dos, die heute oder schon früher fällig sind: ohne Datum ist ein To-do nicht „heute“ dran
  const offeneTodosHeute: TimelineEintrag[] = todos
    .filter((t) => !t.erledigt && !erledigteTodos.has(t.id) && t.faellig_am !== null && berlinDatum(new Date(t.faellig_am)) <= heute)
    .map((t) => ({
      key: `t-${t.id}`,
      typ: "To-Do",
      zeit: null,
      titel: t.titel,
      teilVon: t.parent_id ? (todos.find((x) => x.id === t.parent_id)?.titel ?? "einem To-do") : null,
      erledigt: false,
      onToggle: () => todoAbhaken(t.id),
      ziel: { zielTyp: "todo" as const, zielId: t.id },
    }));

  const timeline = [...unterrichtHeute, ...deadlinesHeute, ...offeneTodosHeute].sort((a, b) => {
    if (a.zeit === null && b.zeit === null) return 0;
    if (a.zeit === null) return 1;
    if (b.zeit === null) return -1;
    return a.zeit.localeCompare(b.zeit);
  });

  return (
    <>
      {timeline.length === 0 ? (
        <Zustand art="leer" region ebene={3} titel="Heute ist nichts geplant." aktion={<ErfassenKnopf modus="TERMIN">Termin erfassen</ErfassenKnopf>}>
          Unterricht aus dem Stundenplan, Deadlines von heute und To-Dos, die heute fällig sind, erscheinen hier nach Uhrzeit.
        </Zustand>
      ) : (
        <ul className="heute-liste">
          {timeline.map((item) => {
            const dringend = item.typ === "Deadline" && !item.erledigt;
            return (
              <li
                key={item.key}
                className={`heute-item ${item.erledigt ? "entry-erledigt" : ""} ${dringend ? "entry-dringend" : ""}`}
              >
                {item.onToggle ? (
                  <input
                    type="checkbox"
                    checked={item.erledigt}
                    onChange={item.onToggle}
                    aria-label="Erledigt"
                  />
                ) : (
                  <span className="heute-icon">
                    <Icon name="termine" groesse={18} />
                  </span>
                )}
                {item.zeit && <span className="heute-zeit">{item.zeit}</span>}
                {item.ziel ? (
                  <button
                    type="button"
                    className="entry-title entry-title-link heute-titel"
                    onClick={() => item.ziel && oeffne(item.ziel.zielTyp, item.ziel.zielId)}
                  >
                    {item.titel}
                    {item.teilVon && <small className="heute-teil">Teil von „{item.teilVon}“</small>}
                  </button>
                ) : (
                  <span className="entry-title heute-titel">
                    {item.titel}
                  </span>
                )}
                <span className={`heute-typ ${dringend ? "dringend" : ""}`}>{item.typ}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
