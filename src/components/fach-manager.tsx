"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import posthog from "posthog-js";
import { createFach, updateFach, archiveFach, type FachInput } from "@/app/fach/actions";
import type { Tables } from "@/lib/supabase/types";
import { naechsteFarbe } from "@/lib/fach-farben";
import { Zustand } from "@/components/zustand";
import { Icon } from "@/components/nav-icon";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { FACH_NEU } from "@/components/erfassen-knopf";

type Fach = Tables<"fach">;

function leeresFormular(faecher: Fach[]): FachInput {
  return {
    name: "",
    semester: "",
    farbe: naechsteFarbe(faecher),
    ects: null,
    anwesenheitspflicht: false,
    max_fehltage: null,
  };
}

/** „3“ wird zu „3. Semester“, freie Angaben wie „WiSe 26/27“ bleiben, wie sie sind. */
function semesterText(semester: string | null): string | null {
  if (!semester) return null;
  return /^\d+$/.test(semester.trim()) ? `${semester.trim()}. Semester` : semester;
}

/** Design B3: Fächer als Zeilen mit Trennlinien, Farbe als kleines Quadrat, Fehltage als getönte Pille. */
export function FachManager({ initialFaecher }: { initialFaecher: Fach[] }) {
  const [faecher, setFaecher] = useState(initialFaecher);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FachInput>(leeresFormular(initialFaecher));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreateForm() {
    setEditId(null);
    setForm(leeresFormular(faecher));
    setError(null);
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
    setError(null);
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

  // Der Hauptknopf „Fach“ im Bereichskopf öffnet dieses Formular (Aufgabe 4, B5)
  useEffect(() => {
    const oeffnen = () => openCreateForm();
    window.addEventListener(FACH_NEU, oeffnen);
    return () => window.removeEventListener(FACH_NEU, oeffnen);
  });

  return (
    <div className="faecher-seite" id="faecher">

      {error && !formOpen && (
        <p className="formular-fehler" role="alert">
          {error}
        </p>
      )}

      {faecher.length === 0 && !formOpen && (
        <Zustand
          art="leer"
          icon="faecher"
          titel="Noch keine Fächer."
          aktion={
            <button type="button" className="knopf neben klein" onClick={openCreateForm}>
              <Icon name="plus" groesse={16} />
              Fach hinzufügen
            </button>
          }
        >
          Fächer ordnen Aufgaben, Noten und den Stundenplan. Leg die Fächer dieses Semesters mit Farbe und ECTS an.
        </Zustand>
      )}

      <ul className="entry-list">
        {faecher.map((fach) => {
          const grenze = fach.max_fehltage != null && fach.fehltage_genutzt >= fach.max_fehltage;
          return (
            <li key={fach.id} className="entry-row fach-zeile">
              <span className="fach-farbe" style={{ "--c": fach.farbe ?? "var(--text-3)" } as CSSProperties} aria-hidden />
              <div className="entry-info">
                <span className="entry-title">{fach.name}</span>
                <span className="entry-meta">
                  {[semesterText(fach.semester), fach.ects != null ? `${fach.ects} ECTS` : null]
                    .filter(Boolean)
                    .join(", ") || "Ohne Semester und ECTS"}
                </span>
              </div>
              {fach.anwesenheitspflicht && (
                <span className={`fach-fehltage${grenze ? " fach-fehltage-grenze" : ""}`}>
                  {fach.max_fehltage != null ? (
                    <>
                      <span className="zahl">{fach.fehltage_genutzt}</span> von{" "}
                      <span className="zahl">{fach.max_fehltage}</span> Fehltagen
                    </>
                  ) : (
                    <>
                      <span className="zahl">{fach.fehltage_genutzt}</span>{" "}
                      {fach.fehltage_genutzt === 1 ? "Fehltag" : "Fehltage"}
                    </>
                  )}
                </span>
              )}
              <div className="entry-actions">
                {/* Bearbeiten und Archivieren im Menü (Aufgabe 4, B5) */}
                <DreiPunkteMenue
                  label={`Weitere Aktionen für ${fach.name}`}
                  punkte={[
                    { label: "Bearbeiten", icon: "stift", onClick: () => openEditForm(fach) },
                    { label: "Archivieren", onClick: () => !isPending && void handleArchive(fach.id) },
                  ]}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {formOpen && (
        <form className="crud-form" onSubmit={handleSubmit}>
          <h3>{editId ? "Fach bearbeiten" : "Neues Fach"}</h3>

          {error && (
            <p className="formular-fehler" role="alert">
              {error}
            </p>
          )}

          <label htmlFor="fach-name">Name</label>
          <input
            id="fach-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />

          <div className="crud-form-reihe">
            <div>
              <label htmlFor="fach-semester">Semester</label>
              <input
                id="fach-semester"
                value={form.semester ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value || null }))}
              />
            </div>
            <div>
              <label htmlFor="fach-ects">ECTS</label>
              <input
                id="fach-ects"
                type="number"
                inputMode="decimal"
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
            </div>
            <div>
              <label htmlFor="fach-farbe">Farbe</label>
              <input
                id="fach-farbe"
                type="color"
                value={form.farbe ?? naechsteFarbe(faecher)}
                onChange={(e) => setForm((f) => ({ ...f, farbe: e.target.value }))}
              />
            </div>
          </div>

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
              <label htmlFor="fach-max-fehltage">Höchstens erlaubte Fehltage</label>
              <input
                id="fach-max-fehltage"
                type="number"
                inputMode="numeric"
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

          <div className="crud-form-actions">
            <button type="submit" className="knopf haupt" disabled={isPending} aria-busy={isPending}>
              {isPending ? "Speichern…" : "Speichern"}
            </button>
            <button type="button" className="knopf leise" onClick={closeForm} disabled={isPending}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
