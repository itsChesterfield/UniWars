"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import { toggleDeadlineErledigt } from "@/app/deadline/actions";
import { toggleTodoErledigt } from "@/app/todo/actions";
import type { Tables, Enums } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";

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
  erledigt: boolean;
  onToggle: (() => void) | null;
};

export function HeuteView({
  stundenplanEintraege,
  deadlines,
  todos,
  faecher,
}: {
  stundenplanEintraege: Eintrag[];
  deadlines: Deadline[];
  todos: Todo[];
  faecher: FachOption[];
}) {
  const heutigerTag = JS_TAG_ZU_WOCHENTAG[new Date().getDay()];
  const heute = new Date().toISOString().slice(0, 10);

  const [erledigteDeadlines, setErledigteDeadlines] = useState<Set<string>>(
    () => new Set(deadlines.filter((d) => d.erledigt).map((d) => d.id)),
  );
  const [erledigteTodos, setErledigteTodos] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

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
    }));

  const deadlinesHeute: TimelineEintrag[] = deadlines
    .filter((d) => d.faellig_am.slice(0, 10) === heute)
    .map((d) => ({
      key: `d-${d.id}`,
      typ: "Deadline",
      zeit: new Date(d.faellig_am).toTimeString().slice(0, 5),
      titel: d.titel,
      erledigt: erledigteDeadlines.has(d.id),
      onToggle: () => deadlineUmschalten(d.id),
    }));

  const offeneTodosHeute: TimelineEintrag[] = todos
    .filter((t) => !t.erledigt && !erledigteTodos.has(t.id))
    .map((t) => ({
      key: `t-${t.id}`,
      typ: "To-Do",
      zeit: null,
      titel: t.titel,
      erledigt: false,
      onToggle: () => todoAbhaken(t.id),
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
        <p className="empty-state">Nichts Anstehendes für heute.</p>
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
                  <span className="heute-icon" aria-hidden>
                    📅
                  </span>
                )}
                {item.zeit && <span className="heute-zeit">{item.zeit}</span>}
                <span className="entry-title" style={{ flex: 1 }}>
                  {item.titel}
                </span>
                <span className={`tag ${dringend ? "tag-danger" : ""}`}>{item.typ}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
