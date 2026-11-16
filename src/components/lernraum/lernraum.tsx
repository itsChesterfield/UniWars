"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { quelleSeitenSpeichern, quelleSetzen, quelleUeberblick } from "@/app/(hubs)/lernraum/actions";
import { dateiLink } from "@/app/(hubs)/dateiablage/actions";
import { KiEinwilligungDialog } from "@/components/ki/ki-einwilligung-dialog";
import type { Lernprofil, Ueberblick } from "@/lib/ki/lernraum";
import { inZweiterAnsichtOeffnen } from "@/lib/geteilte-ansicht";
import { studioOeffnen } from "@/lib/ki/studio-kontext";
import { fehlerMelden, track } from "@/lib/analytics";

export type QuelleUi = {
  art: "pdf" | "notiz";
  id: string;
  titel: string;
  herkunft: "fach" | "extra";
  aktiv: boolean;
  seiten: number;
};
type QuellInfo = { nr: number; art: "pdf" | "notiz"; id: string; titel: string };
type Meta = { modus?: string; umfang?: string; web?: { titel: string; url: string }[]; quellen?: QuellInfo[]; fehlend?: string[] };
export type LernNachricht = { id: string; rolle: "nutzer" | "ki"; inhalt: string; meta: Meta; laeuft?: boolean };

