"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

export type UnteraufgabeEingabe = {
  titel: string;
  faelligAm: string;
  zugewiesenAn: string;
};

export type EditorMitglied = { user_id: string; username: string | null };

type Zeile = UnteraufgabeEingabe & { tempId: string };

function neueZeile(faelligAm: string): Zeile {
  return { tempId: crypto.randomUUID(), titel: "", faelligAm, zugewiesenAn: "" };
}

export function UnteraufgabenEditor({
  elternTyp,
  ort,
  mitglieder,
  terminPflicht,
  standardTermin = "",
  speichernLabel = "Speichern",
  abbrechenLabel = "Abbrechen",
  onSpeichern,
  onAbbrechen,
}: {
  elternTyp: "todo" | "deadline" | "pruefung";
  ort: "schnell_erfassen" | "liste" | "detail";
  mitglieder: EditorMitglied[];
  terminPflicht: boolean;
  standardTermin?: string;
  speichernLabel?: string;
  abbrechenLabel?: string;
  onSpeichern: (eintraege: UnteraufgabeEingabe[]) => Promise<void>;
  onAbbrechen: () => void;
}) {
  const [zeilen, setZeilen] = useState<Zeile[]>(() => [neueZeile(standardTermin)]);
  const [fokusId, setFokusId] = useState<string | null>(() => zeilen[0]?.tempId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  function zeileHinzufuegen() {
    const zeile = neueZeile(standardTermin);
    setZeilen((prev) => [...prev, zeile]);
    setFokusId(zeile.tempId);
  }

  function aendereZeile(tempId: string, patch: Partial<Zeile>) {
    setZeilen((prev) => prev.map((z) => (z.tempId === tempId ? { ...z, ...patch } : z)));
  }

  function entferneZeile(tempId: string) {
    setZeilen((prev) =>
      prev.length === 1 ? [neueZeile(standardTermin)] : prev.filter((z) => z.tempId !== tempId),
    );
  }

  function handleTitelKeydown(e: React.KeyboardEvent<HTMLInputElement>, zeile: Zeile) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (zeile.titel.trim() !== "") zeileHinzufuegen();
  }

  async function speichern() {
    const ausgefuellt = zeilen.filter((z) => z.titel.trim() !== "");
    if (ausgefuellt.length === 0) {
      setError("Bitte mindestens einen Titel eingeben.");
      return;
    }
    if (terminPflicht && ausgefuellt.some((z) => !z.faelligAm)) {
      setError("Bitte für jede Unteraufgabe einen Termin angeben.");
      return;
    }
    setError(null);
    setSpeichert(true);
    try {
      await onSpeichern(
        ausgefuellt.map((z) => ({
          titel: z.titel.trim(),
          faelligAm: z.faelligAm,
          zugewiesenAn: z.zugewiesenAn,
        })),
      );
      track("unteraufgaben_angelegt", {
        eltern_typ: elternTyp,
        ort,
        anzahl: ausgefuellt.length,
        mit_zuweisung: ausgefuellt.filter((z) => z.zugewiesenAn).length,
        mit_termin: ausgefuellt.filter((z) => z.faelligAm).length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <div className="unteraufgabe-form">
      {error && <p className="auth-error" style={{ fontSize: 12 }}>{error}</p>}

      {zeilen.map((z, index) => (
        <div key={z.tempId} className="unteraufgabe-zeile">
          <div className="unteraufgabe-zeile-kopf">
            <input
              type="text"
              value={z.titel}
              onChange={(e) => aendereZeile(z.tempId, { titel: e.target.value })}
              onKeyDown={(e) => handleTitelKeydown(e, z)}
              placeholder={`Unteraufgabe ${index + 1}`}
              aria-label={`Titel Unteraufgabe ${index + 1}`}
              autoFocus={z.tempId === fokusId}
            />
            <button
              type="button"
              onClick={() => entferneZeile(z.tempId)}
              aria-label={`Unteraufgabe ${index + 1} entfernen`}
            >
              ✕
            </button>
          </div>
          <div className="unteraufgabe-zeile-felder">
            <label className="unteraufgabe-feld">
              <span>Zuständig</span>
              <select
                value={z.zugewiesenAn}
                onChange={(e) => aendereZeile(z.tempId, { zugewiesenAn: e.target.value })}
              >
                <option value="">Niemand</option>
                {mitglieder.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.username ?? "?"}
                  </option>
                ))}
              </select>
            </label>
            <label className="unteraufgabe-feld unteraufgabe-feld-termin">
              <span>Termin{terminPflicht ? "" : " (optional)"}</span>
              <input
                type="datetime-local"
                value={z.faelligAm}
                onChange={(e) => aendereZeile(z.tempId, { faelligAm: e.target.value })}
              />
            </label>
          </div>
        </div>
      ))}

      <button type="button" className="unteraufgabe-add" onClick={zeileHinzufuegen}>
        + Weitere Unteraufgabe
      </button>

      <div className="row" style={{ gap: 6 }}>
        <button
          type="button"
          className="btnp"
          onClick={speichern}
          disabled={speichert}
          style={{ padding: "6px 14px", fontSize: 12 }}
        >
          {speichert ? "Speichern…" : speichernLabel}
        </button>
        <button
          type="button"
          onClick={onAbbrechen}
          disabled={speichert}
          style={{ padding: "6px 14px", fontSize: 12 }}
        >
          {abbrechenLabel}
        </button>
      </div>
    </div>
  );
}
