"use client";

import { useEffect, useState, useTransition } from "react";
import { createUnterpunkte, toggleTodoErledigt, deleteTodo } from "@/app/todo/actions";
import { todoMitgliederLaden } from "@/app/einladung/actions";
import {
  UnteraufgabenEditor,
  type EditorMitglied,
  type UnteraufgabeEingabe,
} from "@/components/unteraufgaben-editor";
import { absolutesDatum } from "@/lib/countdown";
import { track } from "@/lib/analytics";
import type { Tables } from "@/lib/supabase/types";

type Todo = Tables<"todo">;

export function TodoUnterpunkte({
  parentId,
  fachId,
  initial,
}: {
  parentId: string;
  fachId: string | null;
  initial: Todo[];
}) {
  const [unterpunkte, setUnterpunkte] = useState(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [mitglieder, setMitglieder] = useState<EditorMitglied[]>([]);
  const [, startTransition] = useTransition();

  const hatZuweisungen = unterpunkte.some((t) => t.zugewiesen_an);

  useEffect(() => {
    if (!formOpen && !hatZuweisungen) return;
    todoMitgliederLaden(parentId)
      .then(setMitglieder)
      .catch(() => setMitglieder([]));
  }, [formOpen, hatZuweisungen, parentId]);

  const sortiert = [...unterpunkte].sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
    return new Date(a.erstellt_am).getTime() - new Date(b.erstellt_am).getTime();
  });

  async function speichern(eintraege: UnteraufgabeEingabe[]) {
    const created = await createUnterpunkte(
      parentId,
      fachId,
      eintraege.map((e) => ({
        titel: e.titel,
        faelligAm: e.faelligAm ? new Date(e.faelligAm).toISOString() : undefined,
        zugewiesenAn: e.zugewiesenAn || undefined,
      })),
    );
    setUnterpunkte((prev) => [...prev, ...created]);
    setFormOpen(false);
  }

  function handleToggle(t: Todo) {
    const naechsterStatus = !t.erledigt;
    setUnterpunkte((prev) => prev.map((x) => (x.id === t.id ? { ...x, erledigt: naechsterStatus } : x)));
    startTransition(() => toggleTodoErledigt(t.id, naechsterStatus));
    if (naechsterStatus) track("unteraufgabe_erledigt", { eltern_typ: "todo", ort: "liste" });
  }

  function handleDelete(id: string) {
    setUnterpunkte((prev) => prev.filter((x) => x.id !== id));
    startTransition(() => deleteTodo(id));
    track("unteraufgabe_geloescht", { eltern_typ: "todo", ort: "liste" });
  }

  function nameVon(userId: string | null): string | null {
    if (!userId) return null;
    return mitglieder.find((m) => m.user_id === userId)?.username ?? null;
  }

  if (unterpunkte.length === 0 && !formOpen) {
    return (
      <button type="button" className="unteraufgabe-add" onClick={() => setFormOpen(true)}>
        + Unterpunkte
      </button>
    );
  }

  return (
    <div className="unteraufgaben">
      {sortiert.map((t) => {
        const name = nameVon(t.zugewiesen_an);
        const details = [name ? `→ ${name}` : null, t.faellig_am ? absolutesDatum(t.faellig_am) : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <div key={t.id} className={`unteraufgabe-row ${t.erledigt ? "entry-erledigt" : ""}`}>
            <input
              type="checkbox"
              checked={t.erledigt}
              onChange={() => handleToggle(t)}
              aria-label="Erledigt"
            />
            <div className="unteraufgabe-info">
              <span>{t.titel}</span>
              {details && <span className="muted" style={{ fontSize: 11 }}>{details}</span>}
            </div>
            <button type="button" onClick={() => handleDelete(t.id)} aria-label="Unterpunkt löschen">
              ✕
            </button>
          </div>
        );
      })}

      {formOpen ? (
        <UnteraufgabenEditor
          elternTyp="todo"
          ort="liste"
          mitglieder={mitglieder}
          terminPflicht={false}
          onSpeichern={speichern}
          onAbbrechen={() => setFormOpen(false)}
        />
      ) : (
        <button type="button" className="unteraufgabe-add" onClick={() => setFormOpen(true)}>
          + Unterpunkte
        </button>
      )}
    </div>
  );
}
