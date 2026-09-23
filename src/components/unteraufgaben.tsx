"use client";

import { useRef, useState, useTransition } from "react";
import {
  createDeadline,
  toggleDeadlineErledigt,
  deleteDeadline,
} from "@/app/deadline/actions";
import {
  todoMitgliederLaden,
  deadlineMitgliederLaden,
  pruefungMitgliederLaden,
} from "@/app/einladung/actions";
import type { Tables } from "@/lib/supabase/types";
import { restzeitGross, absolutesDatum } from "@/lib/countdown";
import { DeadlineTeilen } from "@/components/deadline-teilen";

type Deadline = Tables<"deadline">;
type Mitglied = { user_id: string; username: string | null };

type NeueZeile = {
  tempId: string;
  titel: string;
  faelligAm: string;
  zugewiesenAn: string;
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Unteraufgaben({
  parentTyp,
  parentId,
  initial,
  userId,
}: {
  parentTyp: "todo" | "deadline" | "pruefung";
  parentId: string;
  initial: Deadline[];
  userId?: string;
}) {
  const [aufgaben, setAufgaben] = useState(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [zeilen, setZeilen] = useState<NeueZeile[]>([]);
  const [titel, setTitel] = useState("");
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const titelRef = useRef<HTMLInputElement>(null);

  const sortiert = [...aufgaben].sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1;
    return new Date(a.faellig_am).getTime() - new Date(b.faellig_am).getTime();
  });

  function oeffneForm() {
    setFormOpen(true);
    const laden =
      parentTyp === "todo"
        ? todoMitgliederLaden
        : parentTyp === "deadline"
          ? deadlineMitgliederLaden
          : pruefungMitgliederLaden;
    laden(parentId)
      .then((data) => setMitglieder(data as Mitglied[]))
      .catch(() => setMitglieder([]));
  }

  function zeileHinzufuegen() {
    const wert = titel.trim();
    if (wert === "") return;
    setZeilen((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), titel: wert, faelligAm: toDatetimeLocal(new Date().toISOString()), zugewiesenAn: "" },
    ]);
    setTitel("");
    titelRef.current?.focus();
  }

  function handleTitelKeydown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    zeileHinzufuegen();
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
    setTitel("");
    setError(null);
  }

  function bestaetigen() {
    if (zeilen.length === 0) {
      schliessenForm();
      return;
    }
    if (zeilen.some((z) => !z.faelligAm)) {
      setError("Bitte für jede Unteraufgabe einen Termin angeben.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const neu: Deadline[] = [];
        for (const z of zeilen) {
          const erstellt = await createDeadline({
            titel: z.titel,
            fach_id: null,
            faellig_am: new Date(z.faelligAm).toISOString(),
            typ: "ABGABE",
            kategorie: "NORMAL",
            todoId: parentTyp === "todo" ? parentId : undefined,
            pruefungId: parentTyp === "pruefung" ? parentId : undefined,
            parentDeadlineId: parentTyp === "deadline" ? parentId : undefined,
            zugewiesenAn: z.zugewiesenAn || undefined,
          });
          neu.push(...erstellt);
        }
        setAufgaben((prev) => [...prev, ...neu]);
        schliessenForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handleToggle(d: Deadline) {
    const naechsterStatus = !d.erledigt;
    setAufgaben((prev) => prev.map((x) => (x.id === d.id ? { ...x, erledigt: naechsterStatus } : x)));
    startTransition(() => toggleDeadlineErledigt(d.id, naechsterStatus));
  }

  function handleDelete(id: string) {
    setAufgaben((prev) => prev.filter((x) => x.id !== id));
    startTransition(() => deleteDeadline(id));
  }

  if (aufgaben.length === 0 && !formOpen) {
    return (
      <button type="button" className="unteraufgabe-add" onClick={oeffneForm}>
        + Unteraufgabe
      </button>
    );
  }

  return (
    <div className="unteraufgaben">
      {sortiert.map((d) => (
        <div key={d.id} className={`unteraufgabe-row ${d.erledigt ? "entry-erledigt" : ""}`}>
          <input
            type="checkbox"
            checked={d.erledigt}
            onChange={() => handleToggle(d)}
            aria-label="Erledigt"
          />
          <div className="unteraufgabe-info">
            <span>{d.titel}</span>
            <span className="muted" style={{ fontSize: 11 }}>
              {d.erledigt ? absolutesDatum(d.faellig_am) : `${restzeitGross(d.faellig_am).wert} ${restzeitGross(d.faellig_am).einheit} · ${absolutesDatum(d.faellig_am)}`}
            </span>
          </div>
          {userId && d.user_id === userId && <DeadlineTeilen deadlineId={d.id} />}
          <button type="button" onClick={() => handleDelete(d.id)} aria-label="Unteraufgabe löschen">
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
                  aria-label={`Termin für ${z.titel}`}
                />
              </div>
            </div>
          ))}

          <input
            ref={titelRef}
            type="text"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            onKeyDown={handleTitelKeydown}
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
          + Unteraufgabe
        </button>
      )}
    </div>
  );
}
