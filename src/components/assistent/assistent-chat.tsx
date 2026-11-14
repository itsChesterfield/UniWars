"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { assistentStart, unterhaltungLaden, type AssistentNachricht } from "@/app/(hubs)/assistent/actions";
import { AktionskarteAnzeige } from "@/components/assistent/aktionskarte";
import { KiEinwilligungInhalt } from "@/components/ki/ki-einwilligung-dialog";
import { KiFehlerMeldung } from "@/components/ki/ki-fehler-meldung";
import { KiLadeZustand } from "@/components/ki/ki-lade-zustand";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import { MarkdownAnzeige } from "@/components/hubs/markdown-editor";
import { vorschlagChips, MAX_FRAGE_ZEICHEN, type Aktionskarte, type KontextEingabe } from "@/lib/ki/assistent";
import type { TextStatus } from "@/lib/ki/ergebnis";
import { kiFehlerTracken, kiGestartet } from "@/lib/ki/tracking";
import { track } from "@/lib/analytics";

type Laufend = { frage: string; text: string; status: string | null; karten: Aktionskarte[]; fehler: string | null };
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
 * KI-12: Chat mit dem UniWars-Assistenten (Seitenleiste und Seite /assistent).
 * Antwort gestreamt, Markdown nach Abschluss, Aktionskarten in der Antwort, „Stopp“ bricht ab.
 */