const VORSCHLAEGE = [
  "Fass die wichtigsten Punkte zusammen",
  "Was ist prüfungsrelevant?",
  "Erklär mir das schwierigste Thema ganz einfach",
  "Frag mich zu dem Stoff ab",
];

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function pdfjsLaden() {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

function profilText(p: Lernprofil) {
  const laenge = { kurz: "kurz", normal: "mittel", ausfuehrlich: "ausführlich" }[p.laenge];
  const niveau = { einfach: "einfach", normal: "Uni-Niveau", fortgeschritten: "fortgeschritten" }[p.niveau];
  return `${laenge} · ${niveau}${p.beispiele ? " · mit Beispielen" : ""}`;
}

/**
 * Lernraum eines Fachs (wie NotebookLM): links die Quellen, in der Mitte der Chat mit
 * Belegen, rechts das Studio (Lernzettel, FAQ, Briefing, Zeitleiste, Quiz, Karteikarten).
 */
export function Lernraum({
  lernraumId,
  fach,
  startQuellen,
  weitere,
  startProfil,
}: {
  lernraumId: string;
  fach: { id: string; name: string; farbe: string | null };
  startQuellen: QuelleUi[];
  /** fachfremde PDFs/Notizen zum Dazunehmen */
  weitere: { art: "pdf" | "notiz"; id: string; titel: string }[];
  /** früher Lernraum-Chat – der Verlauf läuft jetzt in UniVerse Studio */
  startVerlauf?: LernNachricht[];
  startProfil: Lernprofil;
}) {
  const [quellen, setQuellen] = useState(startQuellen);
  const profil = startProfil;
  const [einwilligung, setEinwilligung] = useState<string | null>(null);
  const [einlesen, setEinlesen] = useState<Record<string, string>>({});
  const [ueberblick, setUeberblick] = useState<Record<string, Ueberblick | "laedt" | string>>({});
  const [offenerUeberblick, setOffenerUeberblick] = useState<string | null>(null);
  const [hinzufuegen, setHinzufuegen] = useState(false);
  const [, startTransition] = useTransition();
  const eingelesen = useRef(new Set<string>());

  // PDFs, die noch keinen Text haben, im Hintergrund einlesen (einmalig)
  useEffect(() => {
    const offen = quellen.filter((q) => q.art === "pdf" && q.aktiv && q.seiten === 0 && !eingelesen.current.has(q.id));
    if (!offen.length) return;
    let abgebrochen = false;
    (async () => {
      for (const q of offen) {
        eingelesen.current.add(q.id);
        try {
          setEinlesen((e) => ({ ...e, [q.id]: "Wird eingelesen …" }));
          const pdfjs = await pdfjsLaden();
          const doc = await pdfjs.getDocument({ url: await dateiLink(q.id) }).promise;
          let block: { seite: number; text: string }[] = [];
          let erster = true;
          let zeichen = 0;
          for (let nr = 1; nr <= doc.numPages; nr++) {
            if (abgebrochen) return;
            const inhalt = await (await doc.getPage(nr)).getTextContent();
            const text = inhalt.items.map((it) => ("str" in it ? it.str : "")).join(" ").replace(/\s+/g, " ").trim();
            zeichen += text.length;
            block.push({ seite: nr, text });
            if (block.length === 40 || nr === doc.numPages) {
              await quelleSeitenSpeichern(q.id, block, erster);
              erster = false;
              block = [];
              setEinlesen((e) => ({ ...e, [q.id]: `Liest ein … ${nr}/${doc.numPages}` }));
            }
          }
          void doc.destroy();
          setQuellen((l) => l.map((x) => (x.id === q.id ? { ...x, seiten: doc.numPages } : x)));
          setEinlesen((e) => ({ ...e, [q.id]: zeichen < 50 ? "Kein Text (gescannt?)" : "" }));
          track("lernraum_pdf_eingelesen", { seiten: doc.numPages, mit_text: zeichen >= 50 });
        } catch (err) {
          fehlerMelden(err, { ort: "lernraum_einlesen" });
          setEinlesen((e) => ({ ...e, [q.id]: "Einlesen fehlgeschlagen" }));
        }
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [quellen]);

  const aktive = quellen.filter((q) => q.aktiv);

  function quelleUmschalten(q: QuelleUi) {
    const aktion = q.herkunft === "extra" ? "entfernen" : q.aktiv ? "aus" : "an";
    setQuellen((l) => (aktion === "entfernen" ? l.filter((x) => x.id !== q.id) : l.map((x) => (x.id === q.id ? { ...x, aktiv: !x.aktiv } : x))));
    quelleSetzen(lernraumId, q.art, q.id, aktion).catch((err) => {
      fehlerMelden(err, { ort: "lernraum_quelle" });
      setQuellen((l) => (aktion === "entfernen" ? [...l, q] : l.map((x) => (x.id === q.id ? q : x))));
    });
  }

  function quelleDazu(w: { art: "pdf" | "notiz"; id: string; titel: string }) {
    setHinzufuegen(false);
    setQuellen((l) => [...l, { ...w, herkunft: "extra", aktiv: true, seiten: 0 }]);
    quelleSetzen(lernraumId, w.art, w.id, "dazu").catch((err) => fehlerMelden(err, { ort: "lernraum_quelle_dazu" }));
  }

  function ueberblickLaden(q: QuelleUi) {
    const schluessel = `${q.art}:${q.id}`;
    setOffenerUeberblick((o) => (o === schluessel ? null : schluessel));
    if (ueberblick[schluessel] && ueberblick[schluessel] !== "laedt" && typeof ueberblick[schluessel] !== "string") return;
    setUeberblick((u) => ({ ...u, [schluessel]: "laedt" }));
    startTransition(async () => {
      const a = await quelleUeberblick(lernraumId, q.art, q.id).catch(() => null);
      if (a && !a.ok && a.typ === "einwilligung") setEinwilligung("ueberblick");
      setUeberblick((u) => ({ ...u, [schluessel]: a?.ok ? a.daten : a && !a.ok ? a.fehler : "Das hat nicht geklappt." }));
    });
  }

  const letzteVorschlaege = (() => {
    const fragenAusUeberblick = Object.values(ueberblick).flatMap((u) => (typeof u === "object" ? u.fragen : []));
    return fragenAusUeberblick.length ? fragenAusUeberblick.slice(0, 4) : VORSCHLAEGE;
  })();

  return (
    <div className="lr">
      {einwilligung && (
        <KiEinwilligungDialog
          onSchliessen={() => setEinwilligung(null)}
          onZugestimmt={() => {
            setEinwilligung(null);
            track("ki_einwilligung_erteilt", { ort: "lernraum" });
          }}
        />
      )}

      {/* Quellen */}
      <aside className="card lr-quellen" aria-label="Quellen">
        <div className="lr-kopf">
          <h2>Quellen</h2>
          <span className="faint">{aktive.length} aktiv</span>
        </div>
        {quellen.length === 0 && <p className="empty-state">Noch keine PDFs oder Notizen in diesem Fach. Lade ein Skript in der Dateiablage hoch oder schreib eine Notiz mit diesem Fach.</p>}
        <ul className="lr-quellen-liste">
          {quellen.map((q) => {
            const schluessel = `${q.art}:${q.id}`;
            const u = ueberblick[schluessel];
            return (
              <li key={schluessel} className={q.aktiv ? "" : "aus"}>
                <div className="lr-quelle">
                  <input type="checkbox" checked={q.aktiv} onChange={() => quelleUmschalten(q)} aria-label={`${q.titel} verwenden`} title={q.herkunft === "extra" ? "Aus dem Lernraum entfernen" : "Für Antworten verwenden"} />
                  <button type="button" className="lr-quelle-titel" onClick={() => ueberblickLaden(q)} title="Überblick anzeigen">
                    <span aria-hidden>{q.art === "pdf" ? "📕" : "📝"}</span> {q.titel}
                  </button>
                  <button
                    type="button"
                    className="icon-knopf"
                    title="Daneben öffnen"
                    aria-label="Daneben öffnen"
                    onClick={() => inZweiterAnsichtOeffnen(q.art === "pdf" ? `/pdf-reader/${q.id}` : `/notizen?id=${q.id}`, "rechts")}
                  >
                    ↗
                  </button>
                </div>
                {einlesen[q.id] && <span className="lr-status">{einlesen[q.id]}</span>}
                {q.herkunft === "extra" && <span className="lr-status">dazugenommen</span>}
                {offenerUeberblick === schluessel && (
                  <div className="lr-ueberblick">
                    {u === "laedt" || u === undefined ? (
                      <p className="muted">Überblick wird erstellt …</p>
                    ) : typeof u === "string" ? (
                      <p className="auth-error">{u}</p>
                    ) : (
                      <>
                        <p>{u.zusammenfassung}</p>
                        <div className="lr-themen">
                          {u.themen.map((t) => (
                            <span key={t} className="tag">
                              {t}
                            </span>
                          ))}
                        </div>
                        {u.fragen.map((f) => (
                          <button key={f} type="button" className="lr-vorschlag" onClick={() => studioOeffnen(f)}>
                            {f}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="lr-dazu">
          {hinzufuegen ? (
            <select
              className="field"
              autoFocus
              defaultValue=""
              onChange={(e) => {
                const w = weitere.find((x) => `${x.art}:${x.id}` === e.target.value);
                if (w) quelleDazu(w);
              }}
              onBlur={() => setHinzufuegen(false)}
            >
              <option value="" disabled>
                Quelle aus anderem Fach wählen …
              </option>
              {weitere
                .filter((w) => !quellen.some((q) => q.id === w.id))
                .map((w) => (
                  <option key={`${w.art}:${w.id}`} value={`${w.art}:${w.id}`}>
                    {w.art === "pdf" ? "📕" : "📝"} {w.titel}
                  </option>
                ))}
            </select>
          ) : (
            <button type="button" className="btng" onClick={() => setHinzufuegen(true)}>
              + Quelle dazunehmen
            </button>
          )}
        </div>
      </aside>

      {/* Fragen laufen über UniVerse Studio (ein Chat für die ganze App) */}
      <section className="card lr-studio-hinweis" aria-label="UniVerse Studio">
        <h2>
          <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} /> {fach.name}
        </h2>
        <p>
          Drück <kbd>Strg</kbd> + <kbd>J</kbd> (Mac: <kbd>⌘</kbd> + <kbd>J</kbd>) – <strong>UniVerse Studio</strong> kennt die {aktive.length} aktiven Quellen dieses Fachs, belegt
          jede Aussage und erstellt dir auf Wunsch Lernzettel, FAQ, Quiz oder Karteikarten.
        </p>
        <div className="lr-vorschlaege">
          {letzteVorschlaege.map((v) => (
            <button key={v} type="button" className="lr-vorschlag" onClick={() => studioOeffnen(v)}>
              {v}
            </button>
          ))}
        </div>
        <p className="faint lr-klein">Erklärweise: {profilText(profil)} – passt sich an deine Rückmeldungen an (Einstellungen in UniVerse Studio).</p>
      </section>
    </div>
  );
}
