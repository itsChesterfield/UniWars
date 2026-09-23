"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUnterpunkte } from "@/app/todo/actions";
import { createDeadline } from "@/app/deadline/actions";
import {
  todoMitgliederLaden,
  deadlineMitgliederLaden,
  pruefungMitgliederLaden,
} from "@/app/einladung/actions";

export type UnteraufgabenParentTyp = "todo" | "deadline" | "pruefung";

type Mitglied = { user_id: string; username: string | null };

type Zeile = {
  tempId: string;
  titel: string;
  faelligAm: string;
  zugewiesenAn: string;
};

const MITGLIEDER_LADEN: Record<UnteraufgabenParentTyp, (id: string) => Promise<Mitglied[]>> = {
  todo: todoMitgliederLaden,
  deadline: deadlineMitgliederLaden,
  pruefung: pruefungMitgliederLaden,
};

export function UnteraufgabenDialog({
  parentTyp,
  parentId,
  parentTitel,
  fachId,
  onClose,
}: {
  parentTyp: UnteraufgabenParentTyp;
  parentId: string;
  parentTitel: string;
  fachId: string | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const eingabeRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [eingabe, setEingabe] = useState("");
  const [mitglieder, setMitglieder] = useState<Mitglied[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [speichertGerade, setSpeichertGerade] = useState(false);

  // Deadline-Unteraufgaben brauchen zwingend ein Datum (faellig_am ist NOT NULL).
  const terminPflicht = parentTyp !== "todo";

  useEffect(() => {
    dialogRef.current?.showModal();
    MITGLIEDER_LADEN[parentTyp](parentId)
      .then(setMitglieder)
      .catch(() => setMitglieder([]));
    eingabeRef.current?.focus();
  }, [parentTyp, parentId]);

  function schliessen() {
    dialogRef.current?.close();
    onClose();
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

  function aendereZeile(tempId: string, patch: Partial<Zeile>) {
    setZeilen((prev) => prev.map((z) => (z.tempId === tempId ? { ...z, ...patch } : z)));
  }

  async function handleFertig() {
    if (zeilen.length === 0) {
      schliessen();
      return;
    }
    if (terminPflicht && zeilen.some((z) => !z.faelligAm)) {
      setError("Bitte für jede Unteraufgabe einen Termin angeben.");
      return;
    }
    setSpeichertGerade(true);
    setError(null);
    try {
      if (parentTyp === "todo") {
        await createUnterpunkte(
          parentId,
          fachId,
          zeilen.map((z) => ({
            titel: z.titel,
            faelligAm: z.faelligAm ? new Date(z.faelligAm).toISOString() : undefined,
            zugewiesenAn: z.zugewiesenAn || undefined,
          })),
        );
      } else {
        for (const z of zeilen) {
          await createDeadline({
            titel: z.titel,
            fach_id: fachId,
            faellig_am: new Date(z.faelligAm).toISOString(),
            typ: "ABGABE",
            kategorie: "NORMAL",
            pruefungId: parentTyp === "pruefung" ? parentId : undefined,
            parentDeadlineId: parentTyp === "deadline" ? parentId : undefined,
            zugewiesenAn: z.zugewiesenAn || undefined,
          });
        }
      }
      router.refresh();
      schliessen();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSpeichertGerade(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="quick-add-modal"
      onCancel={(e) => {
        e.preventDefault();
        schliessen();
      }}
    >
      <h3>Unteraufgaben hinzufügen?</h3>
      <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        Für „{parentTitel}“ — optional. Titel eingeben und mit Enter hinzufügen, dann Termin und
        Zuständigkeit festlegen.
      </p>

      {error && <p className="auth-error">{error}</p>}

      {zeilen.length === 0 ? (
        <p className="faint" style={{ fontSize: 12 }}>
          Noch keine Unteraufgaben.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {zeilen.map((z) => (
            <div key={z.tempId} className="unteraufgabe-zeile">
              <div className="unteraufgabe-zeile-kopf">
                <span className="unteraufgabe-zeile-titel">{z.titel}</span>
                <button type="button" onClick={() => entferneZeile(z.tempId)} aria-label={`${z.titel} entfernen`}>
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
                  required={terminPflicht}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={eingabeRef}
        type="text"
        value={eingabe}
        onChange={(e) => setEingabe(e.target.value)}
        onKeyDown={handleEingabeKeydown}
        placeholder="Unteraufgabe hinzufügen… (Enter)"
      />

      <div className="crud-form-actions">
        <button type="button" onClick={schliessen} disabled={speichertGerade}>
          Überspringen
        </button>
        <button type="button" className="btnp" onClick={handleFertig} disabled={speichertGerade}>
          {speichertGerade ? "Speichern…" : "Fertig"}
        </button>
      </div>
    </dialog>
  );
}
