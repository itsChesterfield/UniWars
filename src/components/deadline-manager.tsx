"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import {
  createDeadline,
  updateDeadline,
  toggleDeadlineErledigt,
  deleteDeadline,
  type DeadlineInput,
} from "@/app/deadline/actions";
import type { Tables, Enums } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";

type Deadline = Tables<"deadline">;

const TYP_LABEL: Record<Enums<"deadline_typ">, string> = {
  ABGABE: "Abgabe",
  FRIST: "Frist",
  SONSTIGE: "Sonstige",
};

const KATEGORIE_LABEL: Record<Enums<"deadline_kategorie">, string> = {
  NORMAL: "Normal",
  BAFOEG: "BAföG",
  SEMESTERBEITRAG: "Semesterbeitrag",
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function restMillisekunden(iso: string): number {
  return new Date(iso).getTime() - Date.now();
}

function restzeit(iso: string): string {
  const diffMs = restMillisekunden(iso);
  const stunden = diffMs / 1000 / 60 / 60;
  if (diffMs < 0) return "überfällig";
  if (stunden < 48) return `in ${Math.round(stunden)} h`;
  return `in ${Math.round(stunden / 24)} Tagen`;
}

function istDringend(deadline: Deadline): boolean {
  return !deadline.erledigt && restMillisekunden(deadline.faellig_am) < 48 * 60 * 60 * 1000;
}

const LEERES_FORMULAR: DeadlineInput = {
  titel: "",
  fach_id: null,
  faellig_am: toDatetimeLocal(new Date().toISOString()),
  typ: "SONSTIGE",
  kategorie: "NORMAL",
};

export function DeadlineManager({
  initialDeadlines,
  faecher,
}: {
  initialDeadlines: Deadline[];
  faecher: FachOption[];
}) {
  const [deadlines, setDeadlines] = useState(initialDeadlines);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DeadlineInput>(LEERES_FORMULAR);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortiert = [...deadlines].sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
    return new Date(a.faellig_am).getTime() - new Date(b.faellig_am).getTime();
  });

  function openCreateForm() {
    setEditId(null);
    setForm(LEERES_FORMULAR);
    setFormOpen(true);
  }

  function openEditForm(d: Deadline) {
    setEditId(d.id);
    setForm({
      titel: d.titel,
      fach_id: d.fach_id,
      faellig_am: toDatetimeLocal(d.faellig_am),
      typ: d.typ,
      kategorie: d.kategorie,
    });
    setFormOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: DeadlineInput = {
      ...form,
      faellig_am: new Date(form.faellig_am).toISOString(),
    };

    startTransition(async () => {
      try {
        if (editId) {
          const updated = await updateDeadline(editId, payload);
          setDeadlines((prev) => prev.map((d) => (d.id === editId ? updated : d)));
          posthog.capture("deadline_bearbeitet", { deadline_id: editId });
        } else {
          const created = await createDeadline(payload);
          setDeadlines((prev) => [...prev, created]);
          posthog.capture("deadline_angelegt", { deadline_id: created.id });
        }
        setFormOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleToggleErledigt(d: Deadline) {
    const naechsterStatus = !d.erledigt;
    startTransition(async () => {
      try {
        await toggleDeadlineErledigt(d.id, naechsterStatus);
        setDeadlines((prev) =>
          prev.map((x) => (x.id === d.id ? { ...x, erledigt: naechsterStatus } : x)),
        );
        if (naechsterStatus) posthog.capture("deadline_erledigt", { deadline_id: d.id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteDeadline(id);
        setDeadlines((prev) => prev.filter((d) => d.id !== id));
        posthog.capture("deadline_geloescht", { deadline_id: id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <section className="crud-section">
      <header className="crud-section-header">
        <h2>Deadlines</h2>
        <button type="button" onClick={openCreateForm} className="btn-primary">
          + Deadline
        </button>
      </header>

      {sortiert.length === 0 && !formOpen && <p className="empty-state">Keine Deadlines.</p>}

      <ul className="entry-list">
        {sortiert.map((d) => {
          const dringend = istDringend(d);
          const fach = faecher.find((f) => f.id === d.fach_id);
          return (
            <li
              key={d.id}
              className={`entry-row ${d.erledigt ? "entry-erledigt" : ""} ${dringend ? "entry-dringend" : ""}`}
            >
              <input
                type="checkbox"
                checked={d.erledigt}
                onChange={() => handleToggleErledigt(d)}
                aria-label="Erledigt"
              />
              <div className="entry-info">
                <span className="entry-title">{d.titel}</span>
                <span className="entry-meta">
                  {[
                    fach?.name,
                    TYP_LABEL[d.typ],
                    d.kategorie !== "NORMAL" ? KATEGORIE_LABEL[d.kategorie] : null,
                    d.erledigt ? "erledigt" : restzeit(d.faellig_am),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <div className="entry-actions">
                <button type="button" onClick={() => openEditForm(d)}>
                  Bearbeiten
                </button>
                <button type="button" onClick={() => handleDelete(d.id)}>
                  Löschen
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {formOpen && (
        <form className="crud-form" onSubmit={handleSubmit}>
          <h3>{editId ? "Deadline bearbeiten" : "Neue Deadline"}</h3>
          {error && <p className="auth-error">{error}</p>}

          <label htmlFor="deadline-titel">Titel</label>
          <input
            id="deadline-titel"
            value={form.titel}
            onChange={(e) => setForm((f) => ({ ...f, titel: e.target.value }))}
            required
          />

          <label htmlFor="deadline-fach">Fach</label>
          <select
            id="deadline-fach"
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

          <label htmlFor="deadline-faellig">Fällig am</label>
          <input
            id="deadline-faellig"
            type="datetime-local"
            value={form.faellig_am}
            onChange={(e) => setForm((f) => ({ ...f, faellig_am: e.target.value }))}
            required
          />

          <label htmlFor="deadline-typ">Typ</label>
          <select
            id="deadline-typ"
            value={form.typ}
            onChange={(e) =>
              setForm((f) => ({ ...f, typ: e.target.value as Enums<"deadline_typ"> }))
            }
          >
            {Object.entries(TYP_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label htmlFor="deadline-kategorie">Kategorie</label>
          <select
            id="deadline-kategorie"
            value={form.kategorie}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                kategorie: e.target.value as Enums<"deadline_kategorie">,
              }))
            }
          >
            {Object.entries(KATEGORIE_LABEL).map(([value, label]) => (
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
