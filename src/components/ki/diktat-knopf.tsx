"use client";

import { useEffect, useRef, useState } from "react";
import { KiEinwilligungDialog } from "@/components/ki/ki-einwilligung-dialog";
import { useSprachStatus } from "@/components/ki/sprach-status";
import { aufnahmeFormat, zeitText } from "@/lib/transkription/transkript";
import { track } from "@/lib/analytics";

const MAX_SEKUNDEN = 120;
const STILLE_SEKUNDEN = 60;
const STILLE_PEGEL = 0.02;

type Phase = "bereit" | "aufnahme" | "umwandeln";

/**
 * KI-13: Diktieren (Push-to-talk). Klick startet, erneuter Klick / Enter / 60 s Stille / 2 min beenden.
 * Die Aufnahme bleibt im Speicher; der erkannte Text geht an `onText` (z. B. ins Eingabefeld).
 * Ohne MediaRecorder oder ohne eingerichtete Spracherkennung wird der Knopf nicht angezeigt.
 */
export function DiktatKnopf({ onText, disabled = false, klasse = "" }: { onText: (text: string) => void; disabled?: boolean; klasse?: string }) {
  const [status, statusAendern] = useSprachStatus();
  const [phase, setPhase] = useState<Phase>("bereit");
  const [sekunden, setSekunden] = useState(0);
  const [pegel, setPegel] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [einwilligung, setEinwilligung] = useState<"text" | "audio" | null>(null);
  const [unterstuetzt, setUnterstuetzt] = useState(false);

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const kontext = useRef<AudioContext | null>(null);
  const takt = useRef<number | null>(null);
  const bild = useRef<number | null>(null);
  const start = useRef(0);
  const leiseSeit = useRef(0);
  const stoppenRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    // erst im Browser prüfen (Server kennt MediaRecorder nicht)
    const id = window.setTimeout(() => setUnterstuetzt(typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)), 0);
    return () => window.clearTimeout(id);
  }, []);

  function aufraeumen() {
    if (takt.current) window.clearInterval(takt.current);
    if (bild.current) cancelAnimationFrame(bild.current);
    takt.current = null;
    bild.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void kontext.current?.close().catch(() => undefined);
    kontext.current = null;
    setPegel(0);
  }
  useEffect(() => () => {
    recorder.current?.stop();
    aufraeumen();
  }, []);

  // Enter beendet die Aufnahme (statt die Nachricht zu senden)
  useEffect(() => {
    if (phase !== "aufnahme") return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        stoppenRef.current();
      }
    };
    window.addEventListener("keydown", taste, true);
    return () => window.removeEventListener("keydown", taste, true);
  }, [phase]);

  async function umwandeln(blob: Blob, dauer: number) {
    setPhase("umwandeln");
    const form = new FormData();
    form.append("audio", blob, "diktat");
    form.append("sekunden", String(Math.max(1, Math.round(dauer))));
    form.append("sprache", navigator.language?.toLowerCase().startsWith("en") ? "en" : "de");
    try {
      const antwort = await fetch("/api/ki/diktat", { method: "POST", body: form });
      const daten = (await antwort.json().catch(() => null)) as
        | { ok: true; daten: { text: string; verbleibendSekunden: number } }
        | { ok: false; fehler: string; typ: string; art?: "text" | "audio" }
        | null;
      if (!daten?.ok) {
        if (daten && !daten.ok && daten.typ === "einwilligung") setEinwilligung(daten.art ?? "audio");
        else setFehler(daten && !daten.ok ? daten.fehler : "Das Diktat hat nicht geklappt.");
        track("ki_fehler", { funktion: "ki13", typ: daten && !daten.ok ? daten.typ : "technisch" });
        return;
      }
      statusAendern({ audioRestSekunden: daten.daten.verbleibendSekunden });
      track("ki_diktat", { sekunden: Math.round(dauer), zeichen: daten.daten.text.length });
      if (daten.daten.text) onText(daten.daten.text);
      else setFehler("Ich habe nichts verstanden. Versuch es noch einmal.");
    } catch {
      setFehler("Keine Verbindung. Bitte versuch es noch einmal.");
    } finally {
      setPhase("bereit");
    }
  }

  function stoppen() {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    rec.stop();
  }
  useEffect(() => {
    stoppenRef.current = stoppen;
  });

  async function starten() {
    setFehler(null);
    if (!status) return;
    if (!status.eingewilligt) return setEinwilligung("text");
    if (!status.audioEingewilligt) return setEinwilligung("audio");
    if (status.audioRestSekunden < 1) return setFehler("Dein Audio-Kontingent für diesen Monat ist aufgebraucht.");
    const format = aufnahmeFormat((m) => MediaRecorder.isTypeSupported(m));
    if (!format) return setFehler("Dein Browser kann leider nicht aufnehmen.");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      const verweigert = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      return setFehler(verweigert ? "Bitte erlaube den Zugriff aufs Mikrofon." : "Es wurde kein Mikrofon gefunden.");
    }
    const stuecke: Blob[] = [];
    const rec = new MediaRecorder(stream.current, { mimeType: format.mime, audioBitsPerSecond: 32_000 });
    rec.ondataavailable = (e) => {
      if (e.data.size) stuecke.push(e.data);
    };
    rec.onstop = () => {
      const dauer = (Date.now() - start.current) / 1000;
      aufraeumen();
      void umwandeln(new Blob(stuecke, { type: format.mime.split(";")[0] }), dauer);
    };
    recorder.current = rec;
    start.current = Date.now();
    leiseSeit.current = Date.now();
    rec.start(500);
    setSekunden(0);
    setPhase("aufnahme");

    try {
      const ctx = new AudioContext();
      const analyse = ctx.createAnalyser();
      analyse.fftSize = 512;
      ctx.createMediaStreamSource(stream.current).connect(analyse);
      kontext.current = ctx;
      const werte = new Uint8Array(analyse.fftSize);
      const zeichnen = () => {
        analyse.getByteTimeDomainData(werte);
        let summe = 0;
        for (const w of werte) summe += ((w - 128) / 128) ** 2;
        const p = Math.min(1, Math.sqrt(summe / werte.length) * 3);
        if (p > STILLE_PEGEL) leiseSeit.current = Date.now();
        setPegel(p);
        bild.current = requestAnimationFrame(zeichnen);
      };
      zeichnen();
    } catch {
      // ohne Pegel weiter
    }
    takt.current = window.setInterval(() => {
      const s = (Date.now() - start.current) / 1000;
      setSekunden(s);
      if (s >= MAX_SEKUNDEN || Date.now() - leiseSeit.current > STILLE_SEKUNDEN * 1000) stoppenRef.current();
    }, 250);
  }

  if (!unterstuetzt || !status?.diktat) return null;

  return (
    <span className={`ki-diktat ${klasse}`}>
      <button
        type="button"
        className={`icon-knopf ki-diktat-knopf ${phase === "aufnahme" ? "an" : ""}`}
        aria-label={phase === "aufnahme" ? "Diktat beenden (Enter)" : "Diktieren"}
        title={phase === "aufnahme" ? "Diktat beenden (Enter)" : "Diktieren"}
        aria-pressed={phase === "aufnahme"}
        disabled={disabled || phase === "umwandeln"}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (phase === "aufnahme" ? stoppen() : void starten())}
      >
        {phase === "umwandeln" ? "…" : phase === "aufnahme" ? "■" : "🎤"}
      </button>
      {phase === "aufnahme" && (
        <span className="ki-diktat-info" aria-live="off">
          <span className="mono">{zeitText(sekunden)}</span>
          <span className="ki-diktat-pegel" aria-hidden>
            <span style={{ width: `${Math.round(pegel * 100)}%` }} />
          </span>
        </span>
      )}
      {phase === "umwandeln" && <span className="ki-diktat-info muted">Wird erkannt …</span>}
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
