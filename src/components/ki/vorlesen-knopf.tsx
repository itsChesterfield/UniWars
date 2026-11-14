"use client";

import { useEffect, useRef, useState } from "react";
import { KiEinwilligungDialog } from "@/components/ki/ki-einwilligung-dialog";
import { useSprachStatus } from "@/components/ki/sprach-status";
import { sprechStuecke, sprechtext } from "@/lib/ki/sprechtext";
import { track } from "@/lib/analytics";

/** Fertig geladene Stücke pro Text – erneutes Abspielen bucht nicht erneut (Sitzungs-Cache). */
const CACHE = new Map<string, string[]>();
/** Es spielt immer nur ein Text gleichzeitig */
let aktiv: { stoppen: () => void } | null = null;

type Phase = "bereit" | "laedt" | "spielt";
type Fehler = { fehler: string; typ: string; art?: "text" | "audio" };

async function stueckLaden(text: string, signal: AbortSignal): Promise<string> {
  const antwort = await fetch("/api/ki/vorlesen", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!antwort.ok) {
    const f = (await antwort.json().catch(() => null)) as Fehler | null;
    throw f ?? { fehler: "Vorlesen ist gerade nicht möglich.", typ: "technisch" };
  }
  return URL.createObjectURL(await antwort.blob());
}

/**
 * KI-14: Lautsprecher-Knopf. Text wird aufbereitet (sprechtext) und in Stücken vorgelesen:
 * Das erste Stück ist kurz und startet schnell, die nächsten laden während des Abspielens.
 * Erneuter Klick stoppt.
 */
export function VorlesenKnopf({
  text,
  cacheKey,
  autoStart = false,
  label = "Vorlesen",
}: {
  text: string;
  /** stabiler Schlüssel (z. B. Nachricht-ID) für den Sitzungs-Cache */
  cacheKey: string;
  autoStart?: boolean;
  label?: string;
}) {
  const [status, statusAendern] = useSprachStatus();
  const [phase, setPhase] = useState<Phase>("bereit");
  const [fehler, setFehler] = useState<string | null>(null);
  const [einwilligung, setEinwilligung] = useState<"text" | "audio" | null>(null);
  const steuerung = useRef<{ abbruch: AbortController; audio: HTMLAudioElement } | null>(null);
  const autoErledigt = useRef(false);

  function stoppen() {
    steuerung.current?.abbruch.abort();
    steuerung.current?.audio.pause();
    steuerung.current = null;
    setPhase("bereit");
  }

  useEffect(() => () => {
    steuerung.current?.abbruch.abort();
    steuerung.current?.audio.pause();
  }, []);

  async function abspielen() {
    setFehler(null);
    if (!status) return;
    if (!status.eingewilligt) return setEinwilligung("text");
    if (!status.audioEingewilligt) return setEinwilligung("audio");
    aktiv?.stoppen();
    const stuecke = sprechStuecke(sprechtext(text));
    if (stuecke.length === 0) return;
    const abbruch = new AbortController();
    const audio = new Audio();
    steuerung.current = { abbruch, audio };
    aktiv = { stoppen };
    setPhase("laedt");
    const start = performance.now();

    // Cache stückweise füllen: auch nach „Stopp“ wird Geladenes nicht erneut gebucht
    const vorher = CACHE.get(cacheKey);
    const neuGeladen = !vorher || vorher.length < stuecke.length || vorher.some((u) => !u);
    const eintrag = vorher ?? [];
    CACHE.set(cacheKey, eintrag);
    const urls: Promise<string>[] = [];
    const laden = (i: number) => {
      if (!urls[i]) {
        urls[i] = eintrag[i]
          ? Promise.resolve(eintrag[i])
          : stueckLaden(stuecke[i], abbruch.signal).then((u) => {
              eintrag[i] = u;
              return u;
            });
      }
      return urls[i];
    };
    try {
      for (let i = 0; i < stuecke.length; i++) {
        const url = await laden(i);
        if (i + 1 < stuecke.length) void laden(i + 1).catch(() => undefined);
        if (abbruch.signal.aborted) return;
        audio.src = url;
        await audio.play();
        if (i === 0) {
          setPhase("spielt");
          if (neuGeladen) track("ki_vorlesen", { zeichen: stuecke.reduce((n, s) => n + s.length, 0), start_ms: Math.round(performance.now() - start) });
        }
        await new Promise<void>((weiter, fehlt) => {
          audio.onended = () => weiter();
          audio.onerror = () => fehlt(new Error("Abspielen fehlgeschlagen"));
          abbruch.signal.addEventListener("abort", () => weiter(), { once: true });
        });
        if (abbruch.signal.aborted) return;
      }
    } catch (err) {
      if (abbruch.signal.aborted) return;
      const f = err as Partial<Fehler>;
      if (f?.typ === "einwilligung") setEinwilligung(f.art ?? "audio");
      else setFehler(typeof f?.fehler === "string" ? f.fehler : "Vorlesen hat nicht geklappt.");
      if (f?.typ === "limit") statusAendern({ ttsRestZeichen: 0 });
    } finally {
      if (steuerung.current?.abbruch === abbruch) {
        steuerung.current = null;
        setPhase("bereit");
      }
      if (aktiv?.stoppen === stoppen) aktiv = null;
    }
  }

  // „Antworten automatisch vorlesen“: einmal starten, sobald der Status da ist
  useEffect(() => {
    if (!autoStart || autoErledigt.current || !status?.vorlesen || !status.eingewilligt || !status.audioEingewilligt) return;
    autoErledigt.current = true;
    const id = window.setTimeout(() => void abspielen(), 0);
    return () => window.clearTimeout(id);
    // abspielen absichtlich nicht als Abhängigkeit: nur einmal beim ersten Status
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, status]);

  if (!status?.vorlesen || !text.trim()) return null;

  return (
    <span className="ki-vorlesen">
      <button
        type="button"
        className={`icon-knopf ki-vorlesen-knopf ${phase !== "bereit" ? "an" : ""}`}
        aria-label={phase === "bereit" ? label : "Vorlesen stoppen"}
        title={phase === "bereit" ? label : "Stoppen"}
        aria-pressed={phase !== "bereit"}
        onClick={() => (phase === "bereit" ? void abspielen() : stoppen())}
      >
        {phase === "laedt" ? "…" : phase === "spielt" ? "■" : "🔊"}
      </button>
      {fehler && (
        <span className="ki-diktat-fehler" role="alert">
          {fehler}
        </span>
      )}
      {einwilligung && (
        <KiEinwilligungDialog
          art={einwilligung}
          onSchliessen={() => setEinwilligung(null)}
          onZugestimmt={() => {
            const art = einwilligung;
            setEinwilligung(null);
            statusAendern(art === "text" ? { eingewilligt: true } : { audioEingewilligt: true });
            if (art === "text" && !status?.audioEingewilligt) setEinwilligung("audio");
          }}
        />
      )}
    </span>
  );
}
