"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import {
  createPruefung,
  updatePruefung,
  deletePruefung,
  type PruefungInput,
} from "@/app/pruefung/actions";
import type { Tables, Enums } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";

type Pruefung = Tables<"pruefung">;

const STATUS_LABEL: Record<Enums<"pruefung_status">, string> = {
  ANSTEHEND: "Anstehend",
  BESTANDEN: "Bestanden",
  NICHT_BESTANDEN: "Nicht bestanden",
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function leeresFormular(ersteFachId: string | null): PruefungInput {
  return {
    titel: "",
    fach_id: ersteFachId ?? "",
    datum: toDatetimeLocal(new Date().toISOString()),
    raum: null,
    status: "ANSTEHEND",
  };
}

export function PruefungManager({
  initialPruefungen,
  faecher,
}: {
  initialPruefungen: Pruefung[];
  faecher: FachOption[];
}) {
  const [pruefungen, setPruefungen] = useState(initialPruefungen);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PruefungInput>(leeresFormular(faecher[0]?.id ?? null));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortiert = [...pruefungen].sort(
    (a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime(),
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

  function openEditForm(p: Pruefung) {
    setEditId(p.id);
    setForm({
      titel: p.titel,
      fach_id: p.fach_id,
      datum: toDatetimeLocal(p.datum),
      raum: p.raum,
      status: p.status,
    });
    setFormOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: PruefungInput = { ...form, datum: new Date(form.datum).toISOString() };

    startTransition(async () => {
      try {
        if (editId) {
          const updated = await updatePruefung(editId, payload);
          setPruefungen((prev) => prev.map((p) => (p.id === editId ? updated : p)));
          posthog.capture("pruefung_bearbeitet", { pruefung_id: editId });
        } else {
          const created = await createPruefung(payload);
          setPruefungen((prev) => [...prev, created]);
          posthog.capture("pruefung_angelegt", { pruefung_id: created.id });
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
        await deletePruefung(id);
        setPruefungen((prev) => prev.filter((p) => p.id !== id));
        posthog.capture("pruefung_geloescht", { pruefung_id: id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <section className="crud-section">
      <header className="crud-section-header">
        <h2>Prüfungen</h2>
        <button type="button" onClick={openCreateForm} className="btn-primary">
          + Prüfung
        </button>
      </header>

      {sortiert.length === 0 && !formOpen && <p className="empty-state">Keine Prüfungen.</p>}

      <ul className="entry-list">
        {sortiert.map((p) => {
          const fach = faecher.find((f) => f.id === p.fach_id);
          return (
            <li key={p.id} className="entry-row">
              <span className={`status-marke status-${p.status.toLowerCase()}`} aria-hidden />
              <div className="entry-info">
                <span className="entry-title">{p.titel}</span>
                <span className="entry-meta">
                  {[
                    fach?.name,
                    new Date(p.datum).toLocaleString("de-DE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                    p.raum,
                    STATUS_LABEL[p.status],
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <div className="entry-actions">
                <button type="button" onClick={() => openEditForm(p)}>
                  Bearbeiten
                </button>
                <button type="button" onClick={() => handleDelete(p.id)}>
                  Löschen
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {formOpen && (
        <form className="crud-form" onSubmit={handleSubmit}>
          <h3>{editId ? "Prüfung bearbeiten" : "Neue Prüfung"}</h3>
          {error && <p className="auth-error">{error}</p>}

          <label htmlFor="pruefung-titel">Titel</label>
          <input
            id="pruefung-titel"
            value={form.titel}
            onChange={(e) => setForm((f) => ({ ...f, titel: e.target.value }))}
            required
          />

          <label htmlFor="pruefung-fach">Fach</label>
          <select
            id="pruefung-fach"
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

          <label htmlFor="pruefung-datum">Datum</label>
          <input
            id="pruefung-datum"
            type="datetime-local"
            value={form.datum}
            onChange={(e) => setForm((f) => ({ ...f, datum: e.target.value }))}
            required
          />

          <label htmlFor="pruefung-raum">Raum</label>
          <input
            id="pruefung-raum"
            value={form.raum ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, raum: e.target.value || null }))}
          />

          <label htmlFor="pruefung-status">Status</label>
          <select
            id="pruefung-status"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as Enums<"pruefung_status"> }))
            }
          >
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
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
