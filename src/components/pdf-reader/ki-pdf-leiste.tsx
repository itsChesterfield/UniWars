"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfKartenVorschlagen } from "@/app/(hubs)/pdf-reader/ki-actions";
import { KiVorstufe, useKiTextStatus } from "@/components/ki/ki-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import { KiKartenDialog } from "@/components/notizen/ki-karten-dialog";
import type { KiErgebnis } from "@/lib/ki/ergebnis";
import { MAX_NOTIZ_ZEICHEN } from "@/lib/ki/karten";
import {
  hatLesbarenText,
  MAX_FRAGE_ZEICHEN,
  seitenBereich,
  seitenFuerFrage,
  seitenVerweise,
  type PdfSeite,
} from "@/lib/ki/pdf-kontext";
import { kiFehlerTracken, kiGestartet, kiVorschauAngezeigt } from "@/lib/ki/tracking";

type Tab = "fragen" | "zusammenfassen" | "karten";
type Eintrag = { id: number; frage: string; antwort: string; fertig: boolean; seiten: number[] };

/** Bereich ±2 um die aktuelle Seite */
function standardBereich(seite: number, anzahl: number): [number, number] {
  return [Math.max(1, seite - 2), Math.min(Math.max(1, anzahl), seite + 2)];
}

function kurzBereich(seiten: number[]): string {
  if (!seiten.length) return "";
  const teile: string[] = [];
  let start = seiten[0];
  let vorher = seiten[0];
  for (const s of [...seiten.slice(1), Number.NaN]) {
    if (s === vorher + 1) {
      vorher = s;
      continue;
    }
    teile.push(start === vorher ? `${start}` : `${start}–${vorher}`);
    start = s;
    vorher = s;
  }
  return `S. ${teile.join(", ")}`;
}

/** Fett (**…**) und Seitenverweise als Links – sonst reiner Text. */
function Inline({ text, maxSeite, onSeite }: { text: string; maxSeite: number; onSeite: (s: number) => void }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((stueck, i) => {
        const fett = /^\*\*[^*]+\*\*$/.test(stueck);
        const inhalt = seitenVerweise(fett ? stueck.slice(2, -2) : stueck, maxSeite).map((t, j) =>
          t.typ === "text" ? (
            <Fragment key={j}>{t.text}</Fragment>
          ) : (
            <button key={j} type="button" className="ki-seitenlink" title={`Zu Seite ${t.seite}`} onClick={() => onSeite(t.seite)}>
              {t.label}
            </button>
          ),
        );
        return fett ? <strong key={i}>{inhalt}</strong> : <Fragment key={i}>{inhalt}</Fragment>;
      })}
    </>
  );
}

