"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { falscheAlsKarten, freiBewerten, quizSchwaechenErweitern, versuchSpeichern } from "@/app/(hubs)/karteikarten/quiz-actions";
import { alsKarte, bewerten, schwaechen, TYP_NAME, type Antwort, type Bewertung, type QuizFrage, type VersuchAntwort } from "@/lib/ki/quiz";
import type { QuellInfo } from "@/lib/ki/quiz-server";
import { inZweiterAnsichtOeffnen } from "@/lib/geteilte-ansicht";
import { studioMelden } from "@/lib/ki/studio-kontext";
import { fehlerMelden, track } from "@/lib/analytics";

type Modus = "alle" | "schwaechen";
type Ergebnis = { frageId: string; punkte: number; bewertung: Bewertung };

function mischen<T>(liste: T[]): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Ein Quiz spielen: Start → Fragen nacheinander mit sofortigem Feedback → Ergebnis */
export function QuizSpielen({
  quiz,
  versuche,
  startModus,
}: {
  quiz: { id: string; titel: string; fragen: QuizFrage[]; quellen: QuellInfo[] };
  versuche: { antworten: VersuchAntwort[] }[];
  startModus: Modus | null;
}) {
  const router = useRouter();
  const [fragen, setFragen] = useState(quiz.fragen);
  const [verlauf, setVerlauf] = useState(versuche);
  const schwach = useMemo(() => schwaechen(fragen, verlauf.slice(0, 5)), [fragen, verlauf]);
  const [runde, setRunde] = useState<{ modus: Modus; fragen: QuizFrage[] } | null>(null);
  const [erweitern, setErweitern] = useState<{ laeuft: boolean; fehler: string | null }>({ laeuft: false, fehler: null });

  function starten(modus: Modus) {
    const auswahl = modus === "schwaechen" ? fragen.filter((f) => schwach.fragen.includes(f.id)) : fragen;
    if (!auswahl.length) return;
    setRunde({ modus, fragen: mischen(auswahl) });
    track("quiz_gestartet", { modus, anzahl: auswahl.length });
  }

  // Direkt aus „Schwächen üben“ gekommen
  useEffect(() => {
    if (startModus === "schwaechen" && schwach.fragen.length) {
      const id = window.setTimeout(() => starten("schwaechen"), 0);
      return () => window.clearTimeout(id);
    }
    // nur beim ersten Laden
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => studioMelden({ karte: null }), []);

  if (runde) {
    return (
      <Durchgang
        key={`${runde.modus}-${runde.fragen.map((f) => f.id).join()}`}
        quiz={quiz}
        modus={runde.modus}
        fragen={runde.fragen}
        onFertig={(antworten) => setVerlauf((v) => [{ antworten }, ...v])}
        onNochmal={(m) => starten(m)}
        onZurueck={() => {
          setRunde(null);
          router.refresh();
        }}
        schwaechenNach={(antworten) => schwaechen(fragen, [{ antworten }, ...verlauf].slice(0, 5)).fragen.length}
      />
    );
  }

  const typen = [...new Set(fragen.map((f) => f.typ))];
  return (
    <div className="card qz-start">
      <h1 className="qz-start-titel">🎯 {quiz.titel}</h1>
      <p className="muted">
        {fragen.length} Fragen · {typen.map((t) => TYP_NAME[t]).join(", ")}
        {verlauf.length > 0 && ` · ${verlauf.length} ${verlauf.length === 1 ? "Durchgang" : "Durchgänge"}`}
      </p>
      {quiz.quellen.length > 0 && <p className="faint qz-klein">Aus: {quiz.quellen.map((q) => q.titel).join(", ")}</p>}
      <div className="qz-start-knoepfe">
        <button type="button" className="btnp" onClick={() => starten("alle")}>
          ▶ Alle Fragen
        </button>
        <button type="button" className="btng" disabled={!schwach.fragen.length} onClick={() => starten("schwaechen")}>
          Schwächen üben ({schwach.fragen.length})
        </button>
        <button
          type="button"
          className="btng"
          disabled={!schwach.themen.length || erweitern.laeuft}
          title="Neue Fragen zu den Themen, bei denen du Fehler gemacht hast"
          onClick={() => {
            setErweitern({ laeuft: true, fehler: null });
            quizSchwaechenErweitern(quiz.id)
              .then((a) => {
                if (!a.ok) return setErweitern({ laeuft: false, fehler: a.fehler });
                setFragen((f) => [...f, ...a.daten.neu]);
                setErweitern({ laeuft: false, fehler: null });
                setRunde({ modus: "alle", fragen: a.daten.neu });
                track("quiz_schwaechen_erweitert", { anzahl: a.daten.neu.length });
              })
              .catch((err) => {
                fehlerMelden(err, { ort: "quiz_erweitern" });
                setErweitern({ laeuft: false, fehler: "Das hat nicht geklappt." });
              });
          }}
        >
          {erweitern.laeuft ? "Erstelle neue Fragen …" : "✨ Neue Fragen zu meinen Schwächen"}
        </button>
      </div>
      {schwach.themen.length > 0 && (
        <p className="qz-klein">
          <span className="muted">Daran solltest du arbeiten:</span>{" "}
          {schwach.themen.map((t) => (
            <span key={t} className="tag qz-thema">
              {t}
            </span>
          ))}
        </p>
      )}
      {erweitern.fehler && <p className="auth-error">{erweitern.fehler}</p>}
      <p className="faint qz-klein">
        Tipp: Bei einer Frage nicht weiter? <kbd>Strg</kbd> + <kbd>J</kbd> – UniVerse Studio erklärt sie dir.
      </p>
      <Link href="/karteikarten" className="btng qz-zurueck">
        ← Karteikarten
      </Link>
    </div>
  );
}

function Durchgang({
  quiz,
  modus,
  fragen,
  onFertig,
  onNochmal,
  onZurueck,
  schwaechenNach,
}: {
  quiz: { id: string; quellen: QuellInfo[] };
  modus: Modus;
  fragen: QuizFrage[];
  onFertig: (antworten: VersuchAntwort[]) => void;
  onNochmal: (m: Modus) => void;
  onZurueck: () => void;
  schwaechenNach: (antworten: VersuchAntwort[]) => number;
}) {
  const [i, setI] = useState(0);
  const [antwort, setAntwort] = useState<Antwort | null>(null);
  const [aktuell, setAktuell] = useState<Bewertung | null>(null);
  const [pruefe, setPruefe] = useState(false);
  const [ergebnisse, setErgebnisse] = useState<Ergebnis[]>([]);
  const [fertig, setFertig] = useState(false);
  const frage = fragen[i];

  // UniVerse Studio (Strg+J) kennt die aktuelle Frage
  useEffect(() => {
    if (!frage) return;
    const k = alsKarte(frage);
    studioMelden({ karte: { stapelId: quiz.id, vorderseite: k.vorderseite, rueckseite: aktuell ? k.rueckseite : "(noch nicht beantwortet – verrate die Lösung nicht, gib nur Hinweise)" } });
  }, [frage, aktuell, quiz.id]);

  async function pruefen() {
    if (!frage || aktuell || pruefe) return;
    let b = bewerten(frage, antwort ?? (frage.typ === "zuordnen" ? [] : ""));
    if (!b) {
      setPruefe(true);
      try {
        const a = await freiBewerten(quiz.id, frage.id, typeof antwort === "string" ? antwort : "");
        b = a.ok ? a.daten : { punkte: 0, richtig: false, feedback: a.fehler };
      } catch {
        b = { punkte: 0, richtig: false, feedback: "Die Bewertung hat nicht geklappt – vergleiche selbst mit der Musterlösung." };
      }
      setPruefe(false);
    }
    setAktuell(b);
    setErgebnisse((e) => [...e, { frageId: frage.id, punkte: b.punkte, bewertung: b }]);
  }

  function weiter() {
    if (i + 1 < fragen.length) {
      setI(i + 1);
      setAntwort(null);
      setAktuell(null);
      return;
    }
    setFertig(true);
    const antworten = ergebnisse.map((e) => ({ frageId: e.frageId, punkte: e.punkte }));
    onFertig(antworten);
    void versuchSpeichern(quiz.id, modus, antworten).catch((err) => fehlerMelden(err, { ort: "quiz_versuch" }));
    track("quiz_beendet", { modus, prozent: Math.round((antworten.reduce((n, a) => n + a.punkte, 0) / Math.max(1, antworten.length)) * 100) });
  }

  // Tastatur: 1–6 wählt bei Multiple Choice, W/F bei Wahr/Falsch, Enter prüft bzw. geht weiter
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (fertig || !frage || e.ctrlKey || e.metaKey || e.altKey) return;
      const ziel = e.target as HTMLElement;
      const imFeld = ziel?.closest?.("input, textarea, select");
      if (e.key === "Enter" && ziel?.tagName !== "TEXTAREA" && ziel?.tagName !== "BUTTON") {
        e.preventDefault();
        if (aktuell) weiter();
        else if (antwort !== null && !(typeof antwort === "string" && !antwort.trim())) void pruefen();
        return;
      }
      if (imFeld || aktuell) return;
      if (frage.typ === "mc" && /^[1-6]$/.test(e.key) && Number(e.key) <= frage.optionen.length) setAntwort(Number(e.key) - 1);
      if (frage.typ === "wf" && (e.key === "w" || e.key === "f")) setAntwort(e.key === "w");
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  });

  if (fertig) {
    const antworten = ergebnisse.map((e) => ({ frageId: e.frageId, punkte: e.punkte }));
    return <Ergebnisseite quizId={quiz.id} fragen={fragen} ergebnisse={ergebnisse} schwaechen={schwaechenNach(antworten)} onNochmal={onNochmal} onZurueck={onZurueck} />;
  }
  if (!frage) return null;

  const beleg = /Q(\d+)(?:\s*S\.\s*(\d+))?/.exec(frage.beleg);
  const quelle = beleg ? quiz.quellen.find((q) => q.nr === Number(beleg[1])) : null;
  const beantwortet = antwort !== null && !(typeof antwort === "string" && !antwort.trim());

  return (
    <div className="card qz-frage-karte">
      <div className="qz-fortschritt" aria-label={`Frage ${i + 1} von ${fragen.length}`}>
        <div style={{ width: `${(i / fragen.length) * 100}%` }} />
      </div>
      <div className="qz-frage-kopf muted">
        <span>
          Frage {i + 1} / {fragen.length}
        </span>
        <span className="tag">{TYP_NAME[frage.typ]}</span>
      </div>
      <h2 className="qz-frage">{frage.typ === "wf" ? `Wahr oder falsch? ${frage.frage}` : frage.frage}</h2>

      <Eingabe frage={frage} antwort={antwort} setAntwort={setAntwort} gesperrt={!!aktuell} />

      {aktuell && (
        <div className={`qz-feedback ${aktuell.richtig ? "richtig" : aktuell.punkte > 0 ? "teils" : "falsch"}`} role="status">
          <strong>{aktuell.richtig ? "✅ Richtig!" : aktuell.punkte > 0 ? "🟡 Teilweise richtig" : "❌ Nicht ganz"}</strong>
          {!aktuell.richtig && <p>{aktuell.feedback}</p>}
          {aktuell.richtig && frage.typ === "frei" && <p>{aktuell.feedback}</p>}
          {frage.typ === "frei" && (
            <p>
              <span className="muted">Musterlösung:</span> {frage.musterloesung}
            </p>
          )}
          {frage.erklaerung && <p className="muted">{frage.erklaerung}</p>}
          {quelle && (
            <button
              type="button"
              className="lr-beleg-knopf"
              onClick={() => inZweiterAnsichtOeffnen(quelle.art === "pdf" ? `/pdf-reader/${quelle.id}${beleg?.[2] ? `?seite=${beleg[2]}` : ""}` : `/notizen?id=${quelle.id}`, "rechts")}
            >
              📖 {quelle.titel}
              {beleg?.[2] ? `, S. ${beleg[2]}` : ""} öffnen
            </button>
          )}
        </div>
      )}

      <div className="qz-frage-knoepfe">
        {aktuell ? (
          <button type="button" className="btnp" onClick={weiter} autoFocus>
            {i + 1 < fragen.length ? "Weiter →" : "Ergebnis ansehen"}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btng"
              onClick={() => {
                setAntwort(frage.typ === "zuordnen" ? [] : frage.typ === "mc" || frage.typ === "wf" ? -1 : "");
                const b: Bewertung = { punkte: 0, richtig: false, feedback: "Übersprungen." };
                setAktuell(b);
                setErgebnisse((e) => [...e, { frageId: frage.id, punkte: 0, bewertung: b }]);
              }}
            >
              Weiß ich nicht
            </button>
            <button type="button" className="btnp" disabled={!beantwortet || pruefe} onClick={() => void pruefen()}>
              {pruefe ? "KI bewertet …" : "Prüfen"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Eingabe({ frage, antwort, setAntwort, gesperrt }: { frage: QuizFrage; antwort: Antwort | null; setAntwort: (a: Antwort) => void; gesperrt: boolean }) {
  // Rechte Seite beim Zuordnen einmal mischen
  const rechts = useMemo(() => (frage.typ === "zuordnen" ? mischen(frage.paare.map((p, i) => ({ text: p.rechts, i }))) : []), [frage]);

  switch (frage.typ) {
    case "mc":
      return (
        <div className="qz-optionen">
          {frage.optionen.map((o, j) => (
            <button
              key={j}
              type="button"
              disabled={gesperrt}
              className={`qz-option ${antwort === j ? "gewaehlt" : ""} ${gesperrt && j === frage.richtig ? "richtig" : ""} ${gesperrt && antwort === j && j !== frage.richtig ? "falsch" : ""}`}
              onClick={() => setAntwort(j)}
            >
              <span className="qz-option-nr">{j + 1}</span> {o}
            </button>
          ))}
        </div>
      );
    case "wf":
      return (
        <div className="qz-optionen qz-wf">
          {[true, false].map((w) => (
            <button
              key={String(w)}
              type="button"
              disabled={gesperrt}
              className={`qz-option ${antwort === w ? "gewaehlt" : ""} ${gesperrt && w === frage.richtig ? "richtig" : ""} ${gesperrt && antwort === w && w !== frage.richtig ? "falsch" : ""}`}
              onClick={() => setAntwort(w)}
            >
              {w ? "✓ Wahr" : "✗ Falsch"}
            </button>
          ))}
        </div>
      );
    case "luecke":
      return (
        <input
          className="field qz-text"
          placeholder="Was gehört in die Lücke?"
          value={typeof antwort === "string" ? antwort : ""}
          disabled={gesperrt}
          autoFocus
          onChange={(e) => setAntwort(e.target.value)}
        />
      );
    case "frei":
      return (
        <textarea
          className="field qz-text qz-frei"
          rows={5}
          placeholder="Antworte in eigenen Worten – die KI bewertet den Inhalt (Strg+Enter zum Prüfen)."
          value={typeof antwort === "string" ? antwort : ""}
          disabled={gesperrt}
          autoFocus
          onChange={(e) => setAntwort(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              (e.currentTarget.closest(".qz-frage-karte")?.querySelector(".qz-frage-knoepfe .btnp") as HTMLButtonElement | null)?.click();
            }
          }}
        />
      );
    case "zuordnen": {
      const wahl = Array.isArray(antwort) ? antwort : [];
      return (
        <div className="qz-zuordnen">
          {frage.paare.map((p, j) => (
            <label key={j} className={`qz-paar ${gesperrt ? (wahl[j] === j ? "richtig" : "falsch") : ""}`}>
              <span>{p.links}</span>
              <select
                className="field"
                disabled={gesperrt}
                value={wahl[j] ?? ""}
                onChange={(e) => {
                  const neu = [...wahl];
                  neu[j] = e.target.value === "" ? -1 : Number(e.target.value);
                  setAntwort(neu);
                }}
              >
                <option value="">– wählen –</option>
                {rechts.map((r) => (
                  <option key={r.i} value={r.i}>
                    {r.text}
                  </option>
                ))}
              </select>
              {gesperrt && wahl[j] !== j && <small className="faint">→ {p.rechts}</small>}
            </label>
          ))}
        </div>
      );
    }
  }
}

function Ergebnisseite({
  quizId,
  fragen,
  ergebnisse,
  schwaechen: anzahlSchwaechen,
  onNochmal,
  onZurueck,
}: {
  quizId: string;
  fragen: QuizFrage[];
  ergebnisse: Ergebnis[];
  schwaechen: number;
  onNochmal: (m: Modus) => void;
  onZurueck: () => void;
}) {
  const punkte = ergebnisse.reduce((n, e) => n + e.punkte, 0);
  const prozent = Math.round((punkte / Math.max(1, ergebnisse.length)) * 100);
  const falsche = ergebnisse.filter((e) => e.punkte < 1);
  const [stapel, setStapel] = useState<{ id: string | null; laeuft: boolean; fehler: string | null }>({ id: null, laeuft: false, fehler: null });

  return (
    <div className="card qz-ergebnis">
      <div className="qz-ergebnis-kreis" style={{ ["--p" as string]: `${prozent}%` }}>
        <span>{prozent}%</span>
      </div>
      <h2>{prozent >= 90 ? "Stark! 🎉" : prozent >= 70 ? "Gut gemacht! 👍" : prozent >= 50 ? "Solide – da geht noch was." : "Dranbleiben – Übung macht's."}</h2>
      <p className="muted">
        {Math.round(punkte * 10) / 10} von {ergebnisse.length} Punkten
      </p>

      {falsche.length > 0 && (
        <>
          <h3 className="qz-ergebnis-titel">Noch nicht sicher ({falsche.length})</h3>
          <ul className="qz-falsch-liste">
            {falsche.map((e) => {
              const f = fragen.find((x) => x.id === e.frageId);
              if (!f) return null;
              return (
                <li key={e.frageId}>
                  <strong>{f.frage}</strong>
                  <span className="muted">{alsKarte(f).rueckseite.split("\n\n")[0]}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="qz-start-knoepfe">
        {falsche.length > 0 &&
          (stapel.id ? (
            <Link href={`/karteikarten/${stapel.id}/lernen`} className="btnp">
              🗂️ Karteikarten lernen
            </Link>
          ) : (
            <button
              type="button"
              className="btnp"
              disabled={stapel.laeuft}
              onClick={() => {
                setStapel({ id: null, laeuft: true, fehler: null });
                falscheAlsKarten(quizId, falsche.map((e) => e.frageId))
                  .then((a) => {
                    setStapel(a.ok ? { id: a.daten.stapelId, laeuft: false, fehler: null } : { id: null, laeuft: false, fehler: a.fehler });
                    if (a.ok) track("quiz_als_karten", { anzahl: falsche.length });
                  })
                  .catch(() => setStapel({ id: null, laeuft: false, fehler: "Das hat nicht geklappt." }));
              }}
            >
              🗂️ Falsche als Karteikarten speichern
            </button>
          ))}
        {anzahlSchwaechen > 0 && (
          <button type="button" className="btng" onClick={() => onNochmal("schwaechen")}>
            Schwächen üben ({anzahlSchwaechen})
          </button>
        )}
        <button type="button" className="btng" onClick={() => onNochmal("alle")}>
          Nochmal alle
        </button>
        <button type="button" className="btng" onClick={onZurueck}>
          Übersicht
        </button>
      </div>
      {stapel.fehler && <p className="auth-error">{stapel.fehler}</p>}
    </div>
  );
}
