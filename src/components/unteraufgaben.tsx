"use client";

import { useState, useTransition } from "react";
import {
  createDeadline,
  toggleDeadlineErledigt,
  deleteDeadline,
} from "@/app/deadline/actions";
import type { Tables } from "@/lib/supabase/types";
import { restzeitGross, absolutesDatum } from "@/lib/countdown";
import { DeadlineTeilen } from "@/components/deadline-teilen";

type Deadline = Tables<"deadline">;

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Unteraufgaben({
  parentTyp,
  parentId,
  initial,
  userId,
}: {
  parentTyp: "todo" | "pruefung";
  parentId: string;
  initial: Deadline[];
  userId?: string;
}) {
  const [aufgaben, setAufgaben] = useState(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [titel, setTitel] = useState("");
  const [faelligAm, setFaelligAm] = useState(toDatetimeLocal(new Date().toISOString()));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortiert = [...aufgaben].sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
    return new Date(a.faellig_am).getTime() - new Date(b.faellig_am).getTime();
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const created = await createDeadline({
          titel,
          fach_id: null,
          faellig_am: new Date(faelligAm).toISOString(),
          typ: "ABGABE",
          kategorie: "NORMAL",
          todoId: parentTyp === "todo" ? parentId : undefined,
          pruefungId: parentTyp === "pruefung" ? parentId : undefined,
        });
        setAufgaben((prev) => [...prev, ...created]);
        setTitel("");
        setFaelligAm(toDatetimeLocal(new Date().toISOString()));
        setFormOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
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

  if (aufgaben.length === 0 && !formOpen) {
    return (
      <button type="button" className="unteraufgabe-add" onClick={() => setFormOpen(true)}>
        + Unteraufgabe
      </button>
    );
  }

  return (
    <div className="unteraufgaben">
      {sortiert.map((d) => (
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
              {d.erledigt ? absolutesDatum(d.faellig_am) : `${restzeitGross(d.faellig_am).wert} ${restzeitGross(d.faellig_am).einheit} · ${absolutesDatum(d.faellig_am)}`}
            </span>
          </div>
          {userId && d.user_id === userId && <DeadlineTeilen deadlineId={d.id} />}
          <button type="button" onClick={() => handleDelete(d.id)} aria-label="Unteraufgabe löschen">
            ✕
          </button>
        </div>
      ))}

      {formOpen ? (
        <form className="unteraufgabe-form" onSubmit={handleSubmit}>
          {error && <p className="auth-error" style={{ fontSize: 12 }}>{error}</p>}
          <input
            type="text"
            placeholder="Titel der Unteraufgabe"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            required
          />
          <input
            type="datetime-local"
            value={faelligAm}
            onChange={(e) => setFaelligAm(e.target.value)}
            required
          />
          <div className="row" style={{ gap: 6 }}>
            <button type="submit" className="btnp" disabled={isPending} style={{ padding: "4px 12px", fontSize: 12 }}>
              Anlegen
            </button>
            <button type="button" onClick={() => setFormOpen(false)} style={{ padding: "4px 12px", fontSize: 12 }}>
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="unteraufgabe-add" onClick={() => setFormOpen(true)}>
          + Unteraufgabe
        </button>
      )}
    </div>
  );
}
