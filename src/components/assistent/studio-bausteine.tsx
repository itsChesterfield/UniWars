"use client";

import { useState } from "react";
import Link from "next/link";
import { erledigtRueckgaengig, studioKartenSpeichern, studioNotizSpeichern } from "@/app/(hubs)/assistent/actions";
import { MarkdownLesen } from "@/components/lernraum/markdown-lesen";
import { belegeVerlinken, type QuizFrage } from "@/lib/ki/lernraum";
import type { Block, Erledigt, QuellInfo } from "@/lib/ki/studio";
import type { KontextEingabe } from "@/lib/ki/assistent";
import { inZweiterAnsichtOeffnen } from "@/lib/geteilte-ansicht";
import { fehlerMelden, track } from "@/lib/analytics";

/** Beleg [Q1 S. 12] öffnen: PDF auf der Seite bzw. Notiz – daneben */
export function belegOeffnen(quellen: QuellInfo[], nr: number, seite: number | null) {
  const q = quellen.find((x) => x.nr === nr);
  if (!q) return;
  track("studio_beleg_geoeffnet", { art: q.art });
  inZweiterAnsichtOeffnen(q.art === "pdf" ? `/pdf-reader/${q.id}${seite ? `?seite=${seite}` : ""}` : `/notizen?id=${q.id}`, "rechts");
}

/** Antworttext mit anklickbaren Belegen */
export function StudioAntwort({ text, quellen }: { text: string; quellen: QuellInfo[] }) {
  return (
    <MarkdownLesen
      wert={belegeVerlinken(text, (nr) => quellen.find((q) => q.nr === nr)?.titel ?? null)}
      onBeleg={(nr, s) => belegOeffnen(quellen, nr, s)}
    />
  );
}

/** Was die KI erledigt hat – mit Link und „Rückgängig“ */
export function ErledigtListe({ eintraege, nachrichtId }: { eintraege: Erledigt[]; nachrichtId: string | null }) {
  const [liste, setListe] = useState(eintraege);
  const [fehler, setFehler] = useState<string | null>(null);
  if (!liste.length) return null;
  return (
    <ul className="studio-erledigt">
      {liste.map((e) => (
        <li key={e.id} className={e.status === "rueckgaengig" ? "zurueck" : ""}>
          <span aria-hidden>{e.status === "rueckgaengig" ? "↩" : "✓"}</span>
          {e.link && e.status === "ok" ? (
            <Link href={e.link}>{e.text}</Link>
          ) : (
            <span>
              {e.text}
              {e.status === "rueckgaengig" && " – rückgängig gemacht"}
            </span>
          )}
          {e.status === "ok" && nachrichtId && (e.ziel || e.art === "notiz_ergaenzt") && e.art !== "notiz_ergaenzt" && (
            <button
              type="button"
              className="studio-zurueck"
              onClick={() => {
                setFehler(null);
                erledigtRueckgaengig(nachrichtId, e.id)
                  .then((a) => {
                    if (a.ok) {
                      setListe((l) => l.map((x) => (x.id === e.id ? { ...x, status: "rueckgaengig" } : x)));
                      track("studio_rueckgaengig", { art: e.art });
                    } else setFehler(a.fehler);
                  })
                  .catch(() => setFehler("Das hat nicht geklappt."));
              }}
            >
              Rückgängig
            </button>
          )}
        </li>
      ))}
      {fehler && <li className="auth-error">{fehler}</li>}
    </ul>
  );
}

/** Lernmaterial, Quiz, Karteikarten oder Webquellen im Chat */
export function BlockAnzeige({ block, quellen, nachrichtId }: { block: Block; quellen: QuellInfo[]; nachrichtId: string | null }) {
  if (block.typ === "web") {
    return (
      <div className="studio-web">
        <span className="faint">Im Web recherchiert:</span>
        {block.quellen.map((w) => (
          <a key={w.url} href={w.url} target="_blank" rel="noopener noreferrer">
            🌐 {w.titel}
          </a>
        ))}
      </div>
    );
  }
  return (
    <div className="studio-block">
      <div className="studio-block-titel">{block.titel}</div>
      {block.typ === "markdown" && <MarkdownBlock titel={block.titel} markdown={block.markdown} quellen={quellen} />}
      {block.typ === "quiz" && <Quiz fragen={block.fragen} quellen={quellen} />}
      {block.typ === "karten" && <KartenBlock block={block} nachrichtId={nachrichtId} />}
    </div>
  );
}

