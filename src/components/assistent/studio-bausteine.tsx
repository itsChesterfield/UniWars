"use client";

import { useState } from "react";
import Link from "next/link";
import { erledigtRueckgaengig, studioKartenSpeichern, studioNotizSpeichern } from "@/app/(hubs)/assistent/actions";
import { MarkdownLesen } from "@/components/lernraum/markdown-lesen";
import { belegeVerlinken, type QuizFrage } from "@/lib/ki/lernraum";
import type { Block, Erledigt, QuellInfo } from "@/lib/ki/studio";
import type { KontextEingabe } from "@/lib/ki/assistent";
import { pdfPfad } from "@/lib/pdf-reader/fundstelle";
import { inZweiterAnsichtOeffnen, istAppPfad } from "@/lib/geteilte-ansicht";
import { fehlerMelden, track } from "@/lib/analytics";
import { Icon } from "@/components/nav-icon";

/** Beleg [Q1 S. 12] öffnen: PDF auf der Seite bzw. Notiz – daneben */
export function belegOeffnen(quellen: QuellInfo[], nr: number, seite: number | null) {
  const q = quellen.find((x) => x.nr === nr);
  if (!q) return;
  track("studio_beleg_geoeffnet", { art: q.art });
  inZweiterAnsichtOeffnen(q.art === "pdf" ? pdfPfad(q.id, seite ?? undefined) : istAppPfad(q.href) ? q.href : `/notizen?id=${q.id}`, "rechts");
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
          <Icon name={e.status === "rueckgaengig" ? "rueckgaengig" : "haken"} groesse={16} />
          {e.link && e.status === "ok" ? (
            <Link href={e.link}>{e.text}</Link>
          ) : (
            <span>
              {e.text}
              {e.status === "rueckgaengig" && ", rückgängig gemacht"}
            </span>
          )}
          {e.status === "ok" && nachrichtId && (e.ziel || e.art === "notiz_ergaenzt") && e.art !== "notiz_ergaenzt" && (
            <button
              type="button"
              className="link studio-zurueck"
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
        <span className="studio-web-titel">Im Web recherchiert</span>
        {block.quellen.map((w) => (
          <a key={w.url} className="studio-quelle" href={w.url} target="_blank" rel="noopener noreferrer">
            <Icon name="globus" groesse={14} />
            {w.titel}
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
        <Link href={`/notizen?id=${notiz}`} className="knopf leise klein">
          <Icon name="notizen" groesse={16} />
          Notiz öffnen
        </Link>
      ) : (
        <button
          type="button"
          className="knopf leise klein"
          aria-busy={laeuft || undefined}
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
          <Icon name="notizen" groesse={16} />
          Als Notiz speichern
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
        <Link href={`/karteikarten/${stapelId}/lernen`} className="knopf neben klein">
          Gespeichert, jetzt lernen
        </Link>
      ) : (
        nachrichtId && (
          <button
            type="button"
            className="knopf neben klein"
            aria-busy={laeuft || undefined}
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
            <Icon name="karteikarten" groesse={16} />
            Als Stapel speichern
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
                <strong>{gewaehlt === f.richtig ? "Richtig. " : "Leider falsch. "}</strong>
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
          <span className="zahl">{richtig}</span> von <span className="zahl">{fragen.length}</span> richtig
          {richtig === fragen.length ? ". Alles richtig." : richtig >= fragen.length / 2 ? ". Gut so." : ". Dranbleiben."}
        </p>
      )}
    </div>
  );
}

const OBJEKT_NAME: Record<string, string> = { pdf: "PDF", notiz: "Notiz", stapel: "Stapel", dokument: "Dokument", transkript: "Transkript", praesentation: "Präsentation", tabelle: "Tabelle", mindmap: "MindMap" };

/** Zeigt, worauf sich Studio gerade bezieht („Sieht gerade …“), und eine mitgenommene Markierung */
export function KontextLeiste({ kontext, onMarkierungEntfernen }: { kontext: KontextEingabe; onMarkierungEntfernen?: () => void }) {
  const teile: string[] = [];
  if (kontext.objekt) teile.push(`${OBJEKT_NAME[kontext.objekt.art] ?? "Objekt"}${kontext.seite ? `, Seite ${kontext.seite}` : ""}`);
  if (kontext.zweite) teile.push(`daneben ${OBJEKT_NAME[kontext.zweite.art] ?? "Objekt"}`);
  if (kontext.fachId) teile.push("Quellen des Fachs");
  if (kontext.karte) teile.push("aktuelle Karte");
  return (
    <>
      <p className="studio-kontext">
        <Icon name="auge" groesse={14} />
        <span>
          Sieht gerade <b>{teile.length ? teile.join(", ") : "deine Daten in UniVerse"}</b>
        </span>
      </p>
      {kontext.markiert && (
        <p className="studio-markiert">
          <span>Markiert: „{kontext.markiert}“</span>
          {onMarkierungEntfernen && (
            <button type="button" className="knopf leise klein nur-symbol" aria-label="Markierung nicht mitnehmen" onClick={onMarkierungEntfernen}>
              <Icon name="schliessen" groesse={16} />
            </button>
          )}
        </p>
      )}
    </>
  );
}
