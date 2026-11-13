"use client";

import { useState } from "react";
import { formelVorschlagen } from "@/app/(hubs)/tabellen/ki-actions";
import { KiDialog, KiVorstufe, useKiTextStatus } from "@/components/ki/ki-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import { MAX_BESCHREIBUNG, type FormelVorschlag } from "@/lib/ki/formel";
import { kiFehlerTracken, kiGestartet, kiVorschauAngezeigt, kiVorschauUebernommen } from "@/lib/ki/tracking";

/** KI-10: "Was willst du berechnen?" → Formel + Erklärung → in die gewählte Zelle einfügen. */
export function KiFormelDialog({
  tabelleId,
  zielZelle,
  vorher,
  onEinfuegen,
  onSchliessen,
}: {
  tabelleId: string;
  zielZelle: string;
  /** Ausstehende Änderungen speichern, damit der Server die aktuellen Überschriften sieht */
  vorher: () => Promise<void>;
  onEinfuegen: (formel: string) => void;
  onSchliessen: () => void;
}) {
  const ki = useKiTextStatus();
  const [beschreibung, setBeschreibung] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorschlag, setVorschlag] = useState<FormelVorschlag | null>(null);

  async function vorschlagen() {
    setFehler(null);
    setLaeuft(true);
    kiGestartet("ki10");
    const start = performance.now();
    await vorher().catch(() => undefined);
    const a = await formelVorschlagen(tabelleId, zielZelle, beschreibung).catch(() => null);
    setLaeuft(false);
    if (!a?.ok) {
      const typ = a && !a.ok ? a.typ : "technisch";
      setFehler(a && !a.ok ? a.fehler : "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.");
      kiFehlerTracken("ki10", typ);
      if (typ === "limit") ki.limitErreicht();
      if (typ === "einwilligung") ki.einwilligungFehlt();
      return;
    }
    ki.verbraucht(a.daten.verbleibendHeute);
    setVorschlag({ formel: a.daten.formel, erklaerung: a.daten.erklaerung });
    kiVorschauAngezeigt("ki10", 1, start);
  }

  return (
    <KiDialog titel="Formel-Helfer" schliessbar={!laeuft} onSchliessen={onSchliessen}>
      {ki.phase !== "bereit" ? (
        <KiVorstufe ki={ki} ort="tabellen" onSchliessen={onSchliessen} />
      ) : laeuft ? (
        <KiLadeZustand text="Die KI sucht eine passende Formel …" />
      ) : (
        <form
          className="ki-einstellungen"
          onSubmit={(e) => {
            e.preventDefault();
            void vorschlagen();
          }}
        >
          <label className="ki-feld">
            <span>Was willst du berechnen? (Formel kommt in {zielZelle})</span>
            <textarea
              className="field"
              rows={2}
              autoFocus
              maxLength={MAX_BESCHREIBUNG}
              value={beschreibung}
              placeholder="z. B. Durchschnitt der Noten in Spalte B"
              onChange={(e) => {
                setBeschreibung(e.target.value);
                setVorschlag(null);
              }}
            />
          </label>
          <p className="muted ki-klein">Die KI sieht nur die Spaltenüberschriften aus Zeile 1, nicht deine Werte.</p>
          {vorschlag && (
            <div className="ki-formel-vorschlag">
              <code className="mono">{vorschlag.formel}</code>
              {vorschlag.erklaerung && <p>{vorschlag.erklaerung}</p>}
            </div>
          )}
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <KiLimitHinweis verbleibend={ki.verbleibend} limit={ki.status?.limit ?? 0} />
            <span className="ki-knopf-gruppe">
              <button type="submit" className={vorschlag ? "btng" : "btnp"} disabled={beschreibung.trim().length < 3 || ki.verbleibend === 0}>
                {vorschlag ? "Neuer Vorschlag" : "Vorschlagen"}
              </button>
              {vorschlag && (
                <button
                  type="button"
                  className="btnp"
                  onClick={() => {
                    kiVorschauUebernommen("ki10", 1, 0);
                    onEinfuegen(vorschlag.formel);
                  }}
                >
                  In {zielZelle} einfügen
                </button>
              )}
            </span>
          </div>
        </form>
      )}
    </KiDialog>
  );
}
