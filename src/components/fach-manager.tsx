"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import {
  createFach,
  updateFach,
  archiveFach,
  fehltageAendern,
  type FachInput,
} from "@/app/fach/actions";
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

  function handleFehltag(id: string, delta: number) {
    startTransition(async () => {
      try {
        const updated = await fehltageAendern(id, delta);
        setFaecher((prev) => prev.map((f) => (f.id === id ? updated : f)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <section className="card">
      <div className="ch" style={{ marginBottom: 14 }}>
        <span className="ct">Fächer</span>
        <button type="button" onClick={openCreateForm} className="btng" style={{ padding: "5px 11px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Fach
        </button>
      </div>

      {faecher.length === 0 && !formOpen && (
        <p className="empty-state">Noch keine Fächer angelegt.</p>
      )}

      <ul className="fach-list">
        {faecher.map((fach) => (
          <li key={fach.id} className="fach-card">
            <span
              className="dot"
              style={{ background: fach.farbe ?? "#94a3b8" }}
              aria-hidden
            />
            <div className="fach-card-info">
              <span className="fach-card-name">{fach.name}</span>
              <span className="fach-card-meta">
                {[fach.semester, fach.ects != null ? `${fach.ects} ECTS` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {fach.anwesenheitspflicht && (
                <span
                  className={`fach-fehltage ${
                    fach.max_fehltage != null && fach.fehltage_genutzt >= fach.max_fehltage
                      ? "fach-fehltage-warnung"
                      : ""
                  }`}
                >
                  Fehltage: {fach.fehltage_genutzt}
                  {fach.max_fehltage != null ? `/${fach.max_fehltage}` : ""}
                  <button
                    type="button"
                    onClick={() => handleFehltag(fach.id, 1)}
                    aria-label="Fehltag hinzufügen"
                  >
                    +1
                  </button>
                  {fach.fehltage_genutzt > 0 && (
                    <button
                      type="button"
                      onClick={() => handleFehltag(fach.id, -1)}
                      aria-label="Fehltag entfernen"
                    >
                      -1
                    </button>
                  )}
                </span>
              )}
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
            <button type="submit" className="btnp" disabled={isPending}>
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
