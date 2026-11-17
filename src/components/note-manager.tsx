"use client";

import { useState, useTransition, type CSSProperties } from "react";
import posthog from "posthog-js";
import { createNote, updateNote, deleteNote, type NoteInput } from "@/app/note/actions";
import type { Tables } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";
import { Zustand } from "@/components/zustand";
import { ErfassenKnopf } from "@/components/erfassen-knopf";
import { Icon } from "@/components/nav-icon";
import { notenText } from "@/lib/noten";

type Note = Tables<"note">;

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

function leeresFormular(ersteFachId: string | null): NoteInput {
  return { titel: "", fach_id: ersteFachId ?? "", wert: 1, gewicht: 1, datum: heute() };
}

function datumText(datum: string): string {
  return new Date(`${datum}T12:00:00`).toLocaleDateString("de-DE", { dateStyle: "medium" });
}

/** Design B3: Noten als Zeilen wie die Aufgaben, Note rechts in Mono. Neu erfassen über „Schnell erfassen“. */
export function NoteManager({
  initialNotes,
  faecher,
  embedded = false,
  versteckeErstellen = false,
}: {
  initialNotes: Note[];
  faecher: FachOption[];
  embedded?: boolean;
  versteckeErstellen?: boolean;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<NoteInput>(leeresFormular(faecher[0]?.id ?? null));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortiert = [...notes].sort(
    (a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime(),
  );

  function openCreateForm() {
    if (faecher.length === 0) {
      setError("Bitte zuerst ein Fach anlegen.");
      return;
    }
    setEditId(null);
    setForm(leeresFormular(faecher[0].id));
    setError(null);
    setFormOpen(true);
  }

  function openEditForm(n: Note) {
    setEditId(n.id);
    setForm({ titel: n.titel, fach_id: n.fach_id, wert: n.wert, gewicht: n.gewicht, datum: n.datum });
    setError(null);
    setFormOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (editId) {
          const updated = await updateNote(editId, form);
          setNotes((prev) => prev.map((n) => (n.id === editId ? updated : n)));
          posthog.capture("note_bearbeitet", { note_id: editId });
        } else {
          const created = await createNote(form);
          setNotes((prev) => [...prev, created]);
          posthog.capture("note_angelegt", { note_id: created.id });
        }
        setFormOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteNote(id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        posthog.capture("note_geloescht", { note_id: id });
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
            Note
          </button>
        </div>
      )}

      {error && !formOpen && (
        <p className="formular-fehler" role="alert">
          {error}
        </p>
      )}

      {sortiert.length === 0 && !formOpen && (
        <Zustand
          art="leer"
          region
          ebene={3}
          titel="Keine Noten in diesem Fach."
          aktion={
            versteckeErstellen ? (
              <ErfassenKnopf modus="NOTE">Note erfassen</ErfassenKnopf>
            ) : (
              <button type="button" className="knopf neben klein" onClick={openCreateForm}>
                <Icon name="plus" groesse={16} />
                Note
              </button>
            )
          }
        >
          Sobald du hier eine Note einträgst, zählt sie für den Schnitt des Fachs.
        </Zustand>
      )}

      <ul className="entry-list">
        {sortiert.map((n) => {
          const fach = faecher.find((f) => f.id === n.fach_id);
          return (
            <li key={n.id} className="entry-row fach-zeile">
              <span className="fach-farbe" style={{ "--c": fach?.farbe ?? "var(--text-3)" } as CSSProperties} aria-hidden />
              <div className="entry-info">
                <span className="entry-title">{n.titel}</span>
                <span className="entry-meta">
                  {[fach?.name, `Gewicht ${n.gewicht.toLocaleString("de-DE")}`, datumText(n.datum)].filter(Boolean).join(", ")}
                </span>
              </div>
              <span className="note-wert zahl">
                {notenText(n.wert)}
              </span>
              <div className="entry-actions">
                <button type="button" className="knopf leise klein" onClick={() => openEditForm(n)}>
                  Bearbeiten
                </button>
                <button
                  type="button"
                  className="knopf gefahr klein"
                  onClick={() => handleDelete(n.id)}
                  disabled={isPending}
                >
                  Löschen
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {formOpen && (
        <form className="crud-form" onSubmit={handleSubmit}>
          <h3>{editId ? "Note bearbeiten" : "Neue Note"}</h3>
          {error && (
            <p className="formular-fehler" role="alert">
              {error}
            </p>
          )}

          <label htmlFor="note-titel">Titel</label>
          <input
            id="note-titel"
            value={form.titel}
            onChange={(e) => setForm((f) => ({ ...f, titel: e.target.value }))}
            required
          />

          <label htmlFor="note-fach">Fach</label>
          <select
            id="note-fach"
            value={form.fach_id}
            onChange={(e) => setForm((f) => ({ ...f, fach_id: e.target.value }))}
            required
          >
            {faecher.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <div className="crud-form-reihe">
            <div>
              <label htmlFor="note-wert">Note (1,0 bis 5,0)</label>
              <input
                id="note-wert"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                max="5"
                value={form.wert}
                onChange={(e) => setForm((f) => ({ ...f, wert: Number(e.target.value) }))}
                required
              />
            </div>
            <div>
              <label htmlFor="note-gewicht">Gewicht</label>
              <input
                id="note-gewicht"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={form.gewicht}
                onChange={(e) => setForm((f) => ({ ...f, gewicht: Number(e.target.value) }))}
                required
              />
            </div>
            <div>
              <label htmlFor="note-datum">Datum</label>
              <input
                id="note-datum"
                type="date"
                value={form.datum}
                onChange={(e) => setForm((f) => ({ ...f, datum: e.target.value }))}
                required
              />
            </div>
          </div>

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
    <section aria-labelledby="abschnitt-noten-liste">
      <h2 id="abschnitt-noten-liste" className="abschnitt-titel">
        Noten
      </h2>
      {inhalt}
    </section>
  );
}
