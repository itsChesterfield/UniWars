"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createDeadline,
  toggleDeadlineErledigt,
  deleteDeadline,
} from "@/app/deadline/actions";
import {
  todoMitgliederLaden,
  deadlineMitgliederLaden,
  pruefungMitgliederLaden,
} from "@/app/einladung/actions";
import {
  UnteraufgabenEditor,
  type EditorMitglied,
  type UnteraufgabeEingabe,
} from "@/components/unteraufgaben-editor";
import type { Tables } from "@/lib/supabase/types";
import { restzeitGross, absolutesDatum } from "@/lib/countdown";
import { DeadlineTeilen } from "@/components/deadline-teilen";

type Deadline = Tables<"deadline">;
type ParentTyp = "todo" | "deadline" | "pruefung";

const MITGLIEDER_LADEN: Record<ParentTyp, (id: string) => Promise<EditorMitglied[]>> = {
  todo: todoMitgliederLaden,
  deadline: deadlineMitgliederLaden,
  pruefung: pruefungMitgliederLaden,
};

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function Unteraufgaben({
  parentTyp,
  parentId,
  initial,
  userId,
}: {
  parentTyp: ParentTyp;
  parentId: string;
  initial: Deadline[];
  userId?: string;
}) {
  const [aufgaben, setAufgaben] = useState(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [mitglieder, setMitglieder] = useState<EditorMitglied[]>([]);
  const [, startTransition] = useTransition();

  const hatZuweisungen = aufgaben.some((a) => a.zugewiesen_an);

  useEffect(() => {
    if (!formOpen && !hatZuweisungen) return;
    MITGLIEDER_LADEN[parentTyp](parentId)
      .then(setMitglieder)
      .catch(() => setMitglieder([]));
  }, [formOpen, hatZuweisungen, parentTyp, parentId]);

  const sortiert = [...aufgaben].sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
    return new Date(a.faellig_am).getTime() - new Date(b.faellig_am).getTime();
  });

  async function speichern(eintraege: UnteraufgabeEingabe[]) {
    const neu: Deadline[] = [];
    for (const e of eintraege) {
      const erstellt = await createDeadline({
        titel: e.titel,
        fach_id: null,
        faellig_am: new Date(e.faelligAm).toISOString(),
        typ: "ABGABE",
        kategorie: "NORMAL",
        todoId: parentTyp === "todo" ? parentId : undefined,
        pruefungId: parentTyp === "pruefung" ? parentId : undefined,
        parentDeadlineId: parentTyp === "deadline" ? parentId : undefined,
        zugewiesenAn: e.zugewiesenAn || undefined,
      });
      neu.push(...erstellt);
    }
    setAufgaben((prev) => [...prev, ...neu]);
    setFormOpen(false);
  }

  function handleToggle(d: Deadline) {
    const naechsterStatus = !d.erledigt;
    setAufgaben((prev) => prev.map((x) => (x.id === d.id ? { ...x, erledigt: naechsterStatus } : x)));
    startTransition(() => toggleDeadlineErledigt(d.id, naechsterStatus));
  }

  function handleDelete(id: string) {
    setAufgaben((prev) => prev.filter((x) => x.id !== id));
    startTransition(() => deleteDeadline(id));
  }

  function nameVon(id: string | null): string | null {
    if (!id) return null;
    return mitglieder.find((m) => m.user_id === id)?.username ?? null;
  }

  if (aufgaben.length === 0 && !formOpen) {
    return (
      <button type="button" className="unteraufgabe-add" onClick={() => setFormOpen(true)}>
        + Unteraufgabe
      </button>
    );
  }

  return (
    <div className="unteraufgaben">
      {sortiert.map((d) => {
        const name = nameVon(d.zugewiesen_an);
        const zeit = d.erledigt
          ? absolutesDatum(d.faellig_am)
          : `${restzeitGross(d.faellig_am).wert} ${restzeitGross(d.faellig_am).einheit} · ${absolutesDatum(d.faellig_am)}`;
        return (
          <div key={d.id} className={`unteraufgabe-row ${d.erledigt ? "entry-erledigt" : ""}`}>
            <input
              type="checkbox"
              checked={d.erledigt}
              onChange={() => handleToggle(d)}
              aria-label="Erledigt"
            />
            <div className="unteraufgabe-info">
              <span>{d.titel}</span>
              <span className="muted" style={{ fontSize: 11 }}>
                {name ? `→ ${name} · ${zeit}` : zeit}
              </span>
            </div>
            {userId && d.user_id === userId && <DeadlineTeilen deadlineId={d.id} />}
            <button type="button" onClick={() => handleDelete(d.id)} aria-label="Unteraufgabe löschen">
              ✕
            </button>
          </div>
        );
      })}

      {formOpen ? (
        <UnteraufgabenEditor
          mitglieder={mitglieder}
          terminPflicht
          standardTermin={toDatetimeLocal(new Date())}
          onSpeichern={speichern}
          onAbbrechen={() => setFormOpen(false)}
        />
      ) : (
        <button type="button" className="unteraufgabe-add" onClick={() => setFormOpen(true)}>
          + Unteraufgabe
        </button>
      )}
    </div>
  );
}
