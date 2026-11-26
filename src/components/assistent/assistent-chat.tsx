"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aktivHalten } from "@/lib/inaktivitaet";
import { assistentStart, notizAnhaengen, unterhaltungLaden, type AssistentNachricht } from "@/app/(hubs)/assistent/actions";
import { useRouter } from "next/navigation";
import { BlockAnzeige, ErledigtListe, KontextLeiste, StudioAntwort } from "@/components/assistent/studio-bausteine";
import { GemerktListe, KennenlernKarte, RueckblickKarte, RueckmeldungKnoepfe } from "@/components/assistent/persoenlich-bausteine";
import { studioPersoenlich, type StudioPersoenlich } from "@/app/(hubs)/einstellungen/gedaechtnis-actions";
import { inZweiterAnsichtOeffnen } from "@/lib/geteilte-ansicht";
import { NOTIZ_EINFUEGEN, STUDIO_NEU } from "@/lib/ki/studio-kontext";
import { STUDIO_NAME, type Aktion, type Block, type Erledigt, type Gemerkt, type QuellInfo } from "@/lib/ki/studio";
import { AktionskarteAnzeige } from "@/components/assistent/aktionskarte";
import { WhiteboardKarte } from "@/components/ki/whiteboard/whiteboard-karte";
import { istGrafischeBitte } from "@/lib/ki/whiteboard/ausloeser";
import { KiEinwilligungInhalt } from "@/components/ki/ki-einwilligung-dialog";
import { DiktatKnopf } from "@/components/ki/diktat-knopf";
import { VorlesenKnopf } from "@/components/ki/vorlesen-knopf";
import { einstellungLesen, einstellungSetzen, SPRACH_EINSTELLUNGEN } from "@/components/ki/sprach-status";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import { vorschlagChips, MAX_FRAGE_ZEICHEN, type Aktionskarte, type KontextEingabe } from "@/lib/ki/assistent";
import type { TextStatus } from "@/lib/ki/ergebnis";
import { kiFehlerTracken, kiGestartet } from "@/lib/ki/tracking";
import { track } from "@/lib/analytics";
import { OfflineHinweis } from "@/components/offline-hinweis";
import { Icon } from "@/components/nav-icon";
import { Umlauf } from "@/components/bewegung/umlauf";

type Laufend = {
  frage: string;
  text: string;
  status: string | null;
  karten: Aktionskarte[];
  fehler: string | null;
  erledigt: Erledigt[];
  bloecke: Block[];
  quellen: QuellInfo[];
  aktionen: Aktion[];
  gemerkt: Gemerkt[];
};
type Phase = "laden" | "nicht_verfuegbar" | "einwilligung" | "bereit";

/** SSE-Zeilen ("data: {...}\n\n") aus einem Text-Puffer lesen. */
function ereignisseLesen(puffer: string): { ereignisse: Record<string, unknown>[]; rest: string } {
  const bloecke = puffer.split("\n\n");
  const rest = bloecke.pop() ?? "";
  const ereignisse: Record<string, unknown>[] = [];
  for (const b of bloecke) {
    const zeile = b.split("\n").find((z) => z.startsWith("data: "));
    if (!zeile) continue;
    try {
      ereignisse.push(JSON.parse(zeile.slice(6)) as Record<string, unknown>);
    } catch {
      // unvollständig/ungültig – überspringen
    }
  }
  return { ereignisse, rest };
}

/**
 * KI-12: Chat mit dem UniVerse-Assistenten (Seitenleiste und Seite /assistent).
 * Antwort gestreamt, Markdown nach Abschluss, Aktionskarten in der Antwort, „Stopp“ bricht ab.
 */
