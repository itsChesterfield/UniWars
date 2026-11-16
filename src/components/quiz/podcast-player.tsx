"use client";

import { useEffect, useRef, useState } from "react";
import { aktivHalten } from "@/lib/inaktivitaet";
import Link from "next/link";
import { KiEinwilligungDialog } from "@/components/ki/ki-einwilligung-dialog";
import { SPRECHER_NAME, type PodcastSegment } from "@/lib/ki/quiz";
import { track } from "@/lib/analytics";

type Fehler = { fehler: string; typ: string; art?: "text" | "audio" };

/** Abspieler für den Lern-Podcast: Abschnitt für Abschnitt vorgelesen (zwei Stimmen), der nächste lädt vorab */
export function PodcastPlayer({ titel, segmente, vorlesen }: { titel: string; segmente: PodcastSegment[]; vorlesen: boolean }) {
  const [aktuell, setAktuell] = useState(0);
  const [spielt, setSpielt] = useState(false);
  useEffect(() => {
    aktivHalten("podcast", spielt);
    return () => aktivHalten("podcast", false);
  }, [spielt]);
  const [laedt, setLaedt] = useState(false);
  const [tempo, setTempo] = useState(1);
  const [fehler, setFehler] = useState<string | null>(null);
  const [einwilligung, setEinwilligung] = useState<"text" | "audio" | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef(new Map<number, Promise<string>>());
  const lauf = useRef(0);
  const liste = useRef<HTMLOListElement>(null);

  function laden(i: number): Promise<string> {
    const vorhanden = cache.current.get(i);
    if (vorhanden) return vorhanden;
    const p = fetch("/api/ki/vorlesen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: segmente[i].text, sprecher: segmente[i].sprecher }),
    }).then(async (r) => {
      if (!r.ok) throw ((await r.json().catch(() => null)) as Fehler | null) ?? { fehler: "Vorlesen ist gerade nicht möglich.", typ: "technisch" };
      return URL.createObjectURL(await r.blob());
    });
    p.catch(() => cache.current.delete(i));
    cache.current.set(i, p);
    return p;
  }

  async function abspielenAb(start: number) {
    const meinLauf = ++lauf.current;
    setFehler(null);
    setSpielt(true);
    if (!audio.current) audio.current = new Audio();
    const a = audio.current;
    try {
      for (let i = start; i < segmente.length; i++) {
        setAktuell(i);
        setLaedt(true);
        const url = await laden(i);
        if (i + 1 < segmente.length) void laden(i + 1).catch(() => undefined);
        if (lauf.current !== meinLauf) return;
        setLaedt(false);
        a.src = url;
        a.playbackRate = tempo;
        await a.play();
        if (i === start && start === 0) track("podcast_abgespielt", { abschnitte: segmente.length });
        await new Promise<void>((weiter, fehlt) => {
          a.onended = () => weiter();
          a.onerror = () => fehlt(new Error("Abspielen fehlgeschlagen"));
          a.onpause = () => {
            if (lauf.current !== meinLauf) weiter();
          };
        });
        if (lauf.current !== meinLauf) return;
      }
      setSpielt(false);
    } catch (err) {
      if (lauf.current !== meinLauf) return;
      setSpielt(false);
      setLaedt(false);
      const f = err as Partial<Fehler>;
      if (f?.typ === "einwilligung") setEinwilligung(f.art ?? "audio");
      else setFehler(typeof f?.fehler === "string" ? f.fehler : "Abspielen hat nicht geklappt.");
    }
  }

  function anhalten() {
    lauf.current++;
    audio.current?.pause();
    setSpielt(false);
    setLaedt(false);
  }

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = tempo;
  }, [tempo]);

  useEffect(() => {
    const urls = cache.current;
    const laeufe = lauf;
    return () => {
      laeufe.current++;
      audio.current?.pause();
      for (const p of urls.values()) void p.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
    };
  }, []);

  // aktuellen Abschnitt im Blick behalten
  useEffect(() => {
    liste.current?.querySelector(`[data-nr="${aktuell}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [aktuell]);

  // Leertaste: Abspielen/Pause
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== " " || (e.target as HTMLElement)?.closest?.("input, textarea, select, button")) return;
      e.preventDefault();
      if (spielt) anhalten();
      else void abspielenAb(aktuell);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  });

  return (
    <div className="pc-seite">
      <div className="card pc-kopf">
        <Link href="/transkription" className="faint pc-zurueck">
          ← Transkription
        </Link>
        <h1 className="pc-titel">🎧 {titel}</h1>
        <p className="muted">
          {SPRECHER_NAME[1]} & {SPRECHER_NAME[2]} · {segmente.length} Abschnitte
        </p>
        {vorlesen ? (
          <div className="pc-steuerung">
            <button type="button" className="icon-knopf" aria-label="Zurück" disabled={aktuell === 0} onClick={() => void abspielenAb(Math.max(0, aktuell - 1))}>
              ⏮
            </button>
            <button type="button" className="btnp pc-play" onClick={() => (spielt ? anhalten() : void abspielenAb(aktuell))}>
              {laedt ? "…" : spielt ? "❚❚ Pause" : aktuell > 0 ? "▶ Weiter" : "▶ Abspielen"}
            </button>
            <button type="button" className="icon-knopf" aria-label="Vor" disabled={aktuell >= segmente.length - 1} onClick={() => void abspielenAb(Math.min(segmente.length - 1, aktuell + 1))}>
              ⏭
            </button>
            <select className="field pc-tempo" aria-label="Tempo" value={tempo} onChange={(e) => setTempo(Number(e.target.value))}>
              {[0.75, 1, 1.25, 1.5, 1.75, 2].map((t) => (
                <option key={t} value={t}>
                  {t}×
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="faint">Sprachausgabe ist nicht eingerichtet – du kannst das Skript lesen.</p>
        )}
        <div className="pc-balken" aria-hidden>
          <div style={{ width: `${((aktuell + (spielt ? 0.5 : 0)) / segmente.length) * 100}%` }} />
        </div>
        {fehler && <p className="auth-error">{fehler}</p>}
      </div>

      <ol className="pc-skript" ref={liste}>
        {segmente.map((s, i) => (
          <li key={i} data-nr={i} className={`pc-segment sprecher-${s.sprecher} ${i === aktuell ? "aktuell" : ""}`}>
            <button type="button" className="pc-segment-knopf" onClick={() => (vorlesen ? void abspielenAb(i) : setAktuell(i))} title="Ab hier abspielen">
              <span className="pc-sprecher">{SPRECHER_NAME[s.sprecher]}</span>
              <span>{s.text}</span>
            </button>
          </li>
        ))}
      </ol>
      {einwilligung && (
        <KiEinwilligungDialog
          art={einwilligung}
          onSchliessen={() => setEinwilligung(null)}
          onZugestimmt={() => {
            setEinwilligung(null);
            cache.current.clear();
            void abspielenAb(aktuell);
          }}
        />
      )}
    </div>
  );
}
