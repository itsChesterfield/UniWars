"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { quizErstellen, quizLoeschen } from "@/app/(hubs)/karteikarten/quiz-actions";
import { QuellenWahl, type Fach, type QuellOption, type QuellWahl } from "@/components/quiz/quellen-wahl";
import { EINSTELLUNGEN_STANDARD, FRAGE_TYPEN, TYP_NAME, type FrageTyp, type QuizEinstellungen, type Schwierigkeit } from "@/lib/ki/quiz";
import { fehlerMelden, track } from "@/lib/analytics";

export type QuizKachel = {
  id: string;
  titel: string;
  fach_id: string | null;
  anzahl: number;
  versuche: number;
  bester: number | null;
  letzter: number | null;
  schwaechen: number;
};

/** Karteikarten-Hub: Quiz wie Quizgecko – mehrere Fragetypen, KI-Bewertung, Schwächen üben */
export function QuizBereich({ quizze, faecher, optionen, kiVerfuegbar }: { quizze: QuizKachel[]; faecher: Fach[]; optionen: QuellOption[]; kiVerfuegbar: boolean }) {
  const [neu, setNeu] = useState(false);
  const router = useRouter();

  // Aus der Befehlspalette (Strg+O): „…?neu=quiz“ öffnet gleich den Dialog
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("neu") !== "quiz" || !kiVerfuegbar) return;
    url.searchParams.delete("neu");
    window.history.replaceState(null, "", url.pathname + url.search);
    const id = window.setTimeout(() => setNeu(true), 0);
    return () => window.clearTimeout(id);
  }, [kiVerfuegbar]);

  return (
    <section className="qz-bereich" aria-labelledby="qz-titel">
      <div className="qz-kopf">
        <div>
          <h2 id="qz-titel" className="qz-titel">🎯 Quiz</h2>
          <p className="muted qz-untertitel">Lass dich aus deinen Skripten und Notizen abfragen – Multiple Choice, Wahr/Falsch, Lückentext, Zuordnen und freie Antworten, die die KI bewertet.</p>
        </div>
        {kiVerfuegbar && (
          <button type="button" className="btnp" onClick={() => setNeu(true)}>
            + Neues Quiz
          </button>
        )}
      </div>
      {quizze.length === 0 ? (
        <p className="empty-state">Noch kein Quiz. Erstell eins aus einem Fach oder einzelnen PDFs.</p>
      ) : (
        <div className="kk-raster">
          {quizze.map((q) => {
            const fach = faecher.find((f) => f.id === q.fach_id);
            return (
              <article key={q.id} className="card kk-kachel qz-kachel">
                <div className="kk-kachel-kopf">
                  <Link href={`/karteikarten/quiz/${q.id}`} className="kk-kachel-name">
                    🎯 {q.titel}
                  </Link>
                  <button
                    type="button"
                    className="icon-knopf"
                    aria-label="Quiz löschen"
                    title="Löschen"
                    onClick={() => {
                      if (!window.confirm(`Quiz „${q.titel}“ löschen?`)) return;
                      void quizLoeschen(q.id).then(() => router.refresh());
                    }}
                  >
                    🗑
                  </button>
                </div>
                {fach && (
                  <div className="kk-kachel-fach muted">
                    <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} /> {fach.name}
                  </div>
                )}
                <div className="qz-kachel-zahlen muted">
                  <span>{q.anzahl} Fragen</span>
                  {q.versuche > 0 && <span>Bestes: {q.bester}%</span>}
                  {q.letzter !== null && <span>Zuletzt: {q.letzter}%</span>}
                  {q.schwaechen > 0 && <span className="qz-schwach">{q.schwaechen} Schwächen</span>}
                </div>
                <div className="kk-kachel-knoepfe">
                  <Link href={`/karteikarten/quiz/${q.id}`} className="btnp">
                    {q.versuche ? "Nochmal" : "Starten"}
                  </Link>
                  {q.schwaechen > 0 && (
                    <Link href={`/karteikarten/quiz/${q.id}?modus=schwaechen`} className="btng">
                      Schwächen üben
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {neu && <QuizNeuDialog faecher={faecher} optionen={optionen} onSchliessen={() => setNeu(false)} />}
    </section>
  );
}

function QuizNeuDialog({ faecher, optionen, onSchliessen }: { faecher: Fach[]; optionen: QuellOption[]; onSchliessen: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [wahl, setWahl] = useState<QuellWahl>({ fachId: null, quellen: [] });
  const [einst, setEinst] = useState<QuizEinstellungen>(EINSTELLUNGEN_STANDARD);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function typUmschalten(t: FrageTyp) {
    setEinst((e) => {
      const typen = e.typen.includes(t) ? e.typen.filter((x) => x !== t) : [...e.typen, t];
      return { ...e, typen: typen.length ? typen : e.typen };
    });
  }

  async function erstellen(e: React.FormEvent) {
    e.preventDefault();
    if (!wahl.quellen.length && !wahl.fachId) return setFehler("Wähle ein Fach oder mindestens eine PDF/Notiz.");
    setFehler(null);
    setLaeuft(true);
    try {
      const a = await quizErstellen({ quellen: wahl.quellen, fachId: wahl.fachId, einstellungen: einst });
      if (!a.ok) {
        setFehler(a.fehler);
        setLaeuft(false);
        return;
      }
      track("quiz_erstellt", { anzahl: einst.anzahl, typen: einst.typen.join(","), schwierigkeit: einst.schwierigkeit });
      router.push(`/karteikarten/quiz/${a.daten.id}`);
    } catch (err) {
      fehlerMelden(err, { ort: "quiz_erstellen" });
      setFehler("Das hat nicht geklappt. Bitte versuch es noch einmal.");
      setLaeuft(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="quick-add-modal qz-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!laeuft) onSchliessen();
      }}
    >
      <form onSubmit={erstellen} className="hub-formular">
        <h3>Neues Quiz</h3>
        <QuellenWahl faecher={faecher} optionen={optionen} wert={wahl} onAendern={setWahl} />
        <label>
          <span>Fragen: {einst.anzahl}</span>
          <input type="range" min={5} max={30} step={1} value={einst.anzahl} onChange={(e) => setEinst({ ...einst, anzahl: Number(e.target.value) })} />
        </label>
        <div className="qz-feld">
          <span>Schwierigkeit</span>
          <span className="segwrap" role="radiogroup" aria-label="Schwierigkeit">
            {(["leicht", "mittel", "schwer"] as Schwierigkeit[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={einst.schwierigkeit === s} className={`seg ${einst.schwierigkeit === s ? "on" : ""}`} onClick={() => setEinst({ ...einst, schwierigkeit: s })}>
                {s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </span>
        </div>
        <div className="qz-feld">
          <span>Fragetypen</span>
          <span className="qz-typen">
            {FRAGE_TYPEN.map((t) => (
              <label key={t} className="qz-typ">
                <input type="checkbox" checked={einst.typen.includes(t)} onChange={() => typUmschalten(t)} /> {TYP_NAME[t]}
              </label>
            ))}
          </span>
        </div>
        {fehler && <p className="auth-error">{fehler}</p>}
        {laeuft && <p className="faint">UniVerse Studio liest dein Material und schreibt die Fragen – das dauert etwa eine halbe bis ganze Minute …</p>}
        <div className="hub-formular-knoepfe">
          <button type="button" className="btng" onClick={onSchliessen} disabled={laeuft}>
            Abbrechen
          </button>
          <button type="submit" className="btnp" disabled={laeuft}>
            {laeuft ? "Erstelle …" : "Quiz erstellen"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
