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
import { restMillisekunden, restzeitGross, absolutesDatum } from "@/lib/countdown";
import { DeadlineTeilen } from "@/components/deadline-teilen";
import { DreiPunkteMenue, type MenuePunkt } from "@/components/hubs/drei-punkte-menue";
import { Unteraufgaben } from "@/components/unteraufgaben";
import { useAufgabenDetail } from "@/lib/use-aufgaben-detail";
import { Zustand } from "@/components/zustand";
import { ErfassenKnopf } from "@/components/erfassen-knopf";
import { Icon } from "@/components/nav-icon";
import { useFesteFolge } from "@/components/bewegung/feste-folge";

type Deadline = Tables<"deadline">;

const TYP_LABEL: Record<Enums<"deadline_typ">, string> = {
  ABGABE: "Abgabe",
  FRIST: "Frist",
  SONSTIGE: "Sonstige",
  TERMIN: "Termin",
  GRUPPENARBEIT: "Gruppenarbeit",
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

function istDringend(deadline: Deadline): boolean {
  return !deadline.erledigt && restMillisekunden(deadline.faellig_am) < 48 * 60 * 60 * 1000;
}

const LEERES_FORMULAR: DeadlineInput = {
  titel: "",
  fach_id: null,
  faellig_am: toDatetimeLocal(new Date().toISOString()),
  typ: "SONSTIGE",
  kategorie: "NORMAL",
  wiederholenBisDatum: null,
};

export function DeadlineManager({
  initialDeadlines,
  faecher,
  embedded = false,
  versteckeErstellen = false,
  userId,
  kopf,
}: {
  initialDeadlines: Deadline[];
  faecher: FachOption[];
  embedded?: boolean;
  versteckeErstellen?: boolean;
  userId?: string;
  /** Abschnittskopf mit der Zahl offener Deadlines (rollt beim Abhaken) */
  kopf?: (offen: number | null) => React.ReactNode;
}) {
  const { oeffne } = useAufgabenDetail();

  // Unteraufgaben werden unter ihrem Todo/ihrer Prüfung angezeigt – außer man ist
  // nur als eingeladenes Mitglied dabei und sieht das übergeordnete Todo gar nicht.
  const [deadlines, setDeadlines] = useState(
    initialDeadlines.filter(
      (d) => (!d.todo_id && !d.pruefung_id && !d.parent_deadline_id) || d.user_id !== userId,
    ),
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<DeadlineInput>(LEERES_FORMULAR);
  const [error, setError] = useState<string | null>(null);
  const [teilenId, setTeilenId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortiert = [...deadlines].sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
    return new Date(a.faellig_am).getTime() - new Date(b.faellig_am).getTime();
  });
  const { folge, listeProps } = useFesteFolge(sortiert);
  const offen = sortiert.filter((d) => !d.erledigt).length;

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
          setDeadlines((prev) => [...prev, ...created]);
          posthog.capture("deadline_angelegt", {
            anzahl: created.length,
            wiederkehrend: Boolean(payload.wiederholenBisDatum),
          });
        }
        setFormOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleToggleErledigt(d: Deadline) {
    const naechsterStatus = !d.erledigt;
    // Sofort abhaken (Bewegung: Kästchen füllt sich, Zeile tritt zurück); bei Fehler zurücknehmen
    const setzen = (erledigt: boolean) => setDeadlines((prev) => prev.map((x) => (x.id === d.id ? { ...x, erledigt } : x)));
    setzen(naechsterStatus);
    startTransition(async () => {
      try {
        await toggleDeadlineErledigt(d.id, naechsterStatus);
        if (naechsterStatus) posthog.capture("deadline_erledigt", { deadline_id: d.id });
      } catch (err) {
        setzen(d.erledigt);
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

  const inhalt = (
    <>
      {kopf?.(sortiert.length ? offen : null)}
      {!versteckeErstellen && (
        <div className="liste-kopf">
          <button type="button" onClick={openCreateForm} className="knopf neben klein">
            <Icon name="plus" groesse={16} />
            Deadline
          </button>
        </div>
      )}

      {sortiert.length === 0 && !formOpen && (
        <Zustand
          art="leer"
          region
          ebene={3}
          titel="Keine Deadlines."
          aktion={
            versteckeErstellen ? (
              <ErfassenKnopf modus="ABGABE">Deadline erfassen</ErfassenKnopf>
            ) : (
              <button type="button" className="knopf neben klein" onClick={openCreateForm}>
                <Icon name="plus" groesse={16} />
                Deadline
              </button>
            )
          }
        >
          Abgaben, Fristen und Termine mit Datum stehen hier, die nächste zuerst.
        </Zustand>
      )}

      <ul className="entry-list" {...listeProps}>
        {folge.map((d) => {
          const dringend = istDringend(d);
          const fach = faecher.find((f) => f.id === d.fach_id);
          return (
            <li
              key={d.id}
              className={`entry-row entry-row-mit-unteraufgaben ${d.erledigt ? "entry-erledigt" : ""} ${dringend ? "entry-dringend" : ""}`}
            >
              <div className="entry-row-main">
                <input
                  type="checkbox"
                  checked={d.erledigt}
                  onChange={() => handleToggleErledigt(d)}
                  aria-label="Erledigt"
                />
                <div className="entry-info">
                  <button
                    type="button"
                    className="entry-title entry-title-link"
                    onClick={() => oeffne("deadline", d.id)}
                  >
                    {d.titel}
                  </button>
                  <span className="entry-meta">
                    {[
                      fach?.name,
                      TYP_LABEL[d.typ],
                      d.kategorie !== "NORMAL" ? KATEGORIE_LABEL[d.kategorie] : null,
                      absolutesDatum(d.faellig_am),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
                {!d.erledigt && (() => {
                  const { wert, einheit, ueberfaellig } = restzeitGross(d.faellig_am);
                  return (
                    <div className={`entry-countdown ${dringend || ueberfaellig ? "entry-countdown-dringend" : ""}`}>
                      <span className="entry-countdown-wert">{wert}</span>
                      <span className="entry-countdown-einheit">
                        {einheit} {ueberfaellig ? "überfällig" : "übrig"}
                      </span>
                    </div>
                  );
                })()}
                <div className="entry-actions">
                  <DreiPunkteMenue
                    label={`Aktionen für „${d.titel}“`}
                    punkte={[
                      ...(userId && d.user_id === userId ? [{ label: "Teilen", icon: "gruppe", onClick: () => setTeilenId(d.id) } satisfies MenuePunkt] : []),
                      { label: "Bearbeiten", icon: "stift", onClick: () => openEditForm(d) },
                      { label: "Löschen", icon: "loeschen", gefahr: true, onClick: () => handleDelete(d.id) },
                    ]}
                  />
                </div>
              </div>
              {teilenId === d.id && <DeadlineTeilen deadlineId={d.id} onSchliessen={() => setTeilenId(null)} />}
              <div className="entry-row-unteraufgaben">
                <Unteraufgaben
                  parentTyp="deadline"
                  parentId={d.id}
                  initial={initialDeadlines.filter((x) => x.parent_deadline_id === d.id)}
                  userId={userId}
                />
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

          {!editId && (
            <>
              <label className="fach-checkbox">
                <input
                  type="checkbox"
                  checked={form.wiederholenBisDatum != null}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      wiederholenBisDatum: e.target.checked
                        ? new Date().toISOString().slice(0, 10)
                        : null,
                    }))
                  }
                />
                Wöchentlich wiederholen
              </label>

              {form.wiederholenBisDatum != null && (
                <>
                  <label htmlFor="deadline-wiederholen-bis">Bis einschließlich</label>
                  <input
                    id="deadline-wiederholen-bis"
                    type="date"
                    value={form.wiederholenBisDatum}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, wiederholenBisDatum: e.target.value }))
                    }
                  />
                </>
              )}
            </>
          )}

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
        <span className="ct">Deadlines</span>
      </div>
      {inhalt}
    </section>
  );
}