/** Kleine Markdown-Anzeige (Absätze, Listen, Fett) mit klickbaren Seitenzahlen. */
export function AntwortText({ text, maxSeite, onSeite }: { text: string; maxSeite: number; onSeite: (s: number) => void }) {
  const bloecke: { liste: boolean; zeilen: string[] }[] = [];
  for (const zeile of text.split("\n")) {
    const punkt = zeile.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    const letzter = bloecke[bloecke.length - 1];
    if (!zeile.trim()) {
      bloecke.push({ liste: false, zeilen: [] });
    } else if (punkt) {
      if (letzter?.liste) letzter.zeilen.push(punkt[1]);
      else bloecke.push({ liste: true, zeilen: [punkt[1]] });
    } else if (letzter && !letzter.liste && letzter.zeilen.length) {
      letzter.zeilen.push(zeile.replace(/^#+\s*/, ""));
    } else {
      bloecke.push({ liste: false, zeilen: [zeile.replace(/^#+\s*/, "")] });
    }
  }
  return (
    <div className="ki-antwort">
      {bloecke
        .filter((b) => b.zeilen.length)
        .map((b, i) =>
          b.liste ? (
            <ul key={i}>
              {b.zeilen.map((z, j) => (
                <li key={j}>
                  <Inline text={z} maxSeite={maxSeite} onSeite={onSeite} />
                </li>
              ))}
            </ul>
          ) : (
            <p key={i}>
              <Inline text={b.zeilen.join(" ")} maxSeite={maxSeite} onSeite={onSeite} />
            </p>
          ),
        )}
    </div>
  );
}

/** Liest den Antwort-Stream; Fehler vor dem ersten Textstück kommen als JSON. */
async function streamLesen(
  body: unknown,
  signal: AbortSignal,
  onText: (gesamt: string) => void,
): Promise<{ ok: true; verbleibend: number | null } | { ok: false; fehler: string; typ: string }> {
  const antwort = await fetch("/api/ki/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!antwort.ok || !antwort.body) {
    const daten = (await antwort.json().catch(() => null)) as KiErgebnis<never> | null;
    return daten && !daten.ok ? daten : { ok: false, fehler: "KI ist gerade nicht verfügbar.", typ: "technisch" };
  }
  const kopf = antwort.headers.get("x-ki-verbleibend");
  const leser = antwort.body.getReader();
  const dekoder = new TextDecoder();
  let gesamt = "";
  while (true) {
    const { value, done } = await leser.read();
    if (done) break;
    gesamt += dekoder.decode(value, { stream: true });
    onText(gesamt);
  }
  return { ok: true, verbleibend: kopf === null ? null : Number(kopf) };
}

/**
 * KI-03: KI-Seitenleiste im PDF Reader. Der Text wird im Browser mit pdf.js gelesen;
 * an die KI gehen nur die ausgewählten Seiten. Verlauf nur in dieser Sitzung (nicht gespeichert).
 */
export function KiPdfLeiste({
  doc,
  datei,
  seite,
  seitenText,
  onSeite,
  onSchliessen,
}: {
  doc: PDFDocumentProxy;
  datei: { id: string; name: string };
  seite: number;
  seitenText: (nr: number) => Promise<string[]>;
  onSeite: (nr: number) => void;
  onSchliessen: () => void;
}) {
  const ki = useKiTextStatus();
  const anzahl = doc.numPages;
  const [tab, setTab] = useState<Tab>("fragen");
  const [seiten, setSeiten] = useState<PdfSeite[] | null>(null);
  const [gelesen, setGelesen] = useState(0);
  const [frage, setFrage] = useState("");
  const [verlauf, setVerlauf] = useState<Eintrag[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bereich, setBereich] = useState<[number, number]>(() => standardBereich(seite, anzahl));
  const [zusammenfassung, setZusammenfassung] = useState<{ text: string; seiten: number[]; fertig: boolean; gekuerzt: boolean } | null>(null);
  const [kartenOffen, setKartenOffen] = useState(false);
  /** Handy: nach Klick auf eine Seitenzahl einklappen, damit die Seite sichtbar ist (Verlauf bleibt) */
  const [eingeklappt, setEingeklappt] = useState(false);
  const abbruch = useRef<AbortController | null>(null);
  const verlaufEnde = useRef<HTMLDivElement>(null);

  useEffect(() => () => abbruch.current?.abort(), []);

  // Text aller Seiten im Browser lesen (für Relevanz-Suche und Bereiche)
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      const liste: PdfSeite[] = [];
      for (let nr = 1; nr <= anzahl; nr++) {
        const teile = await seitenText(nr).catch(() => [] as string[]);
        if (abgebrochen) return;
        liste.push({ seite: nr, text: teile.join(" ").replace(/\s+/g, " ").trim() });
        if (nr % 5 === 0 || nr === anzahl) setGelesen(nr);
      }
      if (!abgebrochen) setSeiten(liste);
    })();
    return () => {
      abgebrochen = true;
    };
  }, [anzahl, seitenText]);

  useEffect(() => {
    verlaufEnde.current?.scrollIntoView({ block: "nearest" });
  }, [verlauf]);

  const lesbar = seiten ? hatLesbarenText(seiten) : true;

  function zurSeite(nr: number) {
    onSeite(nr);
    if (window.matchMedia("(max-width: 760px)").matches) setEingeklappt(true);
  }

  function fehlerBehandeln(f: { fehler: string; typ: string }) {
    if (f.typ === "einwilligung") {
      ki.einwilligungFehlt();
      return;
    }
    if (f.typ === "limit") ki.limitErreicht();
    kiFehlerTracken("ki03", f.typ as Parameters<typeof kiFehlerTracken>[1]);
    setFehler(f.fehler);
  }

  async function fragen() {
    const text = frage.trim();
    if (!seiten || !text || laeuft) return;
    const kontext = seitenFuerFrage(seiten, text, seite);
    const id = Date.now();
    const eintrag: Eintrag = { id, frage: text, antwort: "", fertig: false, seiten: kontext.map((s) => s.seite) };
    setFehler(null);
    setLaeuft(true);
    setFrage("");
    setVerlauf((v) => [...v, eintrag]);
    kiGestartet("ki03");
    const start = performance.now();
    const steuerung = new AbortController();
    abbruch.current = steuerung;
    let erstes = true;
    const aendern = (teil: Partial<Eintrag>) => setVerlauf((v) => v.map((e) => (e.id === id ? { ...e, ...teil } : e)));
    try {
      const r = await streamLesen({ dateiId: datei.id, modus: "frage", frage: text, seiten: kontext, aktuelleSeite: seite }, steuerung.signal, (gesamt) => {
        if (erstes) {
          erstes = false;
          kiVorschauAngezeigt("ki03", 1, start);
        }
        aendern({ antwort: gesamt });
      });
      if (!r.ok) {
        setVerlauf((v) => v.filter((e) => e.id !== id));
        setFrage(text);
        fehlerBehandeln(r);
      } else {
        aendern({ fertig: true });
        ki.verbraucht(r.verbleibend ?? Math.max(0, ki.verbleibend - 1));
      }
    } catch {
      if (!steuerung.signal.aborted) {
        setFehler("Die Antwort wurde unterbrochen. Bitte versuch es noch einmal.");
        aendern({ fertig: true });
      }
    } finally {
      setLaeuft(false);
    }
  }

  async function zusammenfassen() {
    if (!seiten || laeuft) return;
    const { seiten: auswahl, gekuerzt } = seitenBereich(seiten, bereich[0], bereich[1]);
    if (!auswahl.length) {
      setFehler("Auf diesen Seiten steht kein lesbarer Text.");
      return;
    }
    setFehler(null);
    setLaeuft(true);
    setZusammenfassung({ text: "", seiten: auswahl.map((s) => s.seite), fertig: false, gekuerzt });
    kiGestartet("ki03");
    const start = performance.now();
    const steuerung = new AbortController();
    abbruch.current = steuerung;
    let erstes = true;
    try {
      const r = await streamLesen({ dateiId: datei.id, modus: "zusammenfassung", seiten: auswahl }, steuerung.signal, (gesamt) => {
        if (erstes) {
          erstes = false;
          kiVorschauAngezeigt("ki03", 1, start);
        }
        setZusammenfassung((z) => (z ? { ...z, text: gesamt } : z));
      });
      if (!r.ok) {
        setZusammenfassung(null);
        fehlerBehandeln(r);
      } else {
        setZusammenfassung((z) => (z ? { ...z, fertig: true } : z));
        ki.verbraucht(r.verbleibend ?? Math.max(0, ki.verbleibend - 1));
      }
    } catch {
      if (!steuerung.signal.aborted) {
        setFehler("Die Zusammenfassung wurde unterbrochen. Bitte versuch es noch einmal.");
        setZusammenfassung((z) => (z ? { ...z, fertig: true } : z));
      }
    } finally {
      setLaeuft(false);
    }
  }

  const bereichWahl = (
    <div className="pdf-ki-bereich">
      <span>Seiten</span>
      <input
        className="field"
        type="number"
        min={1}
        max={anzahl}
        aria-label="Von Seite"
        value={bereich[0]}
        onChange={(e) => setBereich([Math.min(Math.max(1, Number(e.target.value) || 1), anzahl), bereich[1]])}
      />
      <span>bis</span>
      <input
        className="field"
        type="number"
        min={1}
        max={anzahl}
        aria-label="Bis Seite"
        value={bereich[1]}
        onChange={(e) => setBereich([bereich[0], Math.min(Math.max(1, Number(e.target.value) || 1), anzahl)])}
      />
      <button type="button" className="link-knopf" onClick={() => setBereich(standardBereich(seite, anzahl))} title="Aktuelle Seite ± 2">
        um S. {seite}
      </button>
    </div>
  );

  const kartenSeiten = seiten ? seitenBereich(seiten, bereich[0], bereich[1], MAX_NOTIZ_ZEICHEN) : null;

  if (eingeklappt) {
    return (
      <aside className="pdf-ki-leiste eingeklappt" aria-label="KI zum PDF">
        <button type="button" className="btnp" onClick={() => setEingeklappt(false)}>
          ✨ Zurück zur KI
        </button>
      </aside>
    );
  }

  return (
    <aside className="pdf-ki-leiste" aria-label="KI zum PDF">
      <div className="rowb pdf-ki-kopf">
        <h3>✨ KI zum PDF</h3>
        <button type="button" className="icon-knopf" aria-label="KI-Leiste schließen" onClick={onSchliessen}>
          ✕
        </button>
      </div>

      {ki.phase !== "bereit" ? (
        <KiVorstufe ki={ki} ort="pdf-reader" onSchliessen={onSchliessen} />
      ) : !seiten ? (
        <KiLadeZustand text={`Text wird gelesen … (${gelesen} von ${anzahl} Seiten)`} />
      ) : !lesbar ? (
        <p className="ki-hinweis">Dieses PDF enthält keinen lesbaren Text. KI-Funktionen sind hier nicht möglich.</p>
      ) : (
        <>
          <div className="segwrap pdf-leisten-tabs" role="tablist">
            {(
              [
                ["fragen", "Fragen"],
                ["zusammenfassen", "Zusammenfassen"],
                ["karten", "Karteikarten"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`seg ${tab === t ? "on" : ""}`}
                onClick={() => {
                  setTab(t);
                  setFehler(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "fragen" && (
            <div className="pdf-ki-inhalt">
              <div className="pdf-ki-verlauf" aria-live="polite">
                {verlauf.length === 0 && (
                  <p className="muted">
                    Frag etwas zum Skript, z. B. „Was ist der Unterschied zwischen …?“ Die KI antwortet nur aus diesem PDF und nennt die Seiten.
                  </p>
                )}
                {verlauf.map((e) => (
                  <div key={e.id} className="pdf-ki-eintrag">
                    <p className="pdf-ki-frage">{e.frage}</p>
                    {e.antwort ? (
                      <AntwortText text={e.antwort} maxSeite={anzahl} onSeite={zurSeite} />
                    ) : (
                      <p className="muted">Die KI liest {kurzBereich(e.seiten)} …</p>
                    )}
                    {e.fertig && <p className="faint pdf-ki-quelle">✨ KI-Antwort aus {kurzBereich(e.seiten)} – kann Fehler enthalten.</p>}
                  </div>
                ))}
                <div ref={verlaufEnde} />
              </div>
              <KiFehlerMeldung meldung={fehler} />
              <form
                className="pdf-ki-eingabe"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  void fragen();
                }}
              >
                <textarea
                  className="field"
                  rows={2}
                  placeholder="Deine Frage zum Skript …"
                  aria-label="Frage zum PDF"
                  value={frage}
                  maxLength={MAX_FRAGE_ZEICHEN}
                  onChange={(ev) => setFrage(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" && !ev.shiftKey) {
                      ev.preventDefault();
                      void fragen();
                    }
                  }}
                />
                <div className="ki-fuss">
                  <KiLimitHinweis verbleibend={ki.verbleibend} limit={ki.status?.limit ?? 0} />
                  <button type="submit" className="btnp" disabled={laeuft || !frage.trim() || ki.verbleibend === 0}>
                    {laeuft ? "…" : "Fragen"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {tab === "zusammenfassen" && (
            <div className="pdf-ki-inhalt">
              <p className="muted">Fasst die gewählten Seiten in Stichpunkten zusammen – mit Seitenzahlen zum Anklicken.</p>
              {bereichWahl}
              {zusammenfassung && (
                <div className="pdf-ki-eintrag" aria-live="polite">
                  {zusammenfassung.gekuerzt && <p className="ki-hinweis">✂️ Zu viel Text – nur {kurzBereich(zusammenfassung.seiten)} wurde verwendet.</p>}
                  {zusammenfassung.text ? (
                    <AntwortText text={zusammenfassung.text} maxSeite={anzahl} onSeite={zurSeite} />
                  ) : (
                    <p className="muted">Die KI liest {kurzBereich(zusammenfassung.seiten)} …</p>
                  )}
                  {zusammenfassung.fertig && <p className="faint pdf-ki-quelle">✨ Von der KI zusammengefasst – kann Fehler enthalten. Wird nicht gespeichert.</p>}
                </div>
              )}
              <KiFehlerMeldung meldung={fehler} />
              <div className="ki-fuss">
                <KiLimitHinweis verbleibend={ki.verbleibend} limit={ki.status?.limit ?? 0} />
                <button type="button" className="btnp" disabled={laeuft || ki.verbleibend === 0} onClick={() => void zusammenfassen()}>
                  {laeuft ? "…" : zusammenfassung ? "Neu zusammenfassen" : "Zusammenfassen"}
                </button>
              </div>
            </div>
          )}

          {tab === "karten" && (
            <div className="pdf-ki-inhalt">
              <p className="muted">Die KI schlägt Karteikarten aus den gewählten Seiten vor. Du prüfst sie, bevor etwas gespeichert wird.</p>
              {bereichWahl}
              {kartenSeiten?.gekuerzt && <p className="ki-hinweis">✂️ Zu viel Text – es werden nur {kurzBereich(kartenSeiten.seiten.map((s) => s.seite))} verwendet.</p>}
              <div className="ki-fuss">
                <KiLimitHinweis verbleibend={ki.verbleibend} limit={ki.status?.limit ?? 0} />
                <button
                  type="button"
                  className="btnp"
                  disabled={!kartenSeiten?.seiten.length || ki.verbleibend === 0}
                  onClick={() => setKartenOffen(true)}
                >
                  Karteikarten erstellen
                </button>
              </div>
              {kartenSeiten && !kartenSeiten.seiten.length && <p className="muted">Auf diesen Seiten steht kein lesbarer Text.</p>}
            </div>
          )}
        </>
      )}

      {kartenOffen && kartenSeiten && (
        <KiKartenDialog
          notiz={{ titel: `${datei.name.replace(/\.pdf$/i, "")} (${kurzBereich(kartenSeiten.seiten.map((s) => s.seite))})`, fach_id: null }}
          faecher={[]}
          vorschlagen={(n) => pdfKartenVorschlagen(datei.id, kartenSeiten.seiten, n)}
          ladeText={`Die KI liest ${kurzBereich(kartenSeiten.seiten.map((s) => s.seite))} …`}
          kuerzungsText="Nur der Anfang der Seiten wurde verwendet."
          onSchliessen={() => setKartenOffen(false)}
        />
      )}
    </aside>
  );
}
