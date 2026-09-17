"use client";

import { useState, useTransition } from "react";
import posthog from "posthog-js";
import {
  createStundenplanEintrag,
  updateStundenplanEintrag,
  deleteStundenplanEintrag,
  type StundenplanInput,
} from "@/app/stundenplan/actions";
import type { Tables, Enums } from "@/lib/supabase/types";
import type { FachOption } from "@/lib/fach-option";

type Eintrag = Tables<"stundenplan_eintrag">;
type Deadline = Tables<"deadline">;
type Pruefung = Tables<"pruefung">;

const TAGE: Enums<"wochentag">[] = ["MO", "DI", "MI", "DO", "FR", "SA", "SO"];
const TAG_LABEL: Record<Enums<"wochentag">, string> = {
  MO: "Mo",
  DI: "Di",
  MI: "Mi",
  DO: "Do",
  FR: "Fr",
  SA: "Sa",
  SO: "So",
};
const JS_TAG_ZU_WOCHENTAG: Record<number, Enums<"wochentag">> = {
  0: "SO",
  1: "MO",
  2: "DI",
  3: "MI",
  4: "DO",
  5: "FR",
  6: "SA",
};

const BASIS_STUNDE = 8;
const END_STUNDE = 18;
const PX_PRO_MINUTE = 0.6;
const RASTER_HOEHE = (END_STUNDE - BASIS_STUNDE) * 60 * PX_PRO_MINUTE;

function minutenSeitBasis(zeit: string): number {
  const [h, m] = zeit.split(":").map(Number);
  return (h - BASIS_STUNDE) * 60 + m;
}

function toTimeInput(zeit: string): string {
  return zeit.slice(0, 5);
}

function montagDieserWoche(datum: Date): Date {
  const wochentag = datum.getDay();
  const diffZuMontag = wochentag === 0 ? -6 : 1 - wochentag;
  const montag = new Date(datum);
  montag.setDate(datum.getDate() + diffZuMontag);
  montag.setHours(0, 0, 0, 0);
  return montag;
}

function positionFuerZeitpunkt(dt: Date): number {
  const minuten = (dt.getHours() - BASIS_STUNDE) * 60 + dt.getMinutes();
  return Math.min(Math.max(minuten * PX_PRO_MINUTE, 0), RASTER_HOEHE - 18);
}

function leeresFormular(ersteFachId: string | null): StundenplanInput {
  return {
    fach_id: ersteFachId ?? "",
    tag: "MO",
    start_zeit: "09:00",
    end_zeit: "10:30",
    raum: null,
    dozent: null,
  };
}

