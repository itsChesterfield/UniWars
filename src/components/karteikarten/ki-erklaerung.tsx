"use client";

import { useEffect, useRef, useState } from "react";
import { KiEinwilligungDialog } from "@/components/ki/ki-einwilligung-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { MarkdownAnzeige } from "@/components/hubs/markdown-editor";
import type { KiErgebnis } from "@/lib/ki/ergebnis";
import { kiFehlerTracken, kiGestartet, kiVorschauAngezeigt } from "@/lib/ki/tracking";

type Zustand = "bereit" | "laedt" | "fertig";

/**
 * KI-11: "✨ Erklär mir das" unter der umgedrehten Karte. Die Antwort wird gestreamt
 * angezeigt und nicht gespeichert. Wechselt die Karte, wird abgebrochen (key am Aufrufer).
 */
export function KiErklaerung({ karteId }: { karteId: string }) {
  const [zustand, setZustand] = useState<Zustand>("bereit");
  const [text, setText] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [einwilligung, setEinwilligung] = useState(false);
  const abbruch = useRef<AbortController | null>(null);

  useEffect(() => () => abbruch.current?.abort(), []);

  async function erklaeren() {
    setFehler(null);
    setText("");
    setZustand("laedt");
    kiGestartet("ki11");
    const start = performance.now();
    const steuerung = new AbortController();
    abbruch.current = steuerung;
    try {
      const antwort = await fetch("/api/ki/erklaeren", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ karteId }),
        signal: steuerung.signal,
      });
      if (!antwort.ok || !antwort.body) {
        const daten = (await antwort.json().catch(() => null)) as KiErgebnis<never> | null;
        const f = daten && !daten.ok ? daten : { fehler: "KI ist gerade nicht verfügbar.", typ: "technisch" as const };
        if (f.typ === "einwilligung") {
          setZustand("bereit");
          setEinwilligung(true);
          return;
        }
        kiFehlerTracken("ki11", f.typ);
        setFehler(f.fehler);
        setZustand("bereit");
        return;
      }
      const leser = antwort.body.getReader();
      const dekoder = new TextDecoder();
      let gesamt = "";
      let erstes = true;
      while (true) {
        const { value, done } = await leser.read();
        if (done) break;
        gesamt += dekoder.decode(value, { stream: true });
        if (erstes) {
          erstes = false;
          kiVorschauAngezeigt("ki11", 1, start);
        }
        setText(gesamt);
      }
      setZustand("fertig");
    } catch {
      if (steuerung.signal.aborted) return;
      setFehler("Die Erklärung wurde unterbrochen. Bitte versuch es noch einmal.");
      setZustand(text ? "fertig" : "bereit");
    }
  }

  return (
    <div className="kk-erklaerung" aria-live="polite">
      {zustand === "bereit" && (
        <button type="button" className="link-knopf kk-erklaer-knopf" onClick={() => void erklaeren()}>
          ✨ Erklär mir das
        </button>
      )}
      {zustand !== "bereit" && (
        <div className="kk-erklaerung-text">
          {zustand === "fertig" ? <MarkdownAnzeige wert={text} /> : <p className="kk-erklaerung-roh">{text || "Die KI denkt nach …"}</p>}
          <p className="faint kk-erklaerung-hinweis">✨ Von der KI erklärt – kann Fehler enthalten. Wird nicht gespeichert.</p>
        </div>
      )}
      <KiFehlerMeldung meldung={fehler} />
      {einwilligung && (
        <KiEinwilligungDialog
          onSchliessen={() => setEinwilligung(false)}
          onZugestimmt={() => {
            setEinwilligung(false);
            void erklaeren();
          }}
        />
      )}
    </div>
  );
}
