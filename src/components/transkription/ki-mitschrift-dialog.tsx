"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mitschriftAbschnitt, mitschriftPlan, mitschriftUebernehmen, mitschriftZusammenfuehren } from "@/app/(hubs)/transkription/actions";
import { KiDialog, KiVorstufe, useKiTextStatus } from "@/components/ki/ki-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import { MarkdownAnzeige } from "@/components/hubs/markdown-editor";
import type { KiFehlerTyp } from "@/lib/ki/fehler";
import { kiFehlerTracken, kiGestartet, kiVorschauAngezeigt, kiVorschauUebernommen } from "@/lib/ki/tracking";

type Plan = { abschnitte: number; anfragen: number };

/**
 * KI-04: Transkript → gegliederte Mitschrift. Lange Transkripte werden abschnittsweise
 * aufbereitet und zusammengeführt (jeder Schritt eine Anfrage, vorher angezeigt).
 * Bricht ein Schritt ab, bleiben die fertigen Abschnitte erhalten und es geht dort weiter.
 */
export function KiMitschriftDialog({ transkriptId, onSchliessen }: { transkriptId: string; onSchliessen: () => void }) {
  const ki = useKiTextStatus();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [schritt, setSchritt] = useState<"plan" | "laeuft" | "vorschau" | "fertig">("plan");
  const [fortschritt, setFortschritt] = useState("");
  const [teile, setTeile] = useState<string[]>([]);
  const [markdown, setMarkdown] = useState("");
  const [original, setOriginal] = useState("");
  const [ansicht, setAnsicht] = useState<"vorschau" | "bearbeiten">("vorschau");
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [notizId, setNotizId] = useState<string | null>(null);

  const { phase, verbraucht } = ki;
  useEffect(() => {
    if (phase !== "bereit" || plan) return;
    let abgebrochen = false;
    mitschriftPlan(transkriptId)
      .catch(() => null)
      .then((a) => {
        if (abgebrochen) return;
        if (!a?.ok) {
          setFehler(a && !a.ok ? a.fehler : "Da ist etwas schiefgelaufen.");
          return;
        }
        setPlan({ abschnitte: a.daten.abschnitte, anfragen: a.daten.anfragen });
        verbraucht(a.daten.verbleibendHeute);
      });
    return () => {
      abgebrochen = true;
    };
  }, [phase, verbraucht, plan, transkriptId]);

  function fehlerZeigen(a: { fehler: string; typ: KiFehlerTyp } | null) {
    const typ = a?.typ ?? "technisch";
    setFehler(a?.fehler ?? "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.");
    kiFehlerTracken("ki04", typ);
    if (typ === "limit") ki.limitErreicht();
    if (typ === "einwilligung") ki.einwilligungFehlt();
  }

  async function erstellen() {
    if (!plan) return;
    setFehler(null);
    setSchritt("laeuft");
    kiGestartet("ki04");
    const start = performance.now();
    const fertig = [...teile];
    // Abschnitte, die schon fertig sind, werden nicht noch einmal gebucht
    for (let nr = fertig.length + 1; nr <= plan.abschnitte; nr++) {
      setFortschritt(plan.abschnitte > 1 ? `Abschnitt ${nr} von ${plan.abschnitte} …` : "Die KI gliedert dein Transkript …");
      const a = await mitschriftAbschnitt(transkriptId, nr).catch(() => null);
      if (!a?.ok) {
        fehlerZeigen(a && !a.ok ? a : null);
        setSchritt(markdown ? "vorschau" : "plan");
        return;
      }
      fertig.push(a.daten.markdown);
      setTeile([...fertig]);
      ki.verbraucht(a.daten.verbleibendHeute);
    }
    let ergebnis = fertig[0];
    if (plan.abschnitte > 1) {
      setFortschritt("Alles wird zusammengeführt …");
      const a = await mitschriftZusammenfuehren(transkriptId, fertig).catch(() => null);
      if (!a?.ok) {
        fehlerZeigen(a && !a.ok ? a : null);
        setSchritt("plan");
        return;
      }
      ergebnis = a.daten.markdown;
      ki.verbraucht(a.daten.verbleibendHeute);
    }
    setMarkdown(ergebnis);
    setOriginal(ergebnis);
    setTeile([]);
    setAnsicht("vorschau");
    kiVorschauAngezeigt("ki04", 1, start);
    setSchritt("vorschau");
  }

  async function uebernehmen() {
    setFehler(null);
    setSpeichert(true);
    const a = await mitschriftUebernehmen(transkriptId, markdown).catch(() => null);
    setSpeichert(false);
    if (!a?.ok) {
      setFehler(a && !a.ok ? a.fehler : "Speichern hat nicht geklappt.");
      return;
    }
    kiVorschauUebernommen("ki04", 1, markdown !== original ? 1 : 0);
    setNotizId(a.daten.notizId);
    setSchritt("fertig");
  }

  const genug = plan ? ki.verbleibend >= plan.anfragen - teile.length : false;

  return (
    <KiDialog titel="Als Notiz aufbereiten" gross={schritt === "vorschau"} schliessbar={schritt !== "laeuft" && !speichert} onSchliessen={onSchliessen}>
      {ki.phase !== "bereit" ? (
        <KiVorstufe ki={ki} ort="transkription" onSchliessen={onSchliessen} />
      ) : schritt === "laeuft" ? (
        <KiLadeZustand text={fortschritt} untertext="Bitte lass dieses Fenster offen." />
      ) : schritt === "fertig" && notizId ? (
        <div className="ki-mitte">
          <div className="hub-leer-icon" aria-hidden>
            🎉
          </div>
          <p>Die Mitschrift wurde als neue Notiz gespeichert.</p>
          <div className="hub-formular-knoepfe">
            <button type="button" className="btng" onClick={onSchliessen}>
              Schließen
            </button>
            <Link href={`/notizen?id=${notizId}`} className="btnp">
              Notiz öffnen
            </Link>
          </div>
        </div>
      ) : schritt === "vorschau" ? (
        <>
          <p className="ki-hinweis">⚠️ Prüf die Mitschrift, die KI kann sich verhören oder irren.</p>
          <div className="segwrap" role="tablist">
            <button type="button" role="tab" aria-selected={ansicht === "vorschau"} className={`seg ${ansicht === "vorschau" ? "on" : ""}`} onClick={() => setAnsicht("vorschau")}>
              Vorschau
            </button>
            <button type="button" role="tab" aria-selected={ansicht === "bearbeiten"} className={`seg ${ansicht === "bearbeiten" ? "on" : ""}`} onClick={() => setAnsicht("bearbeiten")}>
              Bearbeiten
            </button>
          </div>
          {ansicht === "vorschau" ? (
            <div className="tra-mitschrift-vorschau">
              <MarkdownAnzeige key={markdown} wert={markdown} />
            </div>
          ) : (
            <textarea className="field tra-mitschrift-text" aria-label="Mitschrift bearbeiten" value={markdown} maxLength={100_000} onChange={(e) => setMarkdown(e.target.value)} />
          )}
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <span className="muted">Wird als neue Notiz gespeichert, das Transkript bleibt.</span>
            <button type="button" className="btnp" disabled={speichert || !markdown.trim()} onClick={() => void uebernehmen()}>
              {speichert ? "Speichert …" : "Als Notiz speichern"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Die KI macht aus dem gesprochenen Text eine gegliederte Mitschrift: Überschriften, Stichpunkte, ohne Füllwörter. Du siehst sie vor dem Speichern.</p>
          {plan ? (
            <p className="ki-hinweis">
              {plan.abschnitte > 1
                ? `Das Transkript ist lang und wird in ${plan.abschnitte} Abschnitten aufbereitet und dann zusammengeführt. Das kostet ${plan.anfragen} KI-Anfragen.`
                : "Das kostet 1 KI-Anfrage."}
              {teile.length > 0 && ` ${teile.length} Abschnitt${teile.length === 1 ? " ist" : "e sind"} schon fertig und wird nicht noch einmal berechnet.`}
            </p>
          ) : (
            !fehler && <KiLadeZustand text="Lädt …" />
          )}
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <KiLimitHinweis verbleibend={ki.verbleibend} limit={ki.status?.limit ?? 0} />
            <button type="button" className="btnp" disabled={!plan || !genug} onClick={() => void erstellen()} title={plan && !genug ? "Dafür reichen deine KI-Anfragen heute nicht mehr." : undefined}>
              {teile.length ? "Weiter aufbereiten" : "Aufbereiten"}
            </button>
          </div>
          {plan && !genug && <p className="muted">Dafür reichen deine KI-Anfragen heute nicht mehr. Morgen geht es weiter.</p>}
        </>
      )}
    </KiDialog>
  );
}
