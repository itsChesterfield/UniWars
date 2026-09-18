"use client";

import { useState, useTransition } from "react";
import { createTodo, toggleTodoErledigt, deleteTodo } from "@/app/todo/actions";
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
  const [titel, setTitel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortiert = [...unterpunkte].sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
    return new Date(a.erstellt_am).getTime() - new Date(b.erstellt_am).getTime();
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const created = await createTodo({
          titel,
          fach_id: fachId,
          prioritaet: "MITTEL",
          parentId,
        });
        setUnterpunkte((prev) => [...prev, created]);
        setTitel("");
        setFormOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleToggle(t: Todo) {
    const naechsterStatus = !t.erledigt;
    setUnterpunkte((prev) => prev.map((x) => (x.id === t.id ? { ...x, erledigt: naechsterStatus } : x)));
    startTransition(() => toggleTodoErledigt(t.id, naechsterStatus));
  }

  function handleDelete(id: string) {
    setUnterpunkte((prev) => prev.filter((x) => x.id !== id));
    startTransition(() => deleteTodo(id));
  }

  if (unterpunkte.length === 0 && !formOpen) {
    return (
      <button type="button" className="unteraufgabe-add" onClick={() => setFormOpen(true)}>
        + Unterpunkt
      </button>
    );
  }

  return (
    <div className="unteraufgaben">
      {sortiert.map((t) => (
        <div key={t.id} className={`unteraufgabe-row ${t.erledigt ? "entry-erledigt" : ""}`}>
          <input
            type="checkbox"
            checked={t.erledigt}
            onChange={() => handleToggle(t)}
            aria-label="Erledigt"
          />
          <div className="unteraufgabe-info">
            <span>{t.titel}</span>
          </div>
          <button type="button" onClick={() => handleDelete(t.id)} aria-label="Unterpunkt löschen">
            ✕
          </button>
        </div>
      ))}

      {formOpen ? (
        <form className="unteraufgabe-form" onSubmit={handleSubmit}>
          {error && <p className="auth-error" style={{ fontSize: 12 }}>{error}</p>}
          <input
            type="text"
            placeholder="Titel des Unterpunkts"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
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
          + Unterpunkt
        </button>
      )}
    </div>
  );
}
