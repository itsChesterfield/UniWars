"use client";

/**
 * KI-16.6: Whiteboard-Karte in einer Assistenten-Antwort. Ruft die Route auf,
 * liest den NDJSON-Stream, baut die Zeichnung verschraenkt mit dem Erklaertext
 * auf, laesst sich stoppen und bietet nach „fertig" das Speichern als Whiteboard
 * an (ueber die bestehende Whiteboard-Infrastruktur).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Whiteboard } from "@/components/ki/whiteboard/whiteboard";
import { Icon } from "@/components/nav-icon";
import { ereignisAnwenden, LEERE_ZEICHNUNG, type Zeichnung } from "@/lib/ki/whiteboard/zeichnung";
import { ereignisseAusStream } from "@/lib/ki/whiteboard/stream-leser";
import { zeichnungZuElementen } from "@/lib/ki/whiteboard/speichern";
import { whiteboardAnlegen, whiteboardSpeichern } from "@/app/(hubs)/whiteboard/actions";

type Phase = "laedt" | "zeichnet" | "fertig" | "fehler" | "einwilligung";

export function WhiteboardKarte({
  frage,
  kontext,
  onEinwilligung,
  onSchliessen,
}: {
  frage: string;
  kontext?: string;
  onEinwilligung?: () => void;
  onSchliessen?: () => void;
}) {
  const [zeichnung, setZeichnung] = useState<Zeichnung>(LEERE_ZEICHNUNG);
  const [texte, setTexte] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>("laedt");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const abbruch = useRef<AbortController | null>(null);
  const aktuell = useRef<Zeichnung>(LEERE_ZEICHNUNG);
  const einwilligungRef = useRef(onEinwilligung);
  useEffect(() => {
    einwilligungRef.current = onEinwilligung;
  }, [onEinwilligung]);

  // Die Karte wird je Frage frisch gemountet (key), daher kein Zuruecksetzen noetig.
  useEffect(() => {
    const steuerung = new AbortController();
    abbruch.current = steuerung;
    let lokal = LEERE_ZEICHNUNG;

    void (async () => {
      try {
        const antwort = await fetch("/api/ki/whiteboard", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ frage, kontext }),
          signal: steuerung.signal,
        });
        if (!antwort.ok || !antwort.body) {
          const f = (await antwort.json().catch(() => null)) as { fehler?: string; typ?: string } | null;
          if (f?.typ === "einwilligung") {
            setPhase("einwilligung");
            einwilligungRef.current?.();
            return;
          }
          setFehler(f?.fehler ?? "Das Zeichnen hat gerade nicht geklappt.");
          setPhase("fehler");
          return;
        }
        setPhase("zeichnet");
        await ereignisseAusStream(
          antwort.body,
          {
            aufEreignis: (e) => {
              if (e.typ === "sagen") setTexte((t) => [...t, e.text]);
              else if (e.typ === "fertig") setPhase("fertig");
              else {
                lokal = ereignisAnwenden(lokal, e);
                aktuell.current = lokal;
                setZeichnung(lokal);
              }
            },
          },
          steuerung.signal,
        );
        setPhase((p) => (p === "zeichnet" || p === "laedt" ? "fertig" : p));
      } catch {
        if (!steuerung.signal.aborted) {
          setFehler("Die Verbindung wurde unterbrochen.");
          setPhase("fehler");
        }
      }
    })();

    return () => steuerung.abort();
  }, [frage, kontext]);

  function stoppen() {
    abbruch.current?.abort();
    setPhase((p) => (p === "zeichnet" || p === "laedt" ? "fertig" : p));
  }

  async function speichern() {
    if (speichert || gespeichert) return;
    setSpeichert(true);
    setFehler(null);
    try {
      const name = aktuell.current.titel?.trim() || frage.trim().slice(0, 60) || "Zeichnung";
      const id = await whiteboardAnlegen(null, name);
      await whiteboardSpeichern(id, zeichnungZuElementen(aktuell.current));
      setGespeichert(`/whiteboard/${id}`);
    } catch {
      setFehler("Speichern hat gerade nicht geklappt.");
    } finally {
      setSpeichert(false);
    }
  }

  const hatInhalt = zeichnung.elemente.length > 0 || Boolean(zeichnung.titel);

  return (
    <div className="ki-karte" role="group" aria-label="Grafische Erklaerung">
      <div className="ki-karte-kopf">
        <span className="ki-karte-art">
          <Icon name="whiteboard" groesse={16} />
          Grafische Erklaerung
        </span>
        {onSchliessen && (
          <button type="button" className="knopf leise klein nur-symbol" aria-label="Schliessen" onClick={onSchliessen}>
            <Icon name="schliessen" groesse={14} />
          </button>
        )}
      </div>

      {texte.length > 0 && (
        <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
          {texte.map((t, i) => (
            <p key={i} style={{ margin: 0 }}>
              {t}
            </p>
          ))}
        </div>
      )}

      {phase === "einwilligung" ? (
        <p className="muted">Bitte stimme zuerst der KI-Nutzung zu, dann klappt die grafische Erklaerung.</p>
      ) : hatInhalt ? (
        <Whiteboard zeichnung={zeichnung} />
      ) : phase === "laedt" || phase === "zeichnet" ? (
        <p className="ki-chat-status">Zeichnet …</p>
      ) : null}

      {fehler && <p className="auth-error ki-karte-fehler">{fehler}</p>}

      <div className="ki-karte-knoepfe">
        {(phase === "laedt" || phase === "zeichnet") && (
          <button type="button" className="knopf leise klein" onClick={stoppen}>
            <Icon name="stopp" groesse={14} />
            Stopp
          </button>
        )}
        {phase === "fertig" && hatInhalt && !gespeichert && (
          <button type="button" className="knopf neben klein" aria-busy={speichert || undefined} disabled={speichert} onClick={() => void speichern()}>
            {speichert ? "Speichert" : "Als Whiteboard speichern"}
          </button>
        )}
        {gespeichert && (
          <Link href={gespeichert} className="link">
            Whiteboard oeffnen
          </Link>
        )}
      </div>
    </div>
  );
}
