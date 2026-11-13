"use client";

import { useState } from "react";
import { quelleErkennen } from "@/app/(hubs)/literaturverwaltung/ki-actions";
import { KiDialog, KiVorstufe, useKiTextStatus } from "@/components/ki/ki-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import { MAX_QUELLE_ZEICHEN, MIN_QUELLE_ZEICHEN, type QuellenErkennung } from "@/lib/ki/quelle";
import { kiFehlerTracken, kiGestartet, kiVorschauAngezeigt } from "@/lib/ki/tracking";

/** KI-09: eingefügte Quellenangabe → Formularfelder (gespeichert wird erst im Formular). */
export function KiQuelleDialog({ onErkannt, onSchliessen }: { onErkannt: (e: QuellenErkennung) => void; onSchliessen: () => void }) {
  const ki = useKiTextStatus();
  const [eingabe, setEingabe] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function erkennen() {
    setFehler(null);
    setLaeuft(true);
    kiGestartet("ki09");
    const start = performance.now();
    const a = await quelleErkennen(eingabe).catch(() => null);
    setLaeuft(false);
    if (!a?.ok) {
      const typ = a && !a.ok ? a.typ : "technisch";
      setFehler(a && !a.ok ? a.fehler : "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.");
      kiFehlerTracken("ki09", typ);
      if (typ === "limit") ki.limitErreicht();
      if (typ === "einwilligung") ki.einwilligungFehlt();
      return;
    }
    ki.verbraucht(a.daten.verbleibendHeute);
    kiVorschauAngezeigt("ki09", Object.keys(a.daten.felder).length, start);
    onErkannt({ felder: a.daten.felder, verworfen: a.daten.verworfen });
  }

  const laenge = eingabe.trim().length;

  return (
    <KiDialog titel="Quellenangabe einfügen" schliessbar={!laeuft} onSchliessen={onSchliessen}>
      {ki.phase !== "bereit" ? (
        <KiVorstufe ki={ki} ort="literatur" onSchliessen={onSchliessen} />
      ) : laeuft ? (
        <KiLadeZustand text="Die KI liest die Quellenangabe …" />
      ) : (
        <form
          className="ki-einstellungen"
          onSubmit={(e) => {
            e.preventDefault();
            void erkennen();
          }}
        >
          <label className="ki-feld">
            <span>Quellenangabe (aus einem PDF, einer Webseite oder einem Literaturverzeichnis)</span>
            <textarea
              className="field"
              rows={4}
              autoFocus
              maxLength={MAX_QUELLE_ZEICHEN}
              value={eingabe}
              placeholder="z. B. Müller, A. (2021). Grundlagen der Informatik. Berlin: Springer."
              onChange={(e) => setEingabe(e.target.value)}
            />
          </label>
          <p className="muted ki-klein">Die KI übernimmt nur, was in der Angabe steht – fehlende Felder bleiben leer.</p>
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <KiLimitHinweis verbleibend={ki.verbleibend} limit={ki.status?.limit ?? 0} />
            <button type="submit" className="btnp" disabled={laenge < MIN_QUELLE_ZEICHEN || ki.verbleibend === 0}>
              Felder ausfüllen
            </button>
          </div>
        </form>
      )}
    </KiDialog>
  );
}
