"use client";

import { useRef, useState, useTransition } from "react";
import { createUnterpunkte, toggleTodoErledigt, deleteTodo } from "@/app/todo/actions";
import { todoMitgliederLaden } from "@/app/einladung/actions";
import type { Tables } from "@/lib/supabase/types";

type Todo = Tables<"todo">;
type Mitglied = { user_id: string; username: string | null };

type NeueZeile = {
  tempId: string;
  titel: string;
  faelligAm: string;
  zugewiesenAn: string;
};

export function TodoUnterpunkte({
  parentId,
  fachId,
  initial,
}: {
  parentId: string;
  fachId: string | null;
  initial: Todo[];
}) {
  const [unterpunkte, setUnterpunkte] = useState(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [zeilen, setZeilen] = useState<NeueZeile[]>([]);
  const [eingabe, setEingabe] = useState("");
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const eingabeRef = useRef<HTMLInputElement>(null);

  const sortiert = [...unterpunkte].sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
    return new Date(a.erstellt_am).getTime() - new Date(b.erstellt_am).getTime();
  });

  function oeffneForm() {
    setFormOpen(true);
    todoMitgliederLaden(parentId)
      .then((data) => setMitglieder(data as Mitglied[]))
      .catch(() => setMitglieder([]));
  }

  function handleEingabeKeydown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const titel = eingabe.trim();
    if (titel === "") return;
    setZeilen((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), titel, faelligAm: "", zugewiesenAn: "" },
    ]);
    setEingabe("");
    eingabeRef.current?.focus();
  }

  function entferneZeile(tempId: string) {
    setZeilen((prev) => prev.filter((z) => z.tempId !== tempId));
  }

  function aendereZeile(tempId: string, patch: Partial<NeueZeile>) {
    setZeilen((prev) => prev.map((z) => (z.tempId === tempId ? { ...z, ...patch } : z)));
  }

  function schliessenForm() {
    setFormOpen(false);
    setZeilen([]);
    setEingabe("");
    setError(null);
  }

  function bestaetigen() {
    if (zeilen.length === 0) {
      schliessenForm();
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const created = await createUnterpunkte(
          parentId,
          fachId,
          zeilen.map((z) => ({
            titel: z.titel,
            faelligAm: z.faelligAm ? new Date(z.faelligAm).toISOString() : undefined,
            zugewiesenAn: z.zugewiesenAn || undefined,
          })),
        );
        setUnterpunkte((prev) => [...prev, ...created]);
        schliessenForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleToggle(t: Todo) {
    const naechsterStatus = !t.erledigt;
    setUnterpunkte((prev) => prev.map((x) => (x.id === t.id ? { ...x, erledigt: naechsterStatus } : x)));
    startTransition(() => toggleTodoErledigt(t.id, naechsterStatus));
  }

  function handleDelete(id: string) {
    setUnterpunkte((prev) => prev.filter((x) => x.id !== id));
    startTransition(() => deleteTodo(id));
  }

  if (unterpunkte.length === 0 && !formOpen) {
    return (
      <button type="button" className="unteraufgabe-add" onClick={oeffneForm}>
        + Unterpunkte
      </button>
    );
  }

  return (
    <div className="unteraufgaben">
      {sortiert.map((t) => (
        <div key={t.id} className={`unteraufgabe-row ${t.erledigt ? "entry-erledigt" : ""}`}>
          <input
            type="checkbox"
            checked={t.erledigt}
            onChange={() => handleToggle(t)}
            aria-label="Erledigt"
          />
          <div className="unteraufgabe-info">
            <span>{t.titel}</span>
          </div>
          <button type="button" onClick={() => handleDelete(t.id)} aria-label="Unterpunkt löschen">
            ✕
          </button>
        </div>
      ))}

      {formOpen ? (
        <div className="unteraufgabe-form">
          {error && <p className="auth-error" style={{ fontSize: 12 }}>{error}</p>}

          {zeilen.map((z) => (
            <div key={z.tempId} className="unteraufgabe-zeile">
              <div className="unteraufgabe-zeile-kopf">
                <span className="unteraufgabe-zeile-titel">{z.titel}</span>
                <button
                  type="button"
                  onClick={() => entferneZeile(z.tempId)}
                  aria-label={`${z.titel} entfernen`}
                >
                  ✕
                </button>
              </div>
              <div className="unteraufgabe-zeile-felder">
                <select
                  value={z.zugewiesenAn}
                  onChange={(e) => aendereZeile(z.tempId, { zugewiesenAn: e.target.value })}
                  aria-label={`Zuständig für ${z.titel}`}
                >
                  <option value="">Niemand</option>
                  {mitglieder.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.username ?? "?"}
                    </option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={z.faelligAm}
                  onChange={(e) => aendereZeile(z.tempId, { faelligAm: e.target.value })}
                  aria-label={`Frist für ${z.titel}`}
                />
              </div>
            </div>
          ))}

          <input
            ref={eingabeRef}
            type="text"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            onKeyDown={handleEingabeKeydown}
            placeholder="Titel eingeben, Enter zum Hinzufügen…"
            autoFocus
          />

          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              className="btnp"
              disabled={isPending}
              onClick={bestaetigen}
              style={{ padding: "4px 12px", fontSize: 12 }}
            >
              {isPending ? "Speichern…" : "Bestätigen"}
            </button>
            <button
              type="button"
              onClick={schliessenForm}
              disabled={isPending}
              style={{ padding: "4px 12px", fontSize: 12 }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="unteraufgabe-add" onClick={oeffneForm}>
          + Unterpunkte
        </button>
      )}
    </div>
  );
}
