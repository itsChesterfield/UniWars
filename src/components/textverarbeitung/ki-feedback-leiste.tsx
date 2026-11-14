"use client";

import { useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { alternativenVorschlagen, feedbackGeben } from "@/app/(hubs)/textverarbeitung/ki-actions";
import { KiVorstufe, useKiTextStatus } from "@/components/ki/ki-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import type { KiFehlerTyp } from "@/lib/ki/fehler";
import {
  ALLE_FOKUS,
  FOKUS,
  fundstelleFinden,
  istEinzelnerSatz,
  MAX_FEEDBACK_ZEICHEN,
  MIN_FEEDBACK_ZEICHEN,
  textKarte,
  type Fokus,
  type Kommentar,
  type TextStueck,
} from "@/lib/ki/feedback";
import { kiFehlerTracken, kiGestartet, kiVorschauAngezeigt, kiVorschauUebernommen } from "@/lib/ki/tracking";
import { track } from "@/lib/analytics";

/** Text des Editors mit Zuordnung Zeichen → Editor-Position (Absätze durch \n getrennt). */
function editorKarte(editor: Editor) {
  const stuecke: TextStueck[] = [];
  let neu = true;
  editor.state.doc.descendants((knoten, pos) => {
    if (knoten.isTextblock) neu = true;
    else if (knoten.isText) {
      stuecke.push({ text: knoten.text ?? "", pos, neuerBlock: neu });
      neu = false;
    }
    return true;
  });
  return textKarte(stuecke);
}

function indexAb(karte: ReturnType<typeof editorKarte>, pos: number): number {
  for (let i = 0; i < karte.text.length; i++) if (karte.position(i) >= pos) return i;
  return 0;
}

/** Zitat im aktuellen Editor-Inhalt suchen und als Editor-Bereich zurückgeben. */
function bereichFinden(editor: Editor, zitat: string, abPos: number): { from: number; to: number } | null {
  const karte = editorKarte(editor);
  const f = fundstelleFinden(karte.text, zitat, indexAb(karte, abPos));
  if (!f) return null;
  return { from: karte.position(f.start), to: karte.position(f.ende - 1) + 1 };
}

type Ergebnis = { kommentare: Kommentar[]; gefunden: boolean[]; auswahl: boolean; abPos: number };
type Satz = { text: string; from: number; to: number };

/**
 * KI-06: Feedback-Seitenleiste im Dokument-Editor. Die KI gibt nur Hinweise (keine neuen
 * Absätze); Klick auf einen Hinweis markiert die Fundstelle. Nichts wird gespeichert.
 */
export function KiFeedbackLeiste({ editor, dokumentId, onSchliessen }: { editor: Editor; dokumentId: string; onSchliessen: () => void }) {
  const ki = useKiTextStatus();
  const [fokus, setFokus] = useState<Fokus[]>(ALLE_FOKUS);
  const [laeuft, setLaeuft] = useState<"feedback" | "satz" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [alternativen, setAlternativen] = useState<{ satz: Satz; liste: string[] } | null>(null);
  const [eingeklappt, setEingeklappt] = useState(false);

  // Was wird geprüft? Markierter Text oder ganzes Dokument
  const umfang = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const { from, to } = e.state.selection;
      const auswahl = from === to ? "" : e.state.doc.textBetween(from, to, "\n").trim();
      const gesamt = e.getText({ blockSeparator: "\n" }).trim();
      return { from, to, auswahl, zeichen: auswahl ? auswahl.length : gesamt.length, woerter: (auswahl || gesamt).split(/\s+/).filter(Boolean).length };
    },
    equalityFn: (a, b) => a?.from === b?.from && a?.to === b?.to && a?.zeichen === b?.zeichen,
  });

  const istAuswahl = Boolean(umfang.auswahl);
  const zuLang = umfang.zeichen > MAX_FEEDBACK_ZEICHEN;
  const zuKurz = umfang.zeichen < MIN_FEEDBACK_ZEICHEN;
  const satz = istAuswahl && istEinzelnerSatz(umfang.auswahl) ? { text: umfang.auswahl, from: umfang.from, to: umfang.to } : null;

  function fehlerZeigen(a: { fehler: string; typ: KiFehlerTyp } | null) {
    const typ = a?.typ ?? "technisch";
    setFehler(a?.fehler ?? "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.");
    kiFehlerTracken("ki06", typ);
    if (typ === "limit") ki.limitErreicht();
    if (typ === "einwilligung") ki.einwilligungFehlt();
  }

  async function feedbackHolen() {
    if (zuLang || zuKurz || fokus.length === 0) return;
    setFehler(null);
    setAktiv(null);
    setLaeuft("feedback");
    kiGestartet("ki06");
    const start = performance.now();
    const text = istAuswahl ? umfang.auswahl : editorKarte(editor).text;
    const a = await feedbackGeben(dokumentId, { text, fokus, auswahl: istAuswahl }).catch(() => null);
    setLaeuft(null);
    if (!a?.ok) return fehlerZeigen(a && !a.ok ? a : null);
    const abPos = istAuswahl ? umfang.from : 0;
    const gefunden = a.daten.kommentare.map((k) => Boolean(k.zitat && bereichFinden(editor, k.zitat, abPos)));
    setErgebnis({ kommentare: a.daten.kommentare, gefunden, auswahl: istAuswahl, abPos });
    ki.verbraucht(a.daten.verbleibendHeute);
    kiVorschauAngezeigt("ki06", a.daten.kommentare.length, start);
    track("ki_feedback_fundstellen", { anzahl: gefunden.length, gefunden: gefunden.filter(Boolean).length });
  }

  function zeigen(i: number) {
    if (!ergebnis) return;
    const k = ergebnis.kommentare[i];
    const bereich = k.zitat ? bereichFinden(editor, k.zitat, ergebnis.abPos) : null;
    if (!bereich) {
      setErgebnis({ ...ergebnis, gefunden: ergebnis.gefunden.map((g, j) => (j === i ? false : g)) });
      return;
    }
    setAktiv(i);
    editor.chain().focus().setTextSelection(bereich).scrollIntoView().run();
    // In langen Dokumenten zuverlässig in die Mitte scrollen
    const dom = editor.view.domAtPos(bereich.from).node;
    (dom instanceof HTMLElement ? dom : dom.parentElement)?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (window.matchMedia("(max-width: 900px)").matches) setEingeklappt(true);
  }

  async function alternativenHolen(s: Satz) {
    setFehler(null);
    setLaeuft("satz");
    kiGestartet("ki06");
    const start = performance.now();
    const kontext = editor.state.doc.resolve(s.from).parent.textContent;
    const a = await alternativenVorschlagen(dokumentId, s.text, kontext).catch(() => null);
    setLaeuft(null);
    if (!a?.ok) return fehlerZeigen(a && !a.ok ? a : null);
    ki.verbraucht(a.daten.verbleibendHeute);
    kiVorschauAngezeigt("ki06", a.daten.alternativen.length, start);
    setAlternativen({ satz: s, liste: a.daten.alternativen });
  }

  function uebernehmen(variante: string) {
    if (!alternativen) return;
    const { satz: s } = alternativen;
    // Nur ersetzen, wenn der Satz noch unverändert an derselben Stelle steht
    const jetzt = editor.state.doc.textBetween(s.from, Math.min(s.to, editor.state.doc.content.size), "\n").trim();
    if (jetzt !== s.text) {
      setFehler("Der Satz wurde inzwischen geändert. Markiere ihn neu.");
      setAlternativen(null);
      return;
    }
    editor.chain().focus().insertContentAt({ from: s.from, to: s.to }, { type: "text", text: variante }).run();
    kiVorschauUebernommen("ki06", 1, 0);
    setAlternativen(null);
  }

  if (eingeklappt) {
    return (
      <aside className="txt-ki-leiste eingeklappt" aria-label="KI-Feedback">
        <button type="button" className="btnp" onClick={() => setEingeklappt(false)}>
          ✨ Zurück zum Feedback
        </button>
      </aside>
    );
  }

  return (
    <aside className="txt-ki-leiste" aria-label="KI-Feedback">
      <div className="rowb">
        <h3>✨ Feedback</h3>
        <button type="button" className="icon-knopf" aria-label="Feedback schließen" onClick={onSchliessen}>
          ✕
        </button>
      </div>

      {ki.phase !== "bereit" ? (
        <KiVorstufe ki={ki} ort="textverarbeitung" onSchliessen={onSchliessen} />
      ) : (
        <>
          <p className="muted txt-ki-grundsatz">Die KI gibt Hinweise zu deinem Text – sie schreibt ihn nicht für dich.</p>
          <p className="txt-ki-umfang">
            <strong>{istAuswahl ? "Markierter Text" : "Ganzes Dokument"}</strong> · {umfang.woerter.toLocaleString("de-DE")} Wörter
            {!istAuswahl && <span className="muted"> (markiere Text, um nur einen Abschnitt zu prüfen)</span>}
          </p>
          {zuLang && <p className="ki-hinweis">Das sind mehr als 20.000 Zeichen. Markiere einen Abschnitt, z. B. ein Kapitel.</p>}
          {zuKurz && !zuLang && (
            <p className="muted">
              {istAuswahl
                ? "Die Markierung ist zu kurz für Feedback. Klick in den Text, um das ganze Dokument zu prüfen."
                : "Schreib etwas mehr Text für Feedback."}
            </p>
          )}

          <fieldset className="txt-ki-fokus">
            <legend>Worauf soll die KI achten?</legend>
            {ALLE_FOKUS.map((f) => (
              <label key={f} className="ki-check">
                <input
                  type="checkbox"
                  checked={fokus.includes(f)}
                  onChange={(e) => setFokus((alt) => (e.target.checked ? [...alt, f] : alt.filter((x) => x !== f)))}
                />
                {FOKUS[f]}
              </label>
            ))}
          </fieldset>

          <div className="ki-fuss">
            <KiLimitHinweis verbleibend={ki.verbleibend} limit={ki.status?.limit ?? 0} />
            <button
              type="button"
              className="btnp"
              disabled={Boolean(laeuft) || zuLang || zuKurz || fokus.length === 0 || ki.verbleibend === 0}
              onClick={() => void feedbackHolen()}
            >
              {ergebnis ? "Neu prüfen" : "Feedback holen"}
            </button>
          </div>

          {satz && !laeuft && (
            <div className="txt-ki-satz">
              <button type="button" className="btng" disabled={ki.verbleibend === 0} onClick={() => void alternativenHolen(satz)}>
                Alternative Formulierung zeigen
              </button>
            </div>
          )}

          <KiFehlerMeldung meldung={fehler} />
          {laeuft && <KiLadeZustand text={laeuft === "satz" ? "Die KI sucht Formulierungen …" : "Die KI liest deinen Text …"} />}

          {alternativen && !laeuft && (
            <section className="txt-ki-alternativen" aria-label="Alternative Formulierungen">
              <h4 className="ki-abschnitt">Alternative Formulierungen</h4>
              {alternativen.liste.length === 0 ? (
                <p className="muted">Die KI hat keine bessere Formulierung gefunden.</p>
              ) : (
                <ul>
                  {alternativen.liste.map((v) => (
                    <li key={v}>
                      <p>{v}</p>
                      <button type="button" className="btng" onClick={() => uebernehmen(v)}>
                        Übernehmen
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="link-knopf" onClick={() => setAlternativen(null)}>
                Verwerfen
              </button>
            </section>
          )}

          {ergebnis && !laeuft && (
            <section className="txt-ki-kommentare" aria-label="Hinweise der KI" aria-live="polite">
              <h4 className="ki-abschnitt">
                {ergebnis.kommentare.length} {ergebnis.kommentare.length === 1 ? "Hinweis" : "Hinweise"}
                {ergebnis.auswahl ? " zum markierten Text" : ""}
              </h4>
              {ergebnis.kommentare.length === 0 && <p className="muted">Die KI hat nichts Wesentliches gefunden.</p>}
              <ul>
                {ergebnis.kommentare.map((k, i) => (
                  <li key={k.id}>
                    <button
                      type="button"
                      className={`txt-ki-kommentar ${aktiv === i ? "aktiv" : ""}`}
                      onClick={() => zeigen(i)}
                      aria-label={`Hinweis ${i + 1}: ${k.problem}${ergebnis.gefunden[i] ? "" : " (Stelle nicht gefunden)"}`}
                    >
                      <span className={`txt-ki-fokus-tag fokus-${k.fokus}`}>{FOKUS[k.fokus]}</span>
                      {k.zitat && <q className="txt-ki-zitat">{k.zitat}</q>}
                      {!ergebnis.gefunden[i] && <span className="txt-ki-nicht-gefunden">Stelle nicht gefunden</span>}
                      <span className="txt-ki-problem">{k.problem}</span>
                      <span className="txt-ki-hinweis">💡 {k.hinweis}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="faint txt-ki-fuss">✨ Von der KI – kann sich irren. Wird nicht gespeichert.</p>
            </section>
          )}
        </>
      )}
    </aside>
  );
}