export function StundenplanManager({
  initialEintraege,
  faecher,
  deadlines = [],
  pruefungen = [],
  embedded = false,
}: {
  initialEintraege: Eintrag[];
  faecher: FachOption[];
  deadlines?: Deadline[];
  pruefungen?: Pruefung[];
  embedded?: boolean;
}) {
  const [eintraege, setEintraege] = useState(initialEintraege);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<StundenplanInput>(leeresFormular(faecher[0]?.id ?? null));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [wochenOffset, setWochenOffset] = useState(0);

  function openCreateForm() {
    if (faecher.length === 0) {
      setError("Bitte zuerst ein Fach anlegen.");
      return;
    }
    setEditId(null);
    setForm(leeresFormular(faecher[0].id));
    setFormOpen(true);
  }

  function openEditForm(e: Eintrag) {
    setEditId(e.id);
    setForm({
      fach_id: e.fach_id,
      tag: e.tag,
      start_zeit: toTimeInput(e.start_zeit),
      end_zeit: toTimeInput(e.end_zeit),
      raum: e.raum,
      dozent: e.dozent,
    });
    setFormOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        if (editId) {
          const updated = await updateStundenplanEintrag(editId, form);
          setEintraege((prev) => prev.map((x) => (x.id === editId ? updated : x)));
          posthog.capture("stundenplan_eintrag_bearbeitet", { eintrag_id: editId });
        } else {
          const created = await createStundenplanEintrag(form);
          setEintraege((prev) => [...prev, created]);
          posthog.capture("stundenplan_eintrag_angelegt", { eintrag_id: created.id });
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
        await deleteStundenplanEintrag(id);
        setEintraege((prev) => prev.filter((x) => x.id !== id));
        posthog.capture("stundenplan_eintrag_geloescht", { eintrag_id: id });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  const stunden = Array.from({ length: END_STUNDE - BASIS_STUNDE + 1 }, (_, i) => BASIS_STUNDE + i);

  const montag = montagDieserWoche(new Date());
  montag.setDate(montag.getDate() + wochenOffset * 7);
  const sonntag = new Date(montag);
  sonntag.setDate(montag.getDate() + 6);
  sonntag.setHours(23, 59, 59, 999);
  const wochenLabel = `${montag.toLocaleDateString("de-DE", { day: "2-digit", month: "short" })} – ${sonntag.toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}`;
  const deadlinesDieseWoche = deadlines.filter((d) => {
    const dt = new Date(d.faellig_am);
    return dt >= montag && dt <= sonntag;
  });
  const pruefungenDieseWoche = pruefungen.filter((p) => {
    const dt = new Date(p.datum);
    return dt >= montag && dt <= sonntag;
  });

  const inhalt = (
    <>
      <div className="rowb" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="btng"
            style={{ padding: "5px 9px" }}
            onClick={() => setWochenOffset((o) => o - 1)}
            aria-label="Vorherige Woche"
          >
            ←
          </button>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600, minWidth: 100, textAlign: "center" }}>
            {wochenLabel}
          </span>
          <button
            type="button"
            className="btng"
            style={{ padding: "5px 9px" }}
            onClick={() => setWochenOffset((o) => o + 1)}
            aria-label="Nächste Woche"
          >
            →
          </button>
          {wochenOffset !== 0 && (
            <button type="button" className="btng" style={{ padding: "5px 9px" }} onClick={() => setWochenOffset(0)}>
              Heute
            </button>
          )}
        </div>
        <button type="button" onClick={openCreateForm} className="btnp">
          + Eintrag
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="stundenplan-grid" style={{ height: RASTER_HOEHE + 24 }}>
        <div className="stundenplan-stunden">
          {stunden.map((h) => (
            <div key={h} className="stundenplan-stunde" style={{ height: 60 * PX_PRO_MINUTE }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {TAGE.map((tag) => (
          <div key={tag} className="stundenplan-tag-spalte">
            <div className="stundenplan-tag-label">{TAG_LABEL[tag]}</div>
            <div className="stundenplan-tag-body" style={{ height: RASTER_HOEHE }}>
              {eintraege
                .filter((e) => e.tag === tag)
                .map((e) => {
                  const fach = faecher.find((f) => f.id === e.fach_id);
                  const top = minutenSeitBasis(e.start_zeit) * PX_PRO_MINUTE;
                  const hoehe =
                    (minutenSeitBasis(e.end_zeit) - minutenSeitBasis(e.start_zeit)) *
                    PX_PRO_MINUTE;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className="stundenplan-block"
                      style={{
                        top,
                        height: Math.max(hoehe, 20),
                        backgroundColor: fach?.farbe ?? "#3b82f6",
                      }}
                      onClick={() => openEditForm(e)}
                      title={`${fach?.name ?? ""} ${toTimeInput(e.start_zeit)}–${toTimeInput(e.end_zeit)}`}
                    >
                      <span className="stundenplan-block-fach">{fach?.name}</span>
                      <span className="stundenplan-block-zeit">
                        {toTimeInput(e.start_zeit)}–{toTimeInput(e.end_zeit)}
                      </span>
                    </button>
                  );
                })}

              {deadlinesDieseWoche
                .filter((d) => JS_TAG_ZU_WOCHENTAG[new Date(d.faellig_am).getDay()] === tag)
                .map((d) => (
                  <div
                    key={d.id}
                    className="kalender-marker kalender-marker-deadline"
                    style={{ top: positionFuerZeitpunkt(new Date(d.faellig_am)) }}
                    title={d.titel}
                  >
                    ⚑ {d.titel}
                  </div>
                ))}

              {pruefungenDieseWoche
                .filter((p) => JS_TAG_ZU_WOCHENTAG[new Date(p.datum).getDay()] === tag)
                .map((p) => (
                  <div
                    key={p.id}
                    className="kalender-marker kalender-marker-pruefung"
                    style={{ top: positionFuerZeitpunkt(new Date(p.datum)) }}
                    title={p.titel}
                  >
                    ✎ {p.titel}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {formOpen && (
        <form className="crud-form" onSubmit={handleSubmit}>
          <h3>{editId ? "Eintrag bearbeiten" : "Neuer Eintrag"}</h3>

          <label htmlFor="sp-fach">Fach</label>
          <select
            id="sp-fach"
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

          <label htmlFor="sp-tag">Wochentag</label>
          <select
            id="sp-tag"
            value={form.tag}
            onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value as Enums<"wochentag"> }))}
          >
            {TAGE.map((tag) => (
              <option key={tag} value={tag}>
                {TAG_LABEL[tag]}
              </option>
            ))}
          </select>

          <label htmlFor="sp-start">Start</label>
          <input
            id="sp-start"
            type="time"
            value={form.start_zeit}
            onChange={(e) => setForm((f) => ({ ...f, start_zeit: e.target.value }))}
            required
          />

          <label htmlFor="sp-ende">Ende</label>
          <input
            id="sp-ende"
            type="time"
            value={form.end_zeit}
            onChange={(e) => setForm((f) => ({ ...f, end_zeit: e.target.value }))}
            required
          />

          <label htmlFor="sp-raum">Raum</label>
          <input
            id="sp-raum"
            value={form.raum ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, raum: e.target.value || null }))}
          />

          <label htmlFor="sp-dozent">Dozent</label>
          <input
            id="sp-dozent"
            value={form.dozent ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, dozent: e.target.value || null }))}
          />

          <div className="crud-form-actions">
            <button type="submit" className="btnp" disabled={isPending}>
              {isPending ? "Speichern…" : "Speichern"}
            </button>
            {editId && (
              <button
                type="button"
                onClick={() => handleDelete(editId)}
                disabled={isPending}
              >
                Löschen
              </button>
            )}
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
        <span className="ct">Stundenplan</span>
      </div>
      {inhalt}
    </section>
  );
}