export function AssistentChat({
  unterhaltungId,
  kontext,
  kontextHolen,
  onMarkierungEntfernen,
  startFrage,
  onUnterhaltung,
  autoFokus = true,
  privat = false,
}: {
  /** null = der eine gemeinsame Chat (zuletzt genutzte Unterhaltung) */
  unterhaltungId: string | null;
  kontext: KontextEingabe;
  /** Kontext frisch beim Senden lesen (aktuelle PDF-Seite, Markierung …) */
  kontextHolen?: () => KontextEingabe;
  onMarkierungEntfernen?: () => void;
  /** Frage, die beim Öffnen gleich gesendet wird (z. B. Vorschlag aus dem Lernraum) */
  startFrage?: { text: string; nr: number } | null;
  /** Neue Unterhaltung wurde angelegt bzw. hat sich geändert (für Verlauf/Adresse) */
  onUnterhaltung?: (id: string) => void;
  autoFokus?: boolean;
  /** Privater Chat: Studio lernt nichts aus diesem Gespräch */
  privat?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("laden");
  const [status, setStatus] = useState<TextStatus | null>(null);
  const [faecher, setFaecher] = useState<{ id: string; name: string }[]>([]);
  const [startFehler, setStartFehler] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(unterhaltungId);
  const [nachrichten, setNachrichten] = useState<AssistentNachricht[]>([]);
  const [verlaufLaedt, setVerlaufLaedt] = useState(Boolean(unterhaltungId));

  const [laufend, setLaufend] = useState<Laufend | null>(null);
  /** KI-16: offene grafische Erklaerung (Whiteboard-Karte) zu einer Frage */
  const [whiteboardFrage, setWhiteboardFrage] = useState<{ frage: string; key: number } | null>(null);
  useEffect(() => {
    aktivHalten("studio", laufend !== null);
    return () => aktivHalten("studio", false);
  }, [laufend]);
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [eingabeArt, setEingabeArt] = useState<"text" | "sprache">("text");
  const [optionenOffen, setOptionenOffen] = useState(false);
  const [sofortSenden, setSofortSenden] = useState(false);
  const [autoVorlesen, setAutoVorlesen] = useState(false);
  /** Antwort, die gerade automatisch vorgelesen werden soll (nur die neueste) */
  const [vorleseId, setVorleseId] = useState<string | null>(null);
  const abbruch = useRef<AbortController | null>(null);
  const ende = useRef<HTMLDivElement>(null);
  const feld = useRef<HTMLTextAreaElement>(null);
  /** Von diesem Chat selbst angelegte Unterhaltung – deren Verlauf liegt schon lokal vor */
  const selbstAngelegt = useRef<string | null>(null);
  /** „Neuer Chat“ gedrückt: die nächste Nachricht beginnt eine neue Unterhaltung */
  const neuErzwingen = useRef(false);
  /** Persönliches Modell: Kennenlernen, Semester-Auffrischen, Monatsrückblick */
  const [persoenlich, setPersoenlich] = useState<StudioPersoenlich | null>(null);
  const [kennenlernenZu, setKennenlernenZu] = useState(false);
  const [rueckblickZu, setRueckblickZu] = useState(true);

  // Geräte-Einstellungen (KI-13/14) – erst im Browser lesen
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSofortSenden(einstellungLesen(SPRACH_EINSTELLUNGEN.diktatSofortSenden));
      setAutoVorlesen(einstellungLesen(SPRACH_EINSTELLUNGEN.automatischVorlesen));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // „Neuer Chat“: Verlauf leeren, nächste Nachricht startet eine neue Unterhaltung
  useEffect(() => {
    const neu = () => {
      abbruch.current?.abort();
      neuErzwingen.current = true;
      selbstAngelegt.current = null;
      setId(null);
      setNachrichten([]);
      setLaufend(null);
      setVerlaufLaedt(false);
      setFehler(null);
    };
    window.addEventListener(STUDIO_NEU, neu);
    return () => window.removeEventListener(STUDIO_NEU, neu);
  }, []);

  // Status + Fächer einmal laden
  useEffect(() => {
    let ab = false;
    assistentStart()
      .catch(() => null)
      .then((a) => {
        if (ab) return;
        if (!a?.ok) {
          setStartFehler(a && !a.ok ? a.fehler : "Der Assistent ist gerade nicht verfügbar.");
          setPhase("nicht_verfuegbar");
          return;
        }
        setStatus(a.daten.status);
        setFaecher(a.daten.faecher);
        // Ein gemeinsamer Chat: ohne Vorgabe die zuletzt genutzte Unterhaltung laden
        if (!unterhaltungId && a.daten.hauptId) {
          setId(a.daten.hauptId);
          setVerlaufLaedt(true);
        }
        setPhase(!a.daten.status.verfuegbar ? "nicht_verfuegbar" : a.daten.status.eingewilligt ? "bereit" : "einwilligung");
        if (a.daten.status.verfuegbar) {
          studioPersoenlich()
            .then((p) => {
              if (ab) return;
              setPersoenlich(p);
              // Monatsrückblick in der ersten Woche des Monats, einmal pro Monat
              const monat = new Date().toISOString().slice(0, 7);
              let gesehen = "";
              try {
                gesehen = window.localStorage.getItem("uniwars-rueckblick") ?? "";
              } catch {
                // ohne Speicher: einmal pro Sitzung
              }
              setRueckblickZu(!(new Date().getDate() <= 7 && p.rueckblick.length > 0 && gesehen !== monat));
            })
            .catch(() => undefined);
        }
      });
    return () => {
      ab = true;
    };
  }, [unterhaltungId]);

  // Verlauf einer bestehenden Unterhaltung laden
  useEffect(() => {
    if (!id || id === selbstAngelegt.current) return;
    let ab = false;
    unterhaltungLaden(id)
      .catch(() => null)
      .then((a) => {
        if (ab) return;
        setVerlaufLaedt(false);
        if (a?.ok) setNachrichten(a.daten.nachrichten);
        else setFehler(a && !a.ok ? a.fehler : "Die Unterhaltung konnte nicht geladen werden.");
      });
    return () => {
      ab = true;
    };
  }, [id]);

  useEffect(() => () => abbruch.current?.abort(), []);
  useEffect(() => {
    ende.current?.scrollIntoView({ block: "end" });
  }, [nachrichten, laufend]);
  useEffect(() => {
    if (phase === "bereit" && autoFokus) feld.current?.focus();
  }, [phase, autoFokus]);

  const verbleibend = status ? Math.max(0, status.limit - status.genutzt) : 0;

  /** Aktionen der KI im Browser ausführen (öffnen, in die offene Notiz einfügen) */
  function aktionAusfuehren(aktion: Aktion) {
    if (aktion.art === "oeffnen") {
      track("studio_geoeffnet_durch_ki", { daneben: aktion.daneben });
      if (aktion.daneben) inZweiterAnsichtOeffnen(aktion.href, "rechts");
      else router.push(aktion.href);
      return;
    }
    // Ist die Notiz im Editor offen, fügt er ein; sonst wird serverseitig angehängt
    const detail = { notizId: aktion.notizId, text: aktion.text, erledigt: false };
    window.dispatchEvent(new CustomEvent(NOTIZ_EINFUEGEN, { detail }));
    if (!detail.erledigt) void notizAnhaengen(aktion.notizId, aktion.text).then(() => router.refresh());
  }

  const senden = useCallback(
    async (text: string, art: "text" | "sprache" = eingabeArt) => {
      const frage = text.trim();
      if (!frage || laufend || verbleibend === 0) return;
      // KI-16: Bittet der Nutzer um eine Zeichnung, oeffnet sich die Whiteboard-Karte statt der Textantwort.
      if (istGrafischeBitte(frage)) {
        setFehler(null);
        setEingabe("");
        setEingabeArt("text");
        const jetzt = new Date().toISOString();
        setNachrichten((alt) => [...alt, { id: `f-${jetzt}`, rolle: "nutzer", inhalt: frage, karten: [], erstellt_am: jetzt }]);
        setWhiteboardFrage({ frage, key: Date.now() });
        return;
      }
      setFehler(null);
      setEingabe("");
      setEingabeArt("text");
      kiGestartet("ki12");
      const start = performance.now();
      const neu: Laufend = { frage, text: "", status: null, karten: [], fehler: null, erledigt: [], bloecke: [], quellen: [], aktionen: [], gemerkt: [] };
      setLaufend(neu);
      const steuerung = new AbortController();
      abbruch.current = steuerung;
      let aktuell = neu;
      const setzen = (teil: Partial<Laufend>) => {
        aktuell = { ...aktuell, ...teil };
        setLaufend(aktuell);
      };
      let gespraech = id;
      let nachrichtId: string | null = null;
      let werkzeuge = 0;
      try {
        const antwort = await fetch("/api/ki/assistent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ unterhaltungId: id, frage, kontext: kontextHolen?.() ?? kontext, eingabeArt: art, privat, neu: !id && neuErzwingen.current }),
          signal: steuerung.signal,
        });
        if (!antwort.ok || !antwort.body) {
          const f = (await antwort.json().catch(() => null)) as { fehler?: string; typ?: string } | null;
          setLaufend(null);
          setEingabe(frage);
          if (f?.typ === "einwilligung") return setPhase("einwilligung");
          if (f?.typ === "limit") setStatus((s) => (s ? { ...s, genutzt: s.limit } : s));
          kiFehlerTracken("ki12", (f?.typ as Parameters<typeof kiFehlerTracken>[1]) ?? "technisch");
          setFehler(f?.fehler ?? `${STUDIO_NAME} ist gerade nicht verfügbar.`);
          return;
        }
        const leser = antwort.body.getReader();
        const dekoder = new TextDecoder();
        let puffer = "";
        while (true) {
          const { value, done } = await leser.read();
          if (done) break;
          puffer += dekoder.decode(value, { stream: true });
          const { ereignisse, rest } = ereignisseLesen(puffer);
          puffer = rest;
          for (const e of ereignisse) {
            if (e.typ === "start" && typeof e.unterhaltungId === "string") {
              gespraech = e.unterhaltungId;
              neuErzwingen.current = false;
              if (Array.isArray(e.quellen)) setzen({ quellen: e.quellen as QuellInfo[] });
              if (!id) {
                selbstAngelegt.current = e.unterhaltungId;
                setId(e.unterhaltungId);
                onUnterhaltung?.(e.unterhaltungId);
              }
            } else if (e.typ === "status" && typeof e.text === "string") {
              werkzeuge++;
              setzen({ status: e.text });
            } else if (e.typ === "text" && typeof e.text === "string") {
              setzen({ text: aktuell.text + e.text, status: null });
            } else if (e.typ === "karte" && e.karte) {
              setzen({ karten: [...aktuell.karten, e.karte as Aktionskarte] });
            } else if (e.typ === "erledigt" && e.eintrag) {
              setzen({ erledigt: [...aktuell.erledigt, e.eintrag as Erledigt] });
            } else if (e.typ === "block" && e.block) {
              setzen({ bloecke: [...aktuell.bloecke, e.block as Block] });
            } else if (e.typ === "aktion" && e.aktion) {
              const aktion = e.aktion as Aktion;
              setzen({ aktionen: [...aktuell.aktionen, aktion] });
              aktionAusfuehren(aktion);
            } else if (e.typ === "fehler" && typeof e.fehler === "string") {
              setzen({ fehler: e.fehler, status: null });
            } else if (e.typ === "gemerkt" && Array.isArray(e.eintraege)) {
              setzen({ gemerkt: e.eintraege as Gemerkt[] });
            } else if (e.typ === "fertig") {
              nachrichtId = typeof e.nachrichtId === "string" ? e.nachrichtId : null;
              if (typeof e.verbleibend === "number") {
                const rest = e.verbleibend;
                setStatus((s) => (s ? { ...s, genutzt: s.limit - rest } : s));
              }
            }
          }
        }
      } catch {
        if (!steuerung.signal.aborted) setzen({ fehler: "Die Verbindung wurde unterbrochen." });
      }
      // Abgeschlossen (oder gestoppt): in den Verlauf übernehmen
      const jetzt = new Date().toISOString();
      setNachrichten((alt) => [
        ...alt,
        { id: `f-${jetzt}`, rolle: "nutzer", inhalt: frage, karten: [], erstellt_am: jetzt },
        {
          id: nachrichtId ?? `a-${jetzt}`,
          rolle: "assistent",
          inhalt: aktuell.text.trim() || (aktuell.fehler && !aktuell.karten.length && !aktuell.erledigt.length ? `_(${aktuell.fehler})_` : steuerung.signal.aborted ? "_(Abgebrochen)_" : ""),
          karten: aktuell.karten,
          studio: { erledigt: aktuell.erledigt, bloecke: aktuell.bloecke, quellen: aktuell.quellen, aktionen: aktuell.aktionen, gemerkt: aktuell.gemerkt },
          erstellt_am: jetzt,
        },
      ]);
      setLaufend(null);
      if (autoVorlesen && nachrichtId && aktuell.text.trim()) setVorleseId(nachrichtId);
      if (aktuell.fehler) kiFehlerTracken("ki12", "technisch");
      track("ki_assistent_nachricht", { eingabe_art: art, werkzeuge_anzahl: werkzeuge, dauer_ms: Math.round(performance.now() - start) });
      if (gespraech && !id) onUnterhaltung?.(gespraech);
      // Nachricht-ID für Aktionskarten fehlt nach Abbruch → Verlauf frisch laden
      if (!nachrichtId && aktuell.karten.length && gespraech) {
        const a = await unterhaltungLaden(gespraech).catch(() => null);
        if (a?.ok) setNachrichten(a.daten.nachrichten);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- aktionAusfuehren nutzt nur stabile Werte (Router)
    [id, kontext, kontextHolen, laufend, onUnterhaltung, verbleibend, eingabeArt, autoVorlesen, privat],
  );


  // Vorschlagsfrage (z. B. aus dem Lernraum) einmal senden, sobald alles bereit ist
  const gesendeteStartFrage = useRef<number | null>(null);
  useEffect(() => {
    if (!startFrage || phase !== "bereit" || verlaufLaedt || laufend || gesendeteStartFrage.current === startFrage.nr) return;
    gesendeteStartFrage.current = startFrage.nr;
    void senden(startFrage.text);
  }, [startFrage, phase, verlaufLaedt, laufend, senden]);

  if (phase === "laden") return <KiLadeZustand text="Lädt …" />;
  if (phase === "nicht_verfuegbar") return <p className="ki-chat-hinweis">{startFehler ?? "Der Assistent ist gerade nicht verfügbar."}</p>;
  if (phase === "einwilligung") {
    return (
      <div className="ki-chat-hinweis">
        <KiEinwilligungInhalt
          onAbbrechen={() => setPhase("nicht_verfuegbar")}
          onZugestimmt={() => {
            track("ki_einwilligung_erteilt", { ort: "assistent" });
            setStatus((s) => (s ? { ...s, eingewilligt: true } : s));
            setPhase("bereit");
          }}
        />
      </div>
    );
  }

  const leer = nachrichten.length === 0 && !laufend && !verlaufLaedt;

  return (
    <div className="ki-chat">
      {/* Licht nur, wenn etwas arbeitet: Spur oben, solange Studio antwortet */}
      {laufend && !laufend.fehler && (
        <span className="ki-spur" aria-hidden="true">
          <i />
        </span>
      )}
      <KontextLeiste kontext={kontext} onMarkierungEntfernen={onMarkierungEntfernen} />
      <div className="ki-chat-verlauf" aria-live="polite">
        {verlaufLaedt && <KiLadeZustand text="Unterhaltung wird geladen …" />}
        {persoenlich && persoenlich.kennenlernen !== "fertig" && !kennenlernenZu && !laufend && (
          <KennenlernKarte daten={persoenlich} onFertig={() => setKennenlernenZu(true)} />
        )}
        {persoenlich && !rueckblickZu && (persoenlich.kennenlernen === "fertig" || kennenlernenZu) && (
          <RueckblickKarte
            eintraege={persoenlich.rueckblick}
            onSchliessen={() => {
              setRueckblickZu(true);
              try {
                window.localStorage.setItem("uniwars-rueckblick", new Date().toISOString().slice(0, 7));
              } catch {
                // egal
              }
            }}
          />
        )}
        {leer && (
          <div className="ki-chat-start">
            <p className="ki-chat-gruss">
              Frag alles zu deinen Unterlagen. {STUDIO_NAME} kennt, was du gerade siehst, belegt seine Antworten und legt auf Wunsch Deadlines, To-dos und Notizen an.
            </p>
            <ul className="ki-vorschlaege" aria-label="Vorschläge">
              {vorschlagChips(kontext).map((c) => (
                <li key={c}>
                  <button type="button" className="ki-vorschlag" onClick={() => void senden(c)} disabled={verbleibend === 0}>
                    <span>{c}</span>
                    <Icon name="pfeil-rechts" groesse={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {nachrichten.map((n, i) =>
          n.rolle === "nutzer" ? (
            <div key={n.id} className="ki-blase ki-blase-nutzer">
              {n.inhalt}
            </div>
          ) : (
            <div key={n.id} className="ki-blase ki-blase-ki">
              <p className="ki-wer">
                <Icon name="studio" groesse={14} />
                Studio
              </p>
              {n.inhalt && <StudioAntwort text={n.inhalt} quellen={n.studio?.quellen ?? []} />}
              {n.studio && <ErledigtListe eintraege={n.studio.erledigt} nachrichtId={n.id.startsWith("a-") ? null : n.id} />}
              {n.studio?.gemerkt?.length ? <GemerktListe eintraege={n.studio.gemerkt} /> : null}
              {n.studio?.bloecke.map((b) => (
                <BlockAnzeige key={b.id} block={b} quellen={n.studio?.quellen ?? []} nachrichtId={n.id.startsWith("a-") ? null : n.id} />
              ))}
              {n.inhalt && !n.id.startsWith("a-") && (
                <span className="ki-blase-aktionen">
                  <VorlesenKnopf text={n.inhalt} cacheKey={n.id} autoStart={vorleseId === n.id} label="Antwort vorlesen" />
                  <RueckmeldungKnoepfe
                    onNochmal={(art) =>
                      void senden(art === "einfacher" ? "Bitte erklär das nochmal einfacher." : art === "kuerzer" ? "Bitte nochmal kürzer." : "Bitte nochmal mit konkreten Beispielen.")
                    }
                  />
                  {(() => {
                    const frageDazu = [...nachrichten.slice(0, i)].reverse().find((m) => m.rolle === "nutzer")?.inhalt ?? "";
                    return (
                      <button
                        type="button"
                        className="knopf leise klein"
                        disabled={!frageDazu || verbleibend === 0}
                        onClick={() => setWhiteboardFrage({ frage: frageDazu, key: Date.now() })}
                      >
                        <Icon name="whiteboard" groesse={16} />
                        grafisch erklären
                      </button>
                    );
                  })()}
                </span>
              )}
              {n.karten.map((k) => (
                <AktionskarteAnzeige key={k.id} karte={k} nachrichtId={n.id.startsWith("a-") ? null : n.id} faecher={faecher} />
              ))}
            </div>
          ),
        )}
        {laufend && (
          <>
            <div className="ki-blase ki-blase-nutzer ki-neu">{laufend.frage}</div>
            <div className="ki-blase ki-blase-ki ki-neu">
              <p className="ki-wer">
                <Icon name="studio" groesse={14} />
                Studio
              </p>
              {laufend.text && <p className="ki-chat-roh">{laufend.text}</p>}
              {!laufend.fehler && (laufend.status || !laufend.text) && (
                <p className="ki-chat-status">
                  <Umlauf groesse={16} />
                  {laufend.status ?? "Denkt nach"}
                </p>
              )}
              <ErledigtListe key={laufend.erledigt.length} eintraege={laufend.erledigt} nachrichtId={null} />
              {laufend.gemerkt.length > 0 && <GemerktListe key={`g${laufend.gemerkt.length}`} eintraege={laufend.gemerkt} />}
              {laufend.bloecke.map((b) => (
                <BlockAnzeige key={b.id} block={b} quellen={laufend.quellen} nachrichtId={null} />
              ))}
              {laufend.karten.map((k) => (
                <AktionskarteAnzeige key={k.id} karte={k} nachrichtId={null} faecher={faecher} />
              ))}
              {laufend.fehler && <p className="auth-error">{laufend.fehler}</p>}
            </div>
          </>
        )}
        {whiteboardFrage && (
          <div className="ki-blase ki-blase-ki">
            <p className="ki-wer">
              <Icon name="studio" groesse={14} />
              Studio
            </p>
            <WhiteboardKarte
              key={whiteboardFrage.key}
              frage={whiteboardFrage.frage}
              onEinwilligung={() => setPhase("einwilligung")}
              onSchliessen={() => setWhiteboardFrage(null)}
            />
          </div>
        )}
        <div ref={ende} />
      </div>

      <KiFehlerMeldung meldung={fehler} />
      <OfflineHinweis text="Offline. Studio antwortet wieder, sobald du online bist. Deine Frage kannst du schon schreiben." />
      <form
        className="ki-chat-eingabe"
        onSubmit={(e) => {
          e.preventDefault();
          void senden(eingabe);
        }}
      >
        <textarea
          ref={feld}
          className="ki-feld"
          rows={2}
          value={eingabe}
          maxLength={MAX_FRAGE_ZEICHEN}
          placeholder="Frag Studio zu dem, was du siehst"
          aria-label={`Nachricht an ${STUDIO_NAME}`}
          onChange={(e) => {
            setEingabe(e.target.value);
            if (!e.target.value.trim()) setEingabeArt("text");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void senden(eingabe);
            }
          }}
        />
        <div className="ki-chat-fuss">
          <span className="ki-chat-werkzeuge">
            <DiktatKnopf
              disabled={Boolean(laufend) || verbleibend === 0}
              onText={(t) => {
                // KI-13: Text landet im Eingabefeld und wird NICHT automatisch gesendet (außer per Einstellung)
                const neu = eingabe.trim() ? `${eingabe.trim()} ${t}` : t;
                if (sofortSenden) void senden(neu, "sprache");
                else {
                  setEingabe(neu);
                  setEingabeArt("sprache");
                  feld.current?.focus();
                }
              }}
            />
            <button
              type="button"
              className="knopf leise klein nur-symbol"
              aria-label="Einstellungen für Sprache"
              aria-expanded={optionenOffen}
              title="Einstellungen für Sprache"
              onClick={() => setOptionenOffen((o) => !o)}
            >
              <Icon name="einstellungen" groesse={16} />
            </button>
          </span>
          {laufend ? (
            <button type="button" className="knopf leise klein nur-symbol ki-senden" aria-label="Antwort stoppen" title="Antwort stoppen" onClick={() => abbruch.current?.abort()}>
              <Icon name="stopp" groesse={16} />
            </button>
          ) : (
            <button type="submit" className="knopf haupt klein nur-symbol ki-senden" aria-label="Senden" title="Senden (Enter)" disabled={!eingabe.trim() || verbleibend === 0}>
              <Icon name="senden" groesse={16} />
            </button>
          )}
        </div>
      </form>
      {optionenOffen && (
        <div className="ki-chat-optionen">
          <label className="ki-check">
            <input
              type="checkbox"
              checked={sofortSenden}
              onChange={(e) => {
                setSofortSenden(e.target.checked);
                einstellungSetzen(SPRACH_EINSTELLUNGEN.diktatSofortSenden, e.target.checked);
              }}
            />
            Diktat sofort senden
          </label>
          <label className="ki-check">
            <input
              type="checkbox"
              checked={autoVorlesen}
              onChange={(e) => {
                setAutoVorlesen(e.target.checked);
                einstellungSetzen(SPRACH_EINSTELLUNGEN.automatischVorlesen, e.target.checked);
              }}
            />
            Antworten automatisch vorlesen
          </label>
        </div>
      )}
      <p className="ki-chat-fusszeile">
        <span>Studio kann sich irren. Was es anlegt, kannst du rückgängig machen.</span>
        <KiLimitHinweis verbleibend={verbleibend} limit={status?.limit ?? 0} einheit="Nachrichten" />
      </p>
    </div>
  );
}
