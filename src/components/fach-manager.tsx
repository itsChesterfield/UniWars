"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import { createFach, updateFach, archiveFach, type FachInput } from "@/app/fach/actions";
import type { Tables } from "@/lib/supabase/types";

type Fach = Tables<"fach">;

const LEERES_FORMULAR: FachInput = {
  name: "",
  semester: "",
  farbe: "#3B82F6",
  ects: null,
  anwesenheitspflicht: false,
  max_fehltage: null,
};

export function FachManager({ initialFaecher }: { initialFaecher: Fach[] }) {
  const [faecher, setFaecher] = useState(initialFaecher);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FachInput>(LEERES_FORMULAR);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreateForm() {
    setEditId(null);
    setForm(LEERES_FORMULAR);
    setFormOpen(true);
  }

  function openEditForm(fach: Fach) {
    setEditId(fach.id);
    setForm({
      name: fach.name,
      semester: fach.semester,
      farbe: fach.farbe,
      ects: fach.ects,
      anwesenheitspflicht: fach.anwesenheitspflicht,
      max_fehltage: fach.max_fehltage,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (editId) {
          const updated = await updateFach(editId, form);
          setFaecher((prev) => prev.map((f) => (f.id === editId ? updated : f)));
          posthog.capture("fach_bearbeitet", { fach_id: editId });
        } else {
          const created = await createFach(form);
          setFaecher((prev) => [...prev, created]);
          posthog.capture("fach_angelegt", { fach_id: created.id });
        }
        setFormOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      try {
        await archiveFach(id);
        setFaecher((prev) => prev.filter((f) => f.id !== id));
        posthog.capture("fach_archiviert", { fach_id: id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <section className="fach-section">
      <header className="fach-section-header">
        <h2>Fächer</h2>
        <button type="button" onClick={openCreateForm} className="btn-primary">
          + Fach
        </button>
      </header>

      {faecher.length === 0 && !formOpen && (
        <p className="empty-state">Noch keine Fächer angelegt.</p>
      )}

      <ul className="fach-list">
        {faecher.map((fach) => (
          <li key={fach.id} className="fach-card">
            <span
              className="fach-farbpunkt"
              style={{ backgroundColor: fach.farbe ?? "#94a3b8" }}
              aria-hidden
            />
            <div className="fach-card-info">
              <span className="fach-card-name">{fach.name}</span>
              <span className="fach-card-meta">
                {[fach.semester, fach.ects != null ? `${fach.ects} ECTS` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <div className="fach-card-actions">
              <button type="button" onClick={() => openEditForm(fach)}>
                Bearbeiten
              </button>
              <button type="button" onClick={() => handleArchive(fach.id)}>
                Archivieren
              </button>
            </div>
          </li>
        ))}
      </ul>

      {formOpen && (
        <form className="fach-form" onSubmit={handleSubmit}>
          <h3>{editId ? "Fach bearbeiten" : "Neues Fach"}</h3>

          {error && <p className="auth-error">{error}</p>}

          <label htmlFor="fach-name">Name</label>
          <input
            id="fach-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />

          <label htmlFor="fach-semester">Semester</label>
          <input
            id="fach-semester"
            value={form.semester ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value || null }))}
          />

          <label htmlFor="fach-farbe">Farbe</label>
          <input
            id="fach-farbe"
            type="color"
            value={form.farbe ?? "#3B82F6"}
            onChange={(e) => setForm((f) => ({ ...f, farbe: e.target.value }))}
          />

          <label htmlFor="fach-ects">ECTS</label>
          <input
            id="fach-ects"
            type="number"
            step="0.5"
            min="0"
            value={form.ects ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                ects: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
          />

          <label className="fach-checkbox">
            <input
              type="checkbox"
              checked={form.anwesenheitspflicht}
              onChange={(e) =>
                setForm((f) => ({ ...f, anwesenheitspflicht: e.target.checked }))
              }
            />
            Anwesenheitspflicht
          </label>

          {form.anwesenheitspflicht && (
            <>
              <label htmlFor="fach-max-fehltage">Max. Fehltage</label>
              <input
                id="fach-max-fehltage"
                type="number"
                min="0"
                value={form.max_fehltage ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    max_fehltage: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </>
          )}

          <div className="fach-form-actions">
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? "Speichern…" : "Speichern"}
            </button>
            <button type="button" onClick={closeForm} disabled={isPending}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
