"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import {
  createTodo,
  updateTodo,
  toggleTodoErledigt,
  deleteTodo,
  type TodoInput,
} from "@/app/todo/actions";
import type { Tables, Enums } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";

type Todo = Tables<"todo">;

const PRIO_LABEL: Record<Enums<"prioritaet">, string> = {
  HOCH: "Hoch",
  MITTEL: "Mittel",
  NIEDRIG: "Niedrig",
};

const PRIO_ORDER: Record<Enums<"prioritaet">, number> = { HOCH: 0, MITTEL: 1, NIEDRIG: 2 };

const LEERES_FORMULAR: TodoInput = { titel: "", fach_id: null, prioritaet: "MITTEL" };

export function TodoManager({
  initialTodos,
  faecher,
}: {
  initialTodos: Todo[];
  faecher: FachOption[];
}) {
  const [todos, setTodos] = useState(initialTodos);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TodoInput>(LEERES_FORMULAR);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortiert = [...todos].sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
    if (a.prioritaet !== b.prioritaet) return PRIO_ORDER[a.prioritaet] - PRIO_ORDER[b.prioritaet];
    return new Date(a.erstellt_am).getTime() - new Date(b.erstellt_am).getTime();
  });

  function openCreateForm() {
    setEditId(null);
    setForm(LEERES_FORMULAR);
    setFormOpen(true);
  }

  function openEditForm(t: Todo) {
    setEditId(t.id);
    setForm({ titel: t.titel, fach_id: t.fach_id, prioritaet: t.prioritaet });
    setFormOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (editId) {
          const updated = await updateTodo(editId, form);
          setTodos((prev) => prev.map((t) => (t.id === editId ? updated : t)));
          posthog.capture("todo_bearbeitet", { todo_id: editId });
        } else {
          const created = await createTodo(form);
          setTodos((prev) => [...prev, created]);
          posthog.capture("todo_angelegt", { todo_id: created.id });
        }
        setFormOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleToggleErledigt(t: Todo) {
    const naechsterStatus = !t.erledigt;
    startTransition(async () => {
      try {
        await toggleTodoErledigt(t.id, naechsterStatus);
        setTodos((prev) =>
          prev.map((x) => (x.id === t.id ? { ...x, erledigt: naechsterStatus } : x)),
        );
        if (naechsterStatus) posthog.capture("todo_erledigt", { todo_id: t.id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteTodo(id);
        setTodos((prev) => prev.filter((t) => t.id !== id));
        posthog.capture("todo_geloescht", { todo_id: id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <section className="crud-section">
      <header className="crud-section-header">
        <h2>To-Dos</h2>
        <button type="button" onClick={openCreateForm} className="btn-primary">
          + To-Do
        </button>
      </header>

      {sortiert.length === 0 && !formOpen && <p className="empty-state">Keine To-Dos.</p>}

      <ul className="entry-list">
        {sortiert.map((t) => {
          const fach = faecher.find((f) => f.id === t.fach_id);
          return (
            <li key={t.id} className={`entry-row ${t.erledigt ? "entry-erledigt" : ""}`}>
              <input
                type="checkbox"
                checked={t.erledigt}
                onChange={() => handleToggleErledigt(t)}
                aria-label="Erledigt"
              />
              <span className={`prio-marke prio-${t.prioritaet.toLowerCase()}`} aria-hidden />
              <div className="entry-info">
                <span className="entry-title">{t.titel}</span>
                <span className="entry-meta">
                  {[PRIO_LABEL[t.prioritaet], fach?.name].filter(Boolean).join(" · ")}
                </span>
              </div>
              <div className="entry-actions">
                <button type="button" onClick={() => openEditForm(t)}>
                  Bearbeiten
                </button>
                <button type="button" onClick={() => handleDelete(t.id)}>
                  Löschen
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {formOpen && (
        <form className="crud-form" onSubmit={handleSubmit}>
          <h3>{editId ? "To-Do bearbeiten" : "Neues To-Do"}</h3>
          {error && <p className="auth-error">{error}</p>}

          <label htmlFor="todo-titel">Titel</label>
          <input
            id="todo-titel"
            value={form.titel}
            onChange={(e) => setForm((f) => ({ ...f, titel: e.target.value }))}
            required
          />

          <label htmlFor="todo-fach">Fach</label>
          <select
            id="todo-fach"
            value={form.fach_id ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, fach_id: e.target.value || null }))}
          >
            <option value="">Kein Fach</option>
            {faecher.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <label htmlFor="todo-prioritaet">Priorität</label>
          <select
            id="todo-prioritaet"
            value={form.prioritaet}
            onChange={(e) =>
              setForm((f) => ({ ...f, prioritaet: e.target.value as Enums<"prioritaet"> }))
            }
          >
            {Object.entries(PRIO_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <div className="crud-form-actions">
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? "Speichern…" : "Speichern"}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} disabled={isPending}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
