"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { quizErstellen, quizLoeschen } from "@/app/(hubs)/karteikarten/quiz-actions";
import { Icon } from "@/components/nav-icon";
import { Zustand } from "@/components/zustand";
import { QuellenWahl, type Fach, type QuellOption, type QuellWahl } from "@/components/quiz/quellen-wahl";
import { EINSTELLUNGEN_STANDARD, FRAGE_TYPEN, TYP_NAME, type FrageTyp, type QuizEinstellungen } from "@/lib/ki/quiz";
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

  const neuKnopf = kiVerfuegbar && (
    <button type="button" className="knopf neben klein" onClick={() => setNeu(true)}>
      <Icon name="plus" groesse={16} />
      Neues Quiz
    </button>
  );

  return (
    <section className="kk-abschnitt" aria-labelledby="qz-titel">
      <div className="abschnitt-kopf">
        <h2 id="qz-titel" className="abschnitt-titel">
          Quiz
        </h2>
        <span className="abschnitt-info">aus deinen Skripten und Notizen, freie Antworten bewertet Studio</span>
        {quizze.length > 0 && <span className="rechts">{neuKnopf}</span>}
      </div>
      {quizze.length === 0 ? (
        <Zustand art="leer" icon="ziel" titel="Noch kein Quiz." region ebene={3} aktion={neuKnopf}>
          Lass dich aus einem Fach oder einzelnen PDFs abfragen: Multiple Choice, Wahr oder falsch, Lückentext, Zuordnen und freie Antworten.
        </Zustand>
      ) : (
        <ul className="entry-list">
          {quizze.map((q) => {
            const fach = faecher.find((f) => f.id === q.fach_id);
            const zahlen = [
              fach?.name ?? "Ohne Fach",
              `${q.anzahl} Fragen`,
              q.bester !== null && `bestes ${q.bester} %`,
              q.letzter !== null && `zuletzt ${q.letzter} %`,
              q.schwaechen > 0 && `${q.schwaechen} ${q.schwaechen === 1 ? "Schwäche" : "Schwächen"}`,
            ].filter(Boolean);
            return (
              <li key={q.id} className="entry-row fach-zeile">
                <span className="fach-farbe" style={{ "--c": fach?.farbe ?? "var(--text-3)" } as CSSProperties} aria-hidden />
                <div className="entry-info">
                  <Link href={`/karteikarten/quiz/${q.id}`} className="entry-title kk-name">
                    {q.titel}
                  </Link>
                  <span className="entry-meta">{zahlen.join(", ")}</span>
                </div>
                <div className="entry-actions">
                  {q.schwaechen > 0 && (
                    <Link href={`/karteikarten/quiz/${q.id}?modus=schwaechen`} className="knopf leise klein">
                      Schwächen üben
                    </Link>
                  )}
                  <Link href={`/karteikarten/quiz/${q.id}`} className="knopf neben klein">
                    {q.versuche ? "Nochmal" : "Starten"}
                  </Link>
                  <button
                    type="button"
                    className="knopf gefahr klein nur-symbol"
                    aria-label={`Quiz „${q.titel}“ löschen`}
                    title="Löschen"
                    onClick={() => {
                      if (!window.confirm(`Quiz „${q.titel}“ löschen?`)) return;
                      void quizLoeschen(q.id).then(() => router.refresh());
                    }}
                  >
                    <Icon name="loeschen" groesse={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
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
      className="formular-dialog"
      aria-labelledby="quiz-neu-titel"
      onCancel={(e) => {
        e.preventDefault();
        if (!laeuft) onSchliessen();
      }}
    >
      <form onSubmit={erstellen} className="crud-form">
        <h3 id="quiz-neu-titel">Neues Quiz</h3>
        <QuellenWahl faecher={faecher} optionen={optionen} wert={wahl} onAendern={setWahl} />
        <Auswahl
          name="Fragen"
          werte={ANZAHLEN.map((n) => [n, String(n)])}
          wert={einst.anzahl}
          onWahl={(anzahl) => setEinst({ ...einst, anzahl })}
        />
        <Auswahl
          name="Schwierigkeit"
          werte={[
            ["leicht", "Leicht"],
            ["mittel", "Mittel"],
            ["schwer", "Schwer"],
          ]}
          wert={einst.schwierigkeit}
          onWahl={(schwierigkeit) => setEinst({ ...einst, schwierigkeit })}
        />
        <span className="qz-feld-titel" id="qz-typen">
          Fragetypen
        </span>
        <div className="qz-typen" role="group" aria-labelledby="qz-typen">
          {FRAGE_TYPEN.map((t) => (
            <button key={t} type="button" className="filter-chip" aria-pressed={einst.typen.includes(t)} onClick={() => typUmschalten(t)}>
              {TYP_NAME[t]}
            </button>
          ))}
        </div>
        {fehler && (
          <p className="formular-fehler" role="alert">
            {fehler}
          </p>
        )}
        {laeuft && <p className="qz-hinweis">UniVerse Studio liest dein Material und schreibt die Fragen. Das dauert etwa eine halbe bis ganze Minute.</p>}
        <div className="crud-form-actions">
          <button type="submit" className="knopf haupt" aria-busy={laeuft} disabled={laeuft}>
            {laeuft ? "Studio schreibt Fragen" : "Quiz erstellen"}
          </button>
          <button type="button" className="knopf leise" onClick={onSchliessen} disabled={laeuft}>
            Abbrechen
          </button>
        </div>
      </form>
    </dialog>
  );
}

const ANZAHLEN = [5, 10, 15, 20, 30];

/** Eine Wahl aus wenigen Werten als Segment (Fragen, Schwierigkeit, Länge) */
export function Auswahl<T extends string | number>({
  name,
  werte,
  wert,
  onWahl,
}: {
  name: string;
  werte: [T, string][];
  wert: T;
  onWahl: (w: T) => void;
}) {
  return (
    <div className="qz-feld" role="group" aria-label={name}>
      <span className="qz-feld-titel" aria-hidden>
        {name}
      </span>
      <span className="segment">
        {werte.map(([w, text]) => (
          <button key={w} type="button" aria-pressed={wert === w} onClick={() => onWahl(w)}>
            {text}
          </button>
        ))}
      </span>
    </div>
  );
}
