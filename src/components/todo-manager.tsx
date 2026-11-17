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
import { Unteraufgaben } from "@/components/unteraufgaben";
import { TodoUnterpunkte } from "@/components/todo-unterpunkte";
import { useAufgabenDetail } from "@/lib/use-aufgaben-detail";
import { Zustand } from "@/components/zustand";
import { ErfassenKnopf } from "@/components/erfassen-knopf";
import { Icon } from "@/components/nav-icon";

type Todo = Tables<"todo">;
type Deadline = Tables<"deadline">;

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
  deadlines = [],
  embedded = false,
  versteckeErstellen = false,
  userId,
}: {
  initialTodos: Todo[];
  faecher: FachOption[];
  deadlines?: Deadline[];
  embedded?: boolean;
  versteckeErstellen?: boolean;
  userId?: string;
}) {
  const { oeffne } = useAufgabenDetail();
  const [todos, setTodos] = useState(initialTodos);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TodoInput>(LEERES_FORMULAR);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortiert = [...todos]
    .filter((t) => !t.parent_id)
    .sort((a, b) => {
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

  const inhalt = (
    <>
      {!versteckeErstellen && (
        <div className="liste-kopf">
          <button type="button" onClick={openCreateForm} className="knopf neben klein">
            <Icon name="plus" groesse={16} />
            To-Do
          </button>
        </div>
      )}

      {sortiert.length === 0 && !formOpen && (
        <Zustand
          art="leer"
          region
          ebene={3}
          titel="Keine To-Dos."
          aktion={
            versteckeErstellen ? (
              <ErfassenKnopf modus="SONSTIGE">To-Do erfassen</ErfassenKnopf>
            ) : (
              <button type="button" className="knopf neben klein" onClick={openCreateForm}>
                <Icon name="plus" groesse={16} />
                To-Do
              </button>
            )
          }
        >
          Aufgaben ohne festen Termin sammeln sich hier, mit Unterpunkten zum Abhaken.
        </Zustand>
      )}

      <ul className="entry-list">
        {sortiert.map((t) => {
          const fach = faecher.find((f) => f.id === t.fach_id);
          return (
            <li
              key={t.id}
              className={`entry-row entry-row-mit-unteraufgaben ${t.erledigt ? "entry-erledigt" : ""}`}
            >
              <div className="entry-row-main">
                <input
                  type="checkbox"
                  checked={t.erledigt}
                  onChange={() => handleToggleErledigt(t)}
                  aria-label="Erledigt"
                />
                <div className="entry-info">
                  <button
                    type="button"
                    className="entry-title entry-title-link"
                    onClick={() => oeffne("todo", t.id)}
                  >
                    {t.titel}
                  </button>
                  <span className="entry-meta">
                    {[`Priorität ${PRIO_LABEL[t.prioritaet].toLowerCase()}`, fach?.name].filter(Boolean).join(", ")}
                  </span>
                </div>
                <div className="entry-actions">
                  <button type="button" className="knopf leise klein" onClick={() => openEditForm(t)}>
                    Bearbeiten
                  </button>
                  <button type="button" className="knopf gefahr klein" onClick={() => handleDelete(t.id)}>
                    Löschen
                  </button>
                </div>
              </div>
              <div className="entry-row-unteraufgaben">
                <TodoUnterpunkte
                  parentId={t.id}
                  fachId={t.fach_id}
                  initial={todos.filter((x) => x.parent_id === t.id)}
                />
                <Unteraufgaben
                  parentTyp="todo"
                  parentId={t.id}
                  initial={deadlines.filter((d) => d.todo_id === t.id)}
                  userId={userId}
                />
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
            <button type="submit" className="knopf haupt" disabled={isPending} aria-busy={isPending}>
              {isPending ? "Speichern…" : "Speichern"}
            </button>
            <button type="button" className="knopf leise" onClick={() => setFormOpen(false)} disabled={isPending}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </>
  );

  if (embedded) return inhalt;

  return (
    <section className="card">
      <div className="ch">
        <span className="ct">To-Dos</span>
      </div>
      {inhalt}
    </section>
  );
}
