"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { kiTextStatus } from "@/app/(hubs)/notizen/ki-actions";
import { KiEinwilligungInhalt } from "@/components/ki/ki-einwilligung-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import type { TextStatus } from "@/lib/ki/ergebnis";
import { track } from "@/lib/analytics";

/** Rahmen aller KI-Dialoge (KI-ALL-10: mobil bildschirmfüllend über CSS). */
export function KiDialog({
  titel,
  gross = false,
  schliessbar = true,
  onSchliessen,
  children,
}: {
  titel: string;
  gross?: boolean;
  /** während die KI arbeitet, lässt sich der Dialog nicht schließen */
  schliessbar?: boolean;
  onSchliessen: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`card ki-dialog ${gross ? "ki-dialog-gross" : ""}`}
      aria-label={titel}
      onCancel={(e) => {
        e.preventDefault();
        if (schliessbar) onSchliessen();
      }}
    >
      <div className="rowb ki-dialog-kopf">
        <h3 className="ct">✨ {titel}</h3>
        {schliessbar && (
          <button type="button" className="icon-knopf" aria-label="Schließen" onClick={onSchliessen}>
            ✕
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
}

export type KiPhase = "laden" | "nicht_verfuegbar" | "einwilligung" | "bereit";

/** Lädt Key-/Einwilligungs-/Limit-Status für Text-Funktionen. */
export function useKiTextStatus() {
  const [phase, setPhase] = useState<KiPhase>("laden");
  const [status, setStatus] = useState<TextStatus | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    kiTextStatus()
      .catch(() => null)
      .then((a) => {
        if (abgebrochen) return;
        if (!a?.ok) {
          setFehler(a && !a.ok ? a.fehler : "KI ist gerade nicht verfügbar.");
          setPhase("nicht_verfuegbar");
          return;
        }
        setStatus(a.daten);
        setPhase(!a.daten.verfuegbar ? "nicht_verfuegbar" : a.daten.eingewilligt ? "bereit" : "einwilligung");
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  const verbleibend = status ? Math.max(0, status.limit - status.genutzt) : 0;
  const verbraucht = useCallback((neuVerbleibend: number) => {
    setStatus((s) => (s ? { ...s, genutzt: s.limit - neuVerbleibend } : s));
  }, []);
  const eingewilligt = useCallback(() => {
    setStatus((s) => (s ? { ...s, eingewilligt: true } : s));
    setPhase("bereit");
  }, []);
  const limitErreicht = useCallback(() => setStatus((s) => (s ? { ...s, genutzt: s.limit } : s)), []);
  const einwilligungFehlt = useCallback(() => setPhase("einwilligung"), []);

  return { phase, status, fehler, verbleibend, verbraucht, eingewilligt, limitErreicht, einwilligungFehlt };
}

/** Gemeinsame Anzeige der Vorstufen (Laden, nicht verfügbar, Einwilligung). Gibt null zurück, wenn bereit. */
export function KiVorstufe({
  ki,
  ort,
  onSchliessen,
}: {
  ki: ReturnType<typeof useKiTextStatus>;
  ort: string;
  onSchliessen: () => void;
}) {
  if (ki.phase === "laden") return <KiLadeZustand text="Lädt …" />;
  if (ki.phase === "nicht_verfuegbar") {
    return (
      <>
        <p>{ki.fehler ?? "KI ist gerade nicht verfügbar."}</p>
        <div className="hub-formular-knoepfe">
          <button type="button" className="btnp" onClick={onSchliessen}>
            Schließen
          </button>
        </div>
      </>
    );
  }
  if (ki.phase === "einwilligung") {
    return (
      <KiEinwilligungInhalt
        onAbbrechen={onSchliessen}
        onZugestimmt={() => {
          track("ki_einwilligung_erteilt", { ort });
          ki.eingewilligt();
        }}
      />
    );
  }
  return null;
}

export { KiFehlerMeldung };
