"use client";

import { useState } from "react";
import { MarkdownEditor } from "@/components/hubs/markdown-editor";

/** KK-02: Vorderseite + Rückseite, beide Pflicht. */
export function KartenFormular({
  startVorderseite = "",
  startRueckseite = "",
  mitNaechste,
  onSpeichern,
  onAbbrechen,
}: {
  startVorderseite?: string;
  startRueckseite?: string;
  mitNaechste: boolean;
  onSpeichern: (vorderseite: string, rueckseite: string, naechste: boolean) => Promise<void>;
  onAbbrechen: () => void;
}) {
  const [vorderseite, setVorderseite] = useState(startVorderseite);
  const [rueckseite, setRueckseite] = useState(startRueckseite);
  const [runde, setRunde] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function speichern(naechste: boolean) {
    if (!vorderseite.trim() || !rueckseite.trim()) {
      setFehler("Bitte Vorder- und Rückseite ausfüllen.");
      return;
    }
    setFehler(null);
    setLaeuft(true);
    try {
      await onSpeichern(vorderseite, rueckseite, naechste);
      if (naechste) {
        setVorderseite("");
        setRueckseite("");
        setRunde((r) => r + 1); // Editoren leeren
      }
    } catch {
      setFehler("Speichern hat nicht geklappt.");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div
      className="kk-formular"
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void speichern(mitNaechste);
        }
      }}
    >
      <div className="kk-formular-seiten">
        <div>
          <span className="kk-formular-label">Vorderseite</span>
          <MarkdownEditor
            key={`v-${runde}`}
            wert={vorderseite}
            onAendern={setVorderseite}
            kompakt
            autoFokus
            label="Vorderseite"
            platzhalter="Frage oder Begriff"
          />
        </div>
        <div>
          <span className="kk-formular-label">Rückseite</span>
          <MarkdownEditor key={`r-${runde}`} wert={rueckseite} onAendern={setRueckseite} kompakt label="Rückseite" platzhalter="Antwort" />
        </div>
      </div>
      {fehler && (
        <p className="formular-fehler" role="alert">
          {fehler}
        </p>
      )}
      <div className="crud-form-actions">
        {mitNaechste && (
          <button type="button" className="knopf haupt" aria-busy={laeuft} disabled={laeuft} onClick={() => void speichern(true)} title="Strg+Enter">
            Speichern und nächste
          </button>
        )}
        <button type="button" className={`knopf ${mitNaechste ? "neben" : "haupt"}`} disabled={laeuft} onClick={() => void speichern(false)}>
          Speichern
        </button>
        <button type="button" className="knopf leise" onClick={onAbbrechen}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
