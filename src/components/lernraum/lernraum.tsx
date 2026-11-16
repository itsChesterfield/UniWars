"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  alsNotizSpeichern,
  kartenAlsStapel,
  lernprofilRueckmeldung,
  lernprofilSetzen,
  quelleSeitenSpeichern,
  quelleSetzen,
  quelleUeberblick,
  studioErstellen,
  verlaufLeeren,
  type StudioErgebnis,
} from "@/app/(hubs)/lernraum/actions";
import { dateiLink } from "@/app/(hubs)/dateiablage/actions";
import { KiEinwilligungDialog } from "@/components/ki/ki-einwilligung-dialog";
import { MarkdownLesen } from "@/components/lernraum/markdown-lesen";
import { belegeVerlinken, STUDIO, type Lernprofil, type QuizFrage, type Rueckmeldung, type StudioArt, type Ueberblick } from "@/lib/ki/lernraum";
import { inZweiterAnsichtOeffnen } from "@/lib/geteilte-ansicht";
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
  startVerlauf,
  startProfil,
}: {
  lernraumId: string;
  fach: { id: string; name: string; farbe: string | null };
  startQuellen: QuelleUi[];
  /** fachfremde PDFs/Notizen zum Dazunehmen */
  weitere: { art: "pdf" | "notiz"; id: string; titel: string }[];
  startVerlauf: LernNachricht[];
  startProfil: Lernprofil;
}) {
  const [quellen, setQuellen] = useState(startQuellen);
  const [verlauf, setVerlauf] = useState(startVerlauf);
  const [profil, setProfil] = useState(startProfil);
  const [frage, setFrage] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [einwilligung, setEinwilligung] = useState<string | null>(null);
  const [einlesen, setEinlesen] = useState<Record<string, string>>({});
  const [ueberblick, setUeberblick] = useState<Record<string, Ueberblick | "laedt" | string>>({});
  const [offenerUeberblick, setOffenerUeberblick] = useState<string | null>(null);
  const [hinzufuegen, setHinzufuegen] = useState(false);
  const [profilOffen, setProfilOffen] = useState(false);
  const [studio, setStudio] = useState<{ art: StudioArt; laeuft: boolean; ergebnis?: StudioErgebnis; fehler?: string } | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const verlaufEnde = useRef<HTMLDivElement>(null);
  const abbruch = useRef<AbortController | null>(null);
  const eingelesen = useRef(new Set<string>());

  useEffect(() => {
    verlaufEnde.current?.scrollIntoView({ block: "end" });
  }, [verlauf.length]);
  useEffect(
    () => () => {
      abbruch.current?.abort();
    },
    [],
  );

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

  async function fragen(text = frage) {
    const f = text.trim();
    if (!f || laeuft) return;
    setFehler(null);
    setFrage("");
    setLaeuft(true);
    const nutzerId = `n-${Date.now()}`;
    const kiId = `k-${Date.now()}`;
    setVerlauf((v) => [...v, { id: nutzerId, rolle: "nutzer", inhalt: f, meta: {} }, { id: kiId, rolle: "ki", inhalt: "", meta: {}, laeuft: true }]);
    const aendern = (teil: Partial<LernNachricht>) => setVerlauf((v) => v.map((n) => (n.id === kiId ? { ...n, ...teil } : n)));
    const steuerung = new AbortController();
    abbruch.current = steuerung;
    track("lernraum_frage", { quellen: aktive.length });
    try {
      const antwort = await fetch("/api/ki/lernraum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lernraumId, frage: f }),
        signal: steuerung.signal,
      });
      if (!antwort.ok || !antwort.body) {
        const daten = (await antwort.json().catch(() => null)) as { fehler?: string; typ?: string } | null;
        setVerlauf((v) => v.filter((n) => n.id !== kiId && n.id !== nutzerId));
        setFrage(f);
        if (daten?.typ === "einwilligung") setEinwilligung("chat");
        else setFehler(daten?.fehler ?? "Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.");
        return;
      }
      let meta: Meta = {};
      try {
        meta = JSON.parse(decodeURIComponent(antwort.headers.get("X-Lernraum-Meta") ?? "{}")) as Meta;
      } catch {
        meta = {};
      }
      aendern({ meta });
      const leser = antwort.body.getReader();
      const decoder = new TextDecoder();
      let gesamt = "";
      for (;;) {
        const { done, value } = await leser.read();
        if (done) break;
        gesamt += decoder.decode(value, { stream: true });
        aendern({ inhalt: gesamt });
      }
      aendern({ inhalt: gesamt, laeuft: false });
      track("lernraum_antwort", { modus: meta.modus, umfang: meta.umfang, web: Boolean(meta.web?.length) });
    } catch {
      if (!steuerung.signal.aborted) setFehler("Die Antwort wurde unterbrochen. Bitte versuch es noch einmal.");
      aendern({ laeuft: false });
    } finally {
      setLaeuft(false);
    }
  }

  function belegOeffnen(quellenInfo: QuellInfo[] | undefined, nr: number, seite: number | null) {
    const q = quellenInfo?.find((x) => x.nr === nr);
    if (!q) return;
    track("lernraum_beleg_geoeffnet", { art: q.art });
    inZweiterAnsichtOeffnen(q.art === "pdf" ? `/pdf-reader/${q.id}${seite ? `?seite=${seite}` : ""}` : `/notizen?id=${q.id}`, "rechts");
  }

  function rueckmeldung(r: Rueckmeldung) {
    track("lernraum_rueckmeldung", { art: r });
    lernprofilRueckmeldung(r)
      .then((p) => {
        setProfil(p);
        setHinweis(r === "gut" || r === "schlecht" ? "Danke für die Rückmeldung!" : `Gemerkt – ab jetzt: ${profilText(p)}`);
      })
      .catch(() => undefined);
  }

  async function speichernAlsNotiz(titel: string, markdown: string, quellenInfo: QuellInfo[] | undefined) {
    try {
      const { notizId } = await alsNotizSpeichern(lernraumId, titel, markdown, quellenInfo ?? []);
      track("lernraum_als_notiz");
      setHinweis("Als Notiz gespeichert.");
      inZweiterAnsichtOeffnen(`/notizen?id=${notizId}`, "rechts");
    } catch (err) {
      fehlerMelden(err, { ort: "lernraum_notiz" });
      setHinweis("Speichern hat nicht geklappt.");
    }
  }

  function studioStarten(art: StudioArt) {
    setStudio({ art, laeuft: true });
    track("lernraum_studio", { art });
    studioErstellen(lernraumId, art)
      .then((a) => {
        if (!a.ok && a.typ === "einwilligung") {
          setEinwilligung("studio");
          setStudio(null);
          return;
        }
        setStudio(a.ok ? { art, laeuft: false, ergebnis: a.daten } : { art, laeuft: false, fehler: a.fehler });
      })
      .catch(() => setStudio({ art, laeuft: false, fehler: "Das hat nicht geklappt. Bitte versuch es noch einmal." }));
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
                          <button key={f} type="button" className="lr-vorschlag" onClick={() => void fragen(f)} disabled={laeuft}>
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

      {/* Chat */}
      <section className="card lr-chat" aria-label="Chat">
        <div className="lr-kopf">
          <h2>
            <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} /> {fach.name}
          </h2>
          <div className="lr-kopf-aktionen">
            <button type="button" className="btng lr-profil-knopf" onClick={() => setProfilOffen((o) => !o)} title="So erklärt dir die KI – passt sich an deine Rückmeldungen an">
              🎓 {profilText(profil)}
            </button>
            {verlauf.length > 0 && (
              <button
                type="button"
                className="icon-knopf"
                title="Verlauf leeren"
                aria-label="Verlauf leeren"
                onClick={() => {
                  if (!window.confirm("Den Verlauf in diesem Lernraum löschen?")) return;
                  setVerlauf([]);
                  void verlaufLeeren(lernraumId);
                }}
              >
                🗑
              </button>
            )}
          </div>
        </div>
        {profilOffen && <ProfilEditor profil={profil} onAendern={(p) => lernprofilSetzen(p).then(setProfil)} />}
        {hinweis && (
          <p className="lr-hinweis" onClick={() => setHinweis(null)}>
            {hinweis}
          </p>
        )}

        <div className="lr-verlauf">
          {verlauf.length === 0 && (
            <div className="lr-start">
              <p>
                Frag alles zu <strong>{fach.name}</strong> – die KI antwortet aus deinen {aktive.length} Quellen und belegt jede Aussage. Fehlt etwas, ergänzt sie es (markiert)
                und recherchiert auf Wunsch im Web.
              </p>
            </div>
          )}
          {verlauf.map((n) =>
            n.rolle === "nutzer" ? (
              <div key={n.id} className="lr-nachricht nutzer">
                {n.inhalt}
              </div>
            ) : (
              <div key={n.id} className="lr-nachricht ki">
                {n.laeuft && !n.inhalt ? (
                  <p className="muted lr-denkt">Liest deine Quellen …</p>
                ) : n.laeuft ? (
                  <div className="lr-stream">{n.inhalt}</div>
                ) : (
                  <MarkdownLesen
                    wert={belegeVerlinken(n.inhalt, (nr) => n.meta.quellen?.find((q) => q.nr === nr)?.titel ?? null)}
                    onBeleg={(nr, s) => belegOeffnen(n.meta.quellen, nr, s)}
                  />
                )}
                {!n.laeuft && n.meta.web && n.meta.web.length > 0 && (
                  <div className="lr-web">
                    <span className="faint">Im Web recherchiert:</span>
                    {n.meta.web.map((w) => (
                      <a key={w.url} href={w.url} target="_blank" rel="noopener noreferrer">
                        🌐 {w.titel}
                      </a>
                    ))}
                  </div>
                )}
                {!n.laeuft && n.meta.fehlend && n.meta.fehlend.length > 0 && <p className="faint lr-klein">Noch nicht eingelesen: {n.meta.fehlend.join(", ")}</p>}
                {!n.laeuft && n.inhalt && (
                  <div className="lr-aktionen">
                    <button type="button" title="Hilfreich" onClick={() => rueckmeldung("gut")}>
                      👍
                    </button>
                    <button type="button" title="Nicht hilfreich" onClick={() => rueckmeldung("schlecht")}>
                      👎
                    </button>
                    <button type="button" onClick={() => rueckmeldung("einfacher")}>
                      Einfacher
                    </button>
                    <button type="button" onClick={() => rueckmeldung("ausfuehrlicher")}>
                      Ausführlicher
                    </button>
                    <button type="button" onClick={() => rueckmeldung("kuerzer")}>
                      Kürzer
                    </button>
                    <button type="button" onClick={() => rueckmeldung("beispiele")}>
                      Mehr Beispiele
                    </button>
                    <button type="button" onClick={() => void speichernAlsNotiz(`${fach.name} – ${verlauf[verlauf.indexOf(n) - 1]?.inhalt.slice(0, 60) ?? "KI-Antwort"}`, n.inhalt, n.meta.quellen)}>
                      📝 Als Notiz
                    </button>
                    {n.meta.modus === "quiz" && (
                      <button type="button" onClick={() => studioStarten("quiz")}>
                        🎯 Als interaktives Quiz
                      </button>
                    )}
                  </div>
                )}
              </div>
            ),
          )}
          <div ref={verlaufEnde} />
        </div>

        {fehler && <p className="auth-error">{fehler}</p>}
        {!laeuft && (
          <div className="lr-vorschlaege">
            {letzteVorschlaege.map((v) => (
              <button key={v} type="button" className="lr-vorschlag" onClick={() => void fragen(v)}>
                {v}
              </button>
            ))}
          </div>
        )}
        <form
          className="lr-eingabe"
          onSubmit={(e) => {
            e.preventDefault();
            void fragen();
          }}
        >
          <textarea
            className="field"
            rows={2}
            placeholder={`Frag etwas zu ${fach.name} … (z. B. „Erklär mir …“, „Vergleiche …“, „Recherchier …“)`}
            value={frage}
            maxLength={2000}
            onChange={(e) => setFrage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void fragen();
              }
            }}
          />
          {laeuft ? (
            <button type="button" className="btng" onClick={() => abbruch.current?.abort()}>
              Stopp
            </button>
          ) : (
            <button type="submit" className="btnp" disabled={!frage.trim()}>
              Senden
            </button>
          )}
        </form>
      </section>

      {/* Studio */}
      <aside className="card lr-studio" aria-label="Studio">
        <div className="lr-kopf">
          <h2>Studio</h2>
          <span className="faint">aus allen aktiven Quellen</span>
        </div>
        <div className="lr-studio-knoepfe">
          {(Object.keys(STUDIO) as StudioArt[]).map((a) => (
            <button key={a} type="button" className={`lr-studio-knopf ${studio?.art === a ? "an" : ""}`} disabled={studio?.laeuft} onClick={() => studioStarten(a)}>
              <span aria-hidden>{STUDIO[a].icon}</span> {STUDIO[a].name}
            </button>
          ))}
        </div>
        {studio && (
          <div className="lr-studio-ergebnis">
            {studio.laeuft ? (
              <p className="muted">
                {STUDIO[studio.art].icon} {STUDIO[studio.art].name} wird erstellt … das dauert bei großen Skripten bis zu einer Minute.
              </p>
            ) : studio.fehler ? (
              <p className="auth-error">{studio.fehler}</p>
            ) : studio.ergebnis?.art === "quiz" ? (
              <Quiz fragen={studio.ergebnis.fragen} quellen={studio.ergebnis.quellen} onBeleg={(nr, s) => belegOeffnen(studio.ergebnis?.quellen, nr, s)} />
            ) : studio.ergebnis?.art === "karteikarten" ? (
              <KartenVorschau lernraumId={lernraumId} karten={studio.ergebnis.karten} />
            ) : studio.ergebnis && "markdown" in studio.ergebnis ? (
              <>
                <MarkdownLesen
                  wert={belegeVerlinken(studio.ergebnis.markdown, (nr) => studio.ergebnis?.quellen.find((q) => q.nr === nr)?.titel ?? null)}
                  onBeleg={(nr, s) => belegOeffnen(studio.ergebnis?.quellen, nr, s)}
                />
                <button
                  type="button"
                  className="btnp"
                  onClick={() => {
                    const e = studio.ergebnis;
                    if (e && "markdown" in e) void speichernAlsNotiz(`${STUDIO[studio.art].name} – ${fach.name}`, e.markdown, e.quellen);
                  }}
                >
                  📝 Als Notiz speichern
                </button>
              </>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}

function ProfilEditor({ profil, onAendern }: { profil: Lernprofil; onAendern: (p: Lernprofil) => void }) {
  return (
    <div className="lr-profil">
      <label>
        Länge
        <select className="field" value={profil.laenge} onChange={(e) => onAendern({ ...profil, laenge: e.target.value as Lernprofil["laenge"] })}>
          <option value="kurz">Kurz</option>
          <option value="normal">Mittel</option>
          <option value="ausfuehrlich">Ausführlich</option>
        </select>
      </label>
      <label>
        Niveau
        <select className="field" value={profil.niveau} onChange={(e) => onAendern({ ...profil, niveau: e.target.value as Lernprofil["niveau"] })}>
          <option value="einfach">Einfach</option>
          <option value="normal">Uni-Niveau</option>
          <option value="fortgeschritten">Fortgeschritten</option>
        </select>
      </label>
      <label className="lr-check">
        <input type="checkbox" checked={profil.beispiele} onChange={(e) => onAendern({ ...profil, beispiele: e.target.checked })} /> Mit Beispielen
      </label>
      {profil.hinweise.length > 0 && (
        <div className="lr-hinweise">
          <span className="faint">Gemerkte Wünsche:</span>
          {profil.hinweise.map((h) => (
            <span key={h} className="tag">
              {h}{" "}
              <button type="button" aria-label="Wunsch entfernen" onClick={() => onAendern({ ...profil, hinweise: profil.hinweise.filter((x) => x !== h) })}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="faint lr-klein">Die KI passt das auch selbst an – über die Knöpfe unter den Antworten oder wenn du z. B. schreibst „erklär mir immer mit Beispielen“.</p>
    </div>
  );
}

function Quiz({ fragen, onBeleg }: { fragen: QuizFrage[]; quellen: QuellInfo[]; onBeleg: (nr: number, seite: number | null) => void }) {
  const [antworten, setAntworten] = useState<Record<number, number>>({});
  const richtig = fragen.filter((f, i) => antworten[i] === f.richtig).length;
  const fertig = Object.keys(antworten).length === fragen.length;
  return (
    <div className="lr-quiz">
      {fragen.map((f, i) => {
        const gewaehlt = antworten[i];
        const beleg = /Q(\d+)(?:\s*S\.\s*(\d+))?/.exec(f.beleg);
        return (
          <div key={i} className="lr-quiz-frage">
            <p>
              <strong>{i + 1}.</strong> {f.frage}
            </p>
            {f.optionen.map((o, j) => (
              <button
                key={j}
                type="button"
                disabled={gewaehlt !== undefined}
                className={gewaehlt === undefined ? "" : j === f.richtig ? "richtig" : j === gewaehlt ? "falsch" : ""}
                onClick={() => setAntworten((a) => ({ ...a, [i]: j }))}
              >
                {o}
              </button>
            ))}
            {gewaehlt !== undefined && (
              <p className="lr-klein">
                {gewaehlt === f.richtig ? "✅ Richtig! " : "❌ Leider falsch. "}
                {f.erklaerung}{" "}
                {beleg && (
                  <button type="button" className="lr-beleg-knopf" onClick={() => onBeleg(Number(beleg[1]), beleg[2] ? Number(beleg[2]) : null)}>
                    {f.beleg}
                  </button>
                )}
              </p>
            )}
          </div>
        );
      })}
      {fertig && (
        <p className="lr-quiz-ergebnis">
          {richtig} von {fragen.length} richtig {richtig === fragen.length ? "🎉" : richtig >= fragen.length / 2 ? "👍" : "– dranbleiben!"}
        </p>
      )}
    </div>
  );
}

function KartenVorschau({ lernraumId, karten }: { lernraumId: string; karten: { vorderseite: string; rueckseite: string }[] }) {
  const [stapelId, setStapelId] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  return (
    <div className="lr-karten">
      {karten.map((k, i) => (
        <details key={i} className="lr-karte">
          <summary>{k.vorderseite}</summary>
          <p>{k.rueckseite}</p>
        </details>
      ))}
      {stapelId ? (
        <Link href={`/karteikarten/${stapelId}/lernen`} className="btnp">
          Gespeichert – jetzt lernen
        </Link>
      ) : (
        <button
          type="button"
          className="btnp"
          disabled={laeuft}
          onClick={() => {
            setLaeuft(true);
            kartenAlsStapel(lernraumId, karten)
              .then((r) => {
                setStapelId(r.stapelId);
                track("lernraum_karten_gespeichert", { anzahl: karten.length });
              })
              .catch((err) => fehlerMelden(err, { ort: "lernraum_karten" }))
              .finally(() => setLaeuft(false));
          }}
        >
          🗂️ Als Karteikarten-Stapel speichern
        </button>
      )}
    </div>
  );
}