function MarkdownBlock({ titel, markdown, quellen }: { titel: string; markdown: string; quellen: QuellInfo[] }) {
  const [notiz, setNotiz] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  return (
    <>
      <StudioAntwort text={markdown} quellen={quellen} />
      {notiz ? (
        <Link href={`/notizen?id=${notiz}`} className="btng">
          📝 Notiz öffnen
        </Link>
      ) : (
        <button
          type="button"
          className="btng"
          disabled={laeuft}
          onClick={() => {
            setLaeuft(true);
            studioNotizSpeichern(titel, markdown, quellen)
              .then((a) => {
                if (a.ok) {
                  setNotiz(a.daten.notizId);
                  track("studio_als_notiz");
                }
              })
              .catch((err) => fehlerMelden(err, { ort: "studio_notiz" }))
              .finally(() => setLaeuft(false));
          }}
        >
          📝 Als Notiz speichern
        </button>
      )}
    </>
  );
}

function KartenBlock({ block, nachrichtId }: { block: Extract<Block, { typ: "karten" }>; nachrichtId: string | null }) {
  const [stapelId, setStapelId] = useState(block.stapelId ?? null);
  const [laeuft, setLaeuft] = useState(false);
  return (
    <div className="lr-karten">
      {block.karten.map((k, i) => (
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
        nachrichtId && (
          <button
            type="button"
            className="btnp"
            disabled={laeuft}
            onClick={() => {
              setLaeuft(true);
              studioKartenSpeichern(nachrichtId, block.id)
                .then((a) => {
                  if (a.ok) {
                    setStapelId(a.daten.stapelId);
                    track("studio_karten_gespeichert", { anzahl: block.karten.length });
                  }
                })
                .catch((err) => fehlerMelden(err, { ort: "studio_karten" }))
                .finally(() => setLaeuft(false));
            }}
          >
            🗂️ Als Karteikarten-Stapel speichern
          </button>
        )
      )}
    </div>
  );
}

export function Quiz({ fragen, quellen }: { fragen: QuizFrage[]; quellen: QuellInfo[] }) {
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
                  <button type="button" className="lr-beleg-knopf" onClick={() => belegOeffnen(quellen, Number(beleg[1]), beleg[2] ? Number(beleg[2]) : null)}>
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

const OBJEKT_ICON: Record<string, string> = { pdf: "📕", notiz: "📝", stapel: "🗂️", dokument: "📄", transkript: "🎙️", praesentation: "🖥️", tabelle: "📊", mindmap: "🧠" };
const OBJEKT_NAME: Record<string, string> = { pdf: "PDF", notiz: "Notiz", stapel: "Stapel", dokument: "Dokument", transkript: "Transkript", praesentation: "Präsentation", tabelle: "Tabelle", mindmap: "MindMap" };

/** Zeigt, worauf sich das Studio gerade bezieht */
export function KontextLeiste({ kontext, onMarkierungEntfernen }: { kontext: KontextEingabe; onMarkierungEntfernen?: () => void }) {
  const teile: { text: string; weg?: () => void }[] = [];
  if (kontext.objekt) teile.push({ text: `${OBJEKT_ICON[kontext.objekt.art] ?? "•"} ${OBJEKT_NAME[kontext.objekt.art] ?? "Objekt"}${kontext.seite ? ` · S. ${kontext.seite}` : ""}` });
  if (kontext.zweite) teile.push({ text: `⫽ daneben: ${OBJEKT_NAME[kontext.zweite.art] ?? "Objekt"}` });
  if (kontext.fachId) teile.push({ text: "🎓 Quellen des Fachs" });
  if (kontext.karte) teile.push({ text: "🗂️ aktuelle Karte" });
  if (kontext.markiert) teile.push({ text: `✂️ Markierung (${kontext.markiert.length} Zeichen)`, weg: onMarkierungEntfernen });
  if (!teile.length) return <p className="studio-kontext faint">Bezieht sich auf: deine Daten in UniWars</p>;
  return (
    <p className="studio-kontext">
      <span className="faint">Bezieht sich auf:</span>
      {teile.map((t) => (
        <span key={t.text} className="studio-kontext-chip">
          {t.text}
          {t.weg && (
            <button type="button" aria-label="Entfernen" onClick={t.weg}>
              ×
            </button>
          )}
        </span>
      ))}
    </p>
  );
}
