"use client";

import { useState } from "react";
import { zusammenfassungUebernehmen, zusammenfassungVorschlagen } from "@/app/(hubs)/notizen/ki-actions";
import type { Notiz } from "@/app/(hubs)/notizen/actions";
import { KiDialog, KiVorstufe, useKiTextStatus } from "@/components/ki/ki-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import { zusammenfassungAlsMarkdown, type Luecke } from "@/lib/ki/zusammenfassung";
import { kiFehlerTracken, kiGestartet, kiVorschauAngezeigt, kiVorschauUebernommen } from "@/lib/ki/tracking";

type Punkt = { id: number; text: string; original: string };

/** KI-02: Notiz zusammenfassen und Lücken finden – Vorschau, dann übernehmen. */
export function KiZusammenfassungDialog({
  notizId,
  vorher,
  onUebernommen,
  onSchliessen,
}: {
  notizId: string;
  vorher: () => Promise<void>;
  onUebernommen: (notiz: Notiz, modus: "oben" | "neu") => void;
  onSchliessen: () => void;
}) {
  const ki = useKiTextStatus();
  const [schritt, setSchritt] = useState<"start" | "laeuft" | "vorschau">("start");
  const [fehler, setFehler] = useState<string | null>(null);
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [luecken, setLuecken] = useState<Luecke[]>([]);
  const [mitLuecken, setMitLuecken] = useState(true);
  const [gekuerzt, setGekuerzt] = useState(false);
  const [speichert, setSpeichert] = useState(false);

  async function erstellen() {
    setFehler(null);
    setSchritt("laeuft");
    kiGestartet("ki02");
    const start = performance.now();
    await vorher().catch(() => undefined);
    const a = await zusammenfassungVorschlagen(notizId).catch(() => null);
    if (!a?.ok) {
      const typ = a && !a.ok ? a.typ : "technisch";
      setFehler(a && !a.ok ? a.fehler : "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.");
      kiFehlerTracken("ki02", typ);
      if (typ === "limit") ki.limitErreicht();
      if (typ === "einwilligung") ki.einwilligungFehlt();
      setSchritt(punkte.length ? "vorschau" : "start");
      return;
    }
    setPunkte(a.daten.zusammenfassung.map((t, i) => ({ id: i, text: t, original: t })));
    setLuecken(a.daten.luecken);
    setGekuerzt(a.daten.gekuerzt);
    ki.verbraucht(a.daten.verbleibendHeute);
    kiVorschauAngezeigt("ki02", a.daten.zusammenfassung.length, start);
    setSchritt("vorschau");
  }

  async function uebernehmen(modus: "oben" | "neu") {
    const zusammenfassung = punkte.map((p) => p.text.trim()).filter(Boolean);
    if (!zusammenfassung.length) return;
    setFehler(null);
    setSpeichert(true);
    await vorher().catch(() => undefined);
    const markdown = zusammenfassungAlsMarkdown({ zusammenfassung, luecken }, mitLuecken);
    const a = await zusammenfassungUebernehmen(notizId, markdown, modus).catch(() => null);
    setSpeichert(false);
    if (!a?.ok) {
      setFehler(a && !a.ok ? a.fehler : "Speichern hat nicht geklappt.");
      return;
    }
    kiVorschauUebernommen("ki02", zusammenfassung.length, punkte.filter((p) => p.text !== p.original).length);
    onUebernommen(a.daten.notiz, modus);
  }

  const schliessbar = schritt !== "laeuft" && !speichert;

  return (
    <KiDialog titel="Notiz zusammenfassen" gross={schritt === "vorschau"} schliessbar={schliessbar} onSchliessen={onSchliessen}>
      {ki.phase !== "bereit" ? (
        <KiVorstufe ki={ki} ort="notizen" onSchliessen={onSchliessen} />
      ) : schritt === "laeuft" ? (
        <KiLadeZustand text="Die KI liest deine Notiz …" untertext="Das dauert meist ein paar Sekunden." />
      ) : schritt === "start" ? (
        <>
          <p>Die KI fasst deine Notiz in 3–7 Stichpunkten zusammen und zeigt Stellen, die unklar oder unvollständig wirken.</p>
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <KiLimitHinweis verbleibend={ki.verbleibend} limit={ki.status?.limit ?? 0} />
            <button type="button" className="btnp" disabled={ki.verbleibend === 0} onClick={() => void erstellen()}>
              Zusammenfassen
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="ki-hinweis">⚠️ Prüf die Zusammenfassung, die KI kann sich irren.</p>
          {gekuerzt && <p className="ki-hinweis">✂️ Nur der Anfang der Notiz wurde verwendet.</p>}
          <h4 className="ki-abschnitt">Zusammenfassung</h4>
          <ul className="ki-liste-bearbeiten">
            {punkte.map((p, i) => (
              <li key={p.id}>
                <textarea
                  className="field"
                  rows={2}
                  aria-label={`Stichpunkt ${i + 1}`}
                  value={p.text}
                  maxLength={400}
                  onChange={(e) => setPunkte((l) => l.map((x) => (x.id === p.id ? { ...x, text: e.target.value } : x)))}
                />
                <button type="button" className="icon-knopf" aria-label={`Stichpunkt ${i + 1} entfernen`} onClick={() => setPunkte((l) => l.filter((x) => x.id !== p.id))}>
                  🗑
                </button>
              </li>
            ))}
          </ul>
          <h4 className="ki-abschnitt">Offene Punkte</h4>
          {luecken.length === 0 ? (
            <p className="muted">Die KI hat keine offensichtlichen Lücken gefunden.</p>
          ) : (
            <>
              <ul className="ki-luecken">
                {luecken.map((l, i) => (
                  <li key={i}>
                    <strong>{l.stelle}</strong> – {l.grund}
                  </li>
                ))}
              </ul>
              <label className="ki-check">
                <input type="checkbox" checked={mitLuecken} onChange={(e) => setMitLuecken(e.target.checked)} />
                Offene Punkte als Checkliste mit einfügen
              </label>
            </>
          )}
          <KiFehlerMeldung meldung={fehler} />
          <div className="ki-fuss">
            <button type="button" className="btng" disabled={speichert || ki.verbleibend === 0} onClick={() => void erstellen()} title={`Verbraucht eine weitere KI-Anfrage (heute noch ${ki.verbleibend})`}>
              ↻ Neu erstellen <span className="muted">({ki.verbleibend} übrig)</span>
            </button>
            <span className="ki-knopf-gruppe">
              <button type="button" className="btng" disabled={speichert || !punkte.some((p) => p.text.trim())} onClick={() => void uebernehmen("neu")}>
                Als neue Notiz
              </button>
              <button type="button" className="btnp" disabled={speichert || !punkte.some((p) => p.text.trim())} onClick={() => void uebernehmen("oben")}>
                {speichert ? "Speichert …" : "Oben einfügen"}
              </button>
            </span>
          </div>
        </>
      )}
    </KiDialog>
  );
}