export function AssistentChat({
  unterhaltungId,
  kontext,
  onUnterhaltung,
  autoFokus = true,
}: {
  unterhaltungId: string | null;
  kontext: KontextEingabe;
  /** Neue Unterhaltung wurde angelegt bzw. hat sich geändert (für Verlauf/Adresse) */
  onUnterhaltung?: (id: string) => void;
  autoFokus?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("laden");
  const [status, setStatus] = useState<TextStatus | null>(null);
  const [faecher, setFaecher] = useState<{ id: string; name: string }[]>([]);
  const [startFehler, setStartFehler] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(unterhaltungId);
  const [nachrichten, setNachrichten] = useState<AssistentNachricht[]>([]);
  const [verlaufLaedt, setVerlaufLaedt] = useState(Boolean(unterhaltungId));

  const [laufend, setLaufend] = useState<Laufend | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const abbruch = useRef<AbortController | null>(null);
  const ende = useRef<HTMLDivElement>(null);
  const feld = useRef<HTMLTextAreaElement>(null);
  /** Von diesem Chat selbst angelegte Unterhaltung – deren Verlauf liegt schon lokal vor */
  const selbstAngelegt = useRef<string | null>(null);

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
        setPhase(!a.daten.status.verfuegbar ? "nicht_verfuegbar" : a.daten.status.eingewilligt ? "bereit" : "einwilligung");
      });
    return () => {
      ab = true;
    };
  }, []);

  // Verlauf einer bestehenden Unterhaltung laden
  useEffect(() => {
    if (!unterhaltungId || unterhaltungId === selbstAngelegt.current) return;
    let ab = false;
    unterhaltungLaden(unterhaltungId)
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
  }, [unterhaltungId]);

  useEffect(() => () => abbruch.current?.abort(), []);
  useEffect(() => {
    ende.current?.scrollIntoView({ block: "end" });
  }, [nachrichten, laufend]);
  useEffect(() => {
    if (phase === "bereit" && autoFokus) feld.current?.focus();
  }, [phase, autoFokus]);

  const verbleibend = status ? Math.max(0, status.limit - status.genutzt) : 0;

  const senden = useCallback(
    async (text: string) => {
      const frage = text.trim();
      if (!frage || laufend || verbleibend === 0) return;
      setFehler(null);
      setEingabe("");
      kiGestartet("ki12");
      const start = performance.now();
      const neu: Laufend = { frage, text: "", status: null, karten: [], fehler: null };
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
          body: JSON.stringify({ unterhaltungId: id, frage, kontext, eingabeArt: "text" }),
          signal: steuerung.signal,
        });
        if (!antwort.ok || !antwort.body) {
          const f = (await antwort.json().catch(() => null)) as { fehler?: string; typ?: string } | null;
          setLaufend(null);
          setEingabe(frage);
          if (f?.typ === "einwilligung") return setPhase("einwilligung");
          if (f?.typ === "limit") setStatus((s) => (s ? { ...s, genutzt: s.limit } : s));
          kiFehlerTracken("ki12", (f?.typ as Parameters<typeof kiFehlerTracken>[1]) ?? "technisch");
          setFehler(f?.fehler ?? "Der Assistent ist gerade nicht verfügbar.");
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
            } else if (e.typ === "fehler" && typeof e.fehler === "string") {
              setzen({ fehler: e.fehler, status: null });
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
          inhalt: aktuell.text.trim() || (aktuell.fehler && !aktuell.karten.length ? `_(${aktuell.fehler})_` : steuerung.signal.aborted ? "_(Abgebrochen)_" : ""),
          karten: aktuell.karten,
          erstellt_am: jetzt,
        },
      ]);
      setLaufend(null);
      if (aktuell.fehler) kiFehlerTracken("ki12", "technisch");
      track("ki_assistent_nachricht", { eingabe_art: "text", werkzeuge_anzahl: werkzeuge, dauer_ms: Math.round(performance.now() - start) });
      if (gespraech && !id) onUnterhaltung?.(gespraech);
      // Nachricht-ID für Aktionskarten fehlt nach Abbruch → Verlauf frisch laden
      if (!nachrichtId && aktuell.karten.length && gespraech) {
        const a = await unterhaltungLaden(gespraech).catch(() => null);
        if (a?.ok) setNachrichten(a.daten.nachrichten);
      }
    },
    [id, kontext, laufend, onUnterhaltung, verbleibend],
  );

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
      <div className="ki-chat-verlauf" aria-live="polite">
        {verlaufLaedt && <KiLadeZustand text="Unterhaltung wird geladen …" />}
        {leer && (
          <div className="ki-chat-start">
            <p className="ki-chat-gruss">Hi! Ich kenne deinen Stundenplan, deine Deadlines, Karteikarten und Notizen. Wobei kann ich helfen?</p>
            <div className="ki-chips">
              {vorschlagChips(kontext).map((c) => (
                <button key={c} type="button" className="ki-chip" onClick={() => void senden(c)} disabled={verbleibend === 0}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        {nachrichten.map((n) =>
          n.rolle === "nutzer" ? (
            <div key={n.id} className="ki-blase ki-blase-nutzer">
              {n.inhalt}
            </div>
          ) : (
            <div key={n.id} className="ki-blase ki-blase-ki">
              {n.inhalt && <MarkdownAnzeige wert={n.inhalt} className="ki-chat-md" />}
              {n.karten.map((k) => (
                <AktionskarteAnzeige key={k.id} karte={k} nachrichtId={n.id.startsWith("a-") ? null : n.id} faecher={faecher} />
              ))}
              {/* KI-14 (Phase 13): Platz für „Vorlesen“ */}
            </div>
          ),
        )}
        {laufend && (
          <>
            <div className="ki-blase ki-blase-nutzer">{laufend.frage}</div>
            <div className="ki-blase ki-blase-ki">
              {laufend.text ? <p className="ki-chat-roh">{laufend.text}</p> : !laufend.status && !laufend.fehler && <p className="ki-chat-status">Denkt nach …</p>}
              {laufend.status && <p className="ki-chat-status">{laufend.status}</p>}
              {laufend.karten.map((k) => (
                <AktionskarteAnzeige key={k.id} karte={k} nachrichtId={null} faecher={faecher} />
              ))}
              {laufend.fehler && <p className="auth-error">{laufend.fehler}</p>}
            </div>
          </>
        )}
        <div ref={ende} />
      </div>

      <KiFehlerMeldung meldung={fehler} />
      <form
        className="ki-chat-eingabe"
        onSubmit={(e) => {
          e.preventDefault();
          void senden(eingabe);
        }}
      >
        <textarea
          ref={feld}
          className="field"
          rows={2}
          value={eingabe}
          maxLength={MAX_FRAGE_ZEICHEN}
          placeholder="Frag den Assistenten …"
          aria-label="Nachricht an den Assistenten"
          onChange={(e) => setEingabe(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void senden(eingabe);
            }
          }}
        />
        {/* KI-13 (Phase 13): Platz für den Mikrofon-Knopf */}
        <div className="ki-chat-fuss">
          <KiLimitHinweis verbleibend={verbleibend} limit={status?.limit ?? 0} einheit="Nachrichten" />
          {laufend ? (
            <button type="button" className="btng" onClick={() => abbruch.current?.abort()}>
              ■ Stopp
            </button>
          ) : (
            <button type="submit" className="btnp" disabled={!eingabe.trim() || verbleibend === 0}>
              Senden
            </button>
          )}
        </div>
      </form>
      <p className="faint ki-chat-fusszeile">✨ KI kann sich irren. Gespeichert wird nur, was du übernimmst.</p>
    </div>
  );
}
