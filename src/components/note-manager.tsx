"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import { createNote, updateNote, deleteNote, type NoteInput } from "@/app/note/actions";
import type { Tables } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";

type Note = Tables<"note">;

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

function leeresFormular(ersteFachId: string | null): NoteInput {
  return { titel: "", fach_id: ersteFachId ?? "", wert: 1, gewicht: 1, datum: heute() };
}

export function NoteManager({
  initialNotes,
  faecher,
  notenschnitt,
  embedded = false,
}: {
  initialNotes: Note[];
  faecher: FachOption[];
  notenschnitt: number | null;
  embedded?: boolean;
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
    setFormOpen(true);
  }

  function openEditForm(n: Note) {
    setEditId(n.id);
    setForm({ titel: n.titel, fach_id: n.fach_id, wert: n.wert, gewicht: n.gewicht, datum: n.datum });
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
      <div className="rowb" style={{ marginBottom: 18 }}>
        <div
          style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: 34,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          Ø {notenschnitt != null ? notenschnitt.toFixed(1) : "–"}
        </div>
        <button type="button" onClick={openCreateForm} className="btnp">
          + Note
        </button>
      </div>

      {sortiert.length === 0 && !formOpen && <p className="empty-state">Keine Noten.</p>}

      <ul className="fach-list">
        {sortiert.map((n) => {
          const fach = faecher.find((f) => f.id === n.fach_id);
          return (
            <li key={n.id} className="fach-card">
              <span className="dot" style={{ background: fach?.farbe ?? "#94a3b8" }} aria-hidden />
              <div className="fach-card-info">
                <span className="fach-card-name">{n.titel}</span>
                <span className="fach-card-meta">
                  {[fach?.name, `Gewicht ${n.gewicht}`, n.datum].filter(Boolean).join(" · ")}
                </span>
              </div>
              <span
                style={{ fontWeight: 700, fontFamily: "var(--font-display), sans-serif" }}
              >
                {n.wert.toFixed(1)}
              </span>
              <div className="fach-card-actions">
                <button type="button" onClick={() => openEditForm(n)}>
                  Bearbeiten
                </button>
                <button type="button" onClick={() => handleDelete(n.id)}>
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
          {error && <p className="auth-error">{error}</p>}

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

          <label htmlFor="note-wert">Note (1,0–5,0)</label>
          <input
            id="note-wert"
            type="number"
            step="0.1"
            min="1"
            max="5"
            value={form.wert}
            onChange={(e) => setForm((f) => ({ ...f, wert: Number(e.target.value) }))}
            required
          />

          <label htmlFor="note-gewicht">Gewicht</label>
          <input
            id="note-gewicht"
            type="number"
            step="0.1"
            min="0"
            value={form.gewicht}
            onChange={(e) => setForm((f) => ({ ...f, gewicht: Number(e.target.value) }))}
            required
          />

          <label htmlFor="note-datum">Datum</label>
          <input
            id="note-datum"
            type="date"
            value={form.datum}
            onChange={(e) => setForm((f) => ({ ...f, datum: e.target.value }))}
            required
          />

          <div className="crud-form-actions">
            <button type="submit" className="btnp" disabled={isPending}>
              {isPending ? "Speichern…" : "Speichern"}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} disabled={isPending}>
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
        <span className="ct">Noten</span>
      </div>
      {inhalt}
    </section>
  );
}
