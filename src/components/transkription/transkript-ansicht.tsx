"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  absaetzeSpeichern,
  alsNotizSpeichern,
  audioKiStatus,
  transkriptAbschliessen,
  transkriptAendern,
  transkriptKartenVorschlagen,
  transkriptLoeschen,
  transkriptStand,
  type TranskriptStand,
} from "@/app/(hubs)/transkription/actions";
import { dateiLink } from "@/app/(hubs)/dateiablage/actions";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { KiEinwilligungDialog } from "@/components/ki/ki-einwilligung-dialog";
import { KiLimitHinweis } from "@/components/ki/ki-limit-hinweis";
import { KiMarkierung } from "@/components/ki/ki-markierung";
import { KiKartenDialog } from "@/components/notizen/ki-karten-dialog";
import { KiMitschriftDialog } from "@/components/transkription/ki-mitschrift-dialog";
import type { AudioStatus } from "@/lib/ki/server";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";
import {
  gesamtStatus,
  naechsterTeil,
  offeneSekunden,
  wirksamerStatus,
  zeitText,
  type Absatz,
  type TeilStatus,
} from "@/lib/transkription/transkript";

type Transkript = { id: string; titel: string; fach_id: string | null; sprache: "de" | "en"; erstellt_am: string };
type Speicherstand = "gespeichert" | "ungespeichert" | "speichert" | "fehler";

const TEIL_TEXT: Record<TeilStatus, string> = {
  ausstehend: "wartet",
  in_bearbeitung: "wird umgewandelt …",
  fertig: "fertig",
  fehler: "Fehler",
};

export function TranskriptAnsicht({
  transkript,
  startStand,
  faecher,
  kiVerfuegbar,
}: {
  transkript: Transkript;
  startStand: TranskriptStand;
  faecher: FachOption[];
  kiVerfuegbar: boolean;
}) {
  const router = useRouter();
  const [stand, setStand] = useState(startStand);
  const [titel, setTitel] = useState(transkript.titel);
  const [fachId, setFachId] = useState(transkript.fach_id ?? "");
  const [sprache, setSprache] = useState(transkript.sprache);
  const [audio, setAudio] = useState<AudioStatus | null>(null);
  const [laufend, setLaufend] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [einwilligung, setEinwilligung] = useState<"text" | "audio" | null>(null);
  /** Bearbeitete Absätze; bis zur ersten Änderung gelten die vom Server */
  const [bearbeitet, setBearbeitet] = useState<Absatz[] | null>(null);
  const [speicher, setSpeicher] = useState<Speicherstand>("gespeichert");
  const [aktiv, setAktiv] = useState(-1);
  const [playerTeil, setPlayerTeil] = useState(1);
  const [dialog, setDialog] = useState<"mitschrift" | "karten" | null>(null);
  const [notiz, setNotiz] = useState<{ id: string } | null>(null);
  const [notizSpeichert, setNotizSpeichert] = useState(false);

  const player = useRef<HTMLAudioElement>(null);
  const urls = useRef(new Map<number, string>());
  /** Teile, die in diesem Durchlauf schon gestartet wurden (kein endloses Wiederholen) */
  const [versucht, setVersucht] = useState<string[]>([]);
  const startet = useRef(false);
  const speicherTimer = useRef<number | null>(null);
  const absaetzeRef = useRef<Absatz[]>(startStand.absaetze);
  const absaetze = bearbeitet ?? stand.absaetze;

  const status = gesamtStatus(stand.teile);
  const fertig = status === "fertig";
  const inArbeit = stand.teile.some((t) => wirksamerStatus(t) === "in_bearbeitung");
  const leer = fertig && stand.teile.every((t) => !t.text.trim());
  const offen = offeneSekunden(stand.teile);
  const gesamt = stand.teile.reduce((n, t) => n + t.sekunden, 0);

  // Kontingent und Einwilligungen für die Anzeige vor dem Start
  const statusLaden = useCallback(async () => {
    const a = await audioKiStatus().catch(() => null);
    if (a?.ok) setAudio(a.daten);
  }, []);
  useEffect(() => {
    if (fertig) return;
    let ab = false;
    audioKiStatus()
      .catch(() => null)
      .then((a) => {
        if (!ab && a?.ok) setAudio(a.daten);
      });
    return () => {
      ab = true;
    };
  }, [fertig]);

  // TRA-03: Status alle 3 Sekunden abfragen, solange etwas läuft
  const brauchtAbfrage = inArbeit || (fertig && !leer && stand.absaetze.length === 0);
  useEffect(() => {
    if (!brauchtAbfrage) return;
    let leereRunden = 0;
    const id = window.setInterval(async () => {
      const a = await transkriptStand(transkript.id).catch(() => null);
      if (!a?.ok) return;
      setStand(a.daten);
      if (gesamtStatus(a.daten.teile) === "fertig") track("transkription_fertig", { teile: a.daten.teile.length });
      if (gesamtStatus(a.daten.teile) === "fertig" && a.daten.absaetze.length === 0 && ++leereRunden >= 3) {
        await transkriptAbschliessen(transkript.id).catch(() => null);
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [brauchtAbfrage, transkript.id]);

  const teilStarten = useCallback(
    async (teilId: string) => {
      startet.current = true;
      setVersucht((v) => [...v, teilId]);
      setMeldung(null);
      const vorher = stand.teile.find((t) => t.id === teilId)?.status ?? "ausstehend";
      const setzen = (s: TeilStatus) => setStand((st) => ({ ...st, teile: st.teile.map((t) => (t.id === teilId ? { ...t, status: s, gestartet_am: new Date().toISOString(), fehler: null } : t)) }));
      setzen("in_bearbeitung");
      try {
        const antwort = await fetch("/api/ki/transkription", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ teilId }),
        });
        const daten = (await antwort.json().catch(() => null)) as
          | { ok: true; daten: { status: string; verbleibendSekunden?: number } }
          | { ok: false; fehler: string; typ: string; art?: "text" | "audio" }
          | null;
        if (!antwort.ok || !daten?.ok) {
          setzen(vorher);
          setLaufend(false);
          if (daten && !daten.ok && daten.typ === "einwilligung") {
            setEinwilligung(daten.art ?? "audio");
            return;
          }
          setMeldung(daten && !daten.ok ? daten.fehler : "Die Umwandlung konnte nicht gestartet werden. Bitte versuch es noch einmal.");
          track("transkription_fehler", { typ: daten && !daten.ok ? daten.typ : "technisch" });
          void statusLaden();
          return;
        }
        if (typeof daten.daten.verbleibendSekunden === "number") {
          const rest = daten.daten.verbleibendSekunden;
          setAudio((a) => (a ? { ...a, genutztSekunden: a.limitSekunden - rest } : a));
        }
      } catch {
        setzen(vorher);
        setLaufend(false);
        setMeldung("Keine Verbindung. Bitte versuch es noch einmal.");
      } finally {
        startet.current = false;
      }
    },
    [stand.teile, statusLaden],
  );

  // Teile nacheinander umwandeln, solange der Nutzer gestartet hat. Ein Teil, der in diesem
  // Durchlauf schon versucht wurde und fehlschlug, hält die Kette an (Meldung steht am Teil).
  const kandidat = naechsterTeil(stand.teile);
  const weiter = laufend && kandidat !== null && !versucht.includes(kandidat.id);
  useEffect(() => {
    if (!weiter || inArbeit || startet.current || !kandidat) return;
    void teilStarten(kandidat.id);
  }, [weiter, inArbeit, kandidat, teilStarten]);

  function starten() {
    if (!audio) return;
    if (!audio.verfuegbar) {
      setMeldung("Die Umwandlung in Text ist gerade nicht verfügbar.");
      return;
    }
    // KI-D1, dann KI-D2 (Audio geht an den KI-Anbieter)
    if (!audio.eingewilligt) return setEinwilligung("text");
    if (!audio.audioEingewilligt) return setEinwilligung("audio");
    setVersucht([]);
    track("transkription_gestartet", { teile: stand.teile.length, sekunden: offen });
    setLaufend(true);
  }

  // --- Abspielen (TRA-04) ------------------------------------------------------
  const urlFuer = useCallback(
    async (nr: number) => {
      const vorhanden = urls.current.get(nr);
      if (vorhanden) return vorhanden;
      const teil = stand.teile.find((t) => t.nr === nr);
      if (!teil?.datei_id) return null;
      const url = await dateiLink(teil.datei_id).catch(() => null);
      if (url) urls.current.set(nr, url);
      return url;
    },
    [stand.teile],
  );

  useEffect(() => {
    let ab = false;
    void urlFuer(1).then((url) => {
      if (!ab && url && player.current && !player.current.src) player.current.src = url;
    });
    return () => {
      ab = true;
    };
  }, [urlFuer]);

  async function springen(teil: number, start: number | null, abspielen: boolean) {
    const el = player.current;
    if (!el) return;
    if (teil !== playerTeil || !el.src) {
      const url = await urlFuer(teil);
      if (!url) {
        setMeldung("Die Audiodatei zu diesem Teil wurde gelöscht.");
        return;
      }
      el.src = url;
      setPlayerTeil(teil);
      await new Promise<void>((fertigGeladen) => {
        el.addEventListener("loadedmetadata", () => fertigGeladen(), { once: true });
        el.addEventListener("error", () => fertigGeladen(), { once: true });
      });
    }
    if (start !== null) el.currentTime = start;
    if (abspielen) void el.play().catch(() => undefined);
  }

  function zeitAktualisiert() {
    const t = player.current?.currentTime ?? 0;
    let gefunden = -1;
    absaetze.forEach((a, i) => {
      if (a.teil === playerTeil && a.start !== null && a.start <= t + 0.1) gefunden = i;
    });
    setAktiv(gefunden);
  }

  // --- Bearbeiten und Speichern (TRA-04) ---------------------------------------
  const speichern = useCallback(async () => {
    if (speicherTimer.current) window.clearTimeout(speicherTimer.current);
    speicherTimer.current = null;
    setSpeicher("speichert");
    const a = await absaetzeSpeichern(transkript.id, absaetzeRef.current).catch(() => null);
    setSpeicher(a?.ok ? "gespeichert" : "fehler");
    if (!a?.ok) setMeldung(a && !a.ok ? a.fehler : "Speichern hat nicht geklappt.");
  }, [transkript.id]);

  function absatzAendern(i: number, text: string) {
    absaetzeRef.current = absaetze.map((a, j) => (j === i ? { ...a, text } : a));
    setBearbeitet(absaetzeRef.current);
    setSpeicher("ungespeichert");
    if (speicherTimer.current) window.clearTimeout(speicherTimer.current);
    speicherTimer.current = window.setTimeout(() => void speichern(), 1200);
  }

  const ausstehendSpeichern = useCallback(async () => {
    if (speicherTimer.current) await speichern();
  }, [speichern]);

  useEffect(() => {
    const warnen = (e: BeforeUnloadEvent) => {
      if (speicherTimer.current || weiter) e.preventDefault();
    };
    window.addEventListener("beforeunload", warnen);
    return () => window.removeEventListener("beforeunload", warnen);
  }, [weiter]);

  async function kopfAendern(aenderung: { titel?: string; fachId?: string | null; sprache?: "de" | "en" }) {
    const a = await transkriptAendern(transkript.id, aenderung).catch(() => null);
    if (!a?.ok) setMeldung(a && !a.ok ? a.fehler : "Speichern hat nicht geklappt.");
  }

  async function notizSpeichern() {
    setNotizSpeichert(true);
    await ausstehendSpeichern();
    const a = await alsNotizSpeichern(transkript.id).catch(() => null);
    setNotizSpeichert(false);
    if (!a?.ok) {
      setMeldung(a && !a.ok ? a.fehler : "Speichern hat nicht geklappt.");
      return;
    }
    track("transkript_als_notiz");
    setNotiz({ id: a.daten.notizId });
  }

  async function loeschen() {
    if (!window.confirm(`„${titel}“ wirklich löschen? Die Audiodateien bleiben in der Dateiablage.`)) return;
    const a = await transkriptLoeschen(transkript.id).catch(() => null);
    if (!a?.ok) {
      window.alert("Löschen hat nicht geklappt.");
      return;
    }
    router.push("/transkription");
  }

  const restSekunden = audio ? Math.max(0, audio.limitSekunden - audio.genutztSekunden) : 0;
  const reicht = audio ? offen <= restSekunden : true;
  const naechster = naechsterTeil(stand.teile);
  const fehlerTeil = stand.teile.find((t) => wirksamerStatus(t) === "fehler");
  const laufenderTeil = stand.teile.find((t) => wirksamerStatus(t) === "in_bearbeitung");

  return (
    <div className="tra-ansicht">
      <div className="tra-kopf">
        <Link href="/transkription" className="btng" title="Alle Transkripte">
          ←
        </Link>
        <input
          className="field tra-titel"
          aria-label="Titel"
          value={titel}
          maxLength={200}
          onChange={(e) => setTitel(e.target.value)}
          onBlur={() => {
            if (titel.trim() && titel !== transkript.titel) void kopfAendern({ titel });
          }}
        />
        <select
          className="field tra-fach"
          aria-label="Fach"
          value={fachId}
          onChange={(e) => {
            setFachId(e.target.value);
            void kopfAendern({ fachId: e.target.value || null });
          }}
        >
          <option value="">Allgemein</option>
          {faecher.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <DreiPunkteMenue punkte={[{ label: "Löschen", onClick: () => void loeschen(), gefahr: true }]} />
      </div>

      <div className="card tra-player">
        <audio
          ref={player}
          controls
          preload="metadata"
          onTimeUpdate={zeitAktualisiert}
          onEnded={() => {
            if (playerTeil < stand.teile.length) void springen(playerTeil + 1, 0, true);
          }}
          onError={() => urls.current.delete(playerTeil)}
        />
        {stand.teile.length > 1 && (
          <div className="tra-teile-wahl" role="group" aria-label="Teil der Aufnahme">
            {stand.teile.map((t) => (
              <button key={t.id} type="button" className={`seg ${playerTeil === t.nr ? "on" : ""}`} onClick={() => void springen(t.nr, 0, false)}>
                Teil {t.nr}
              </button>
            ))}
          </div>
        )}
      </div>

      {meldung && <p className="auth-error" role="alert">{meldung}</p>}

      {!fertig && (
        <section className="card tra-umwandeln" aria-live="polite">
          <h2 className="ct">In Text umwandeln</h2>
          <p className="muted">
            {stand.teile.length > 1 ? `${stand.teile.length} Teile · ` : ""}
            {zeitText(gesamt)} Aufnahme
          </p>
          {stand.teile.length > 1 && (
            <ul className="tra-teile">
              {stand.teile.map((t) => {
                const s = wirksamerStatus(t);
                return (
                  <li key={t.id} className={`tra-teil-${s}`}>
                    Teil {t.nr} · {zeitText(t.sekunden)} · {TEIL_TEXT[s]}
                    {s === "fehler" && t.fehler ? ` – ${t.fehler}` : ""}
                  </li>
                );
              })}
            </ul>
          )}
          {stand.teile.length === 1 && fehlerTeil && (
            <p className="auth-error">{fehlerTeil.fehler ?? "Die Umwandlung wurde abgebrochen. Bitte versuch es noch einmal."}</p>
          )}

          {laufenderTeil || weiter ? (
            <p className="tra-fortschritt">
              <span className="ki-spinner tra-spinner" aria-hidden />
              {stand.teile.length > 1 ? `Teil ${laufenderTeil?.nr ?? naechster?.nr ?? ""} von ${stand.teile.length} wird umgewandelt …` : "Wird umgewandelt …"}
              <span className="muted"> Das dauert etwa eine Minute pro 10 Minuten Aufnahme. Du kannst die Seite verlassen.</span>
            </p>
          ) : (
            <>
              <label className="ki-feld tra-sprache">
                <span>Sprache der Aufnahme</span>
                <select
                  className="field"
                  value={sprache}
                  onChange={(e) => {
                    const neu = e.target.value === "en" ? "en" : "de";
                    setSprache(neu);
                    void kopfAendern({ sprache: neu });
                  }}
                >
                  <option value="de">Deutsch</option>
                  <option value="en">Englisch</option>
                </select>
              </label>
              {audio && (
                <p className="muted">
                  Verbraucht etwa {Math.ceil(offen / 60)} von deinen Audio-Minuten.{" "}
                  {!reicht && restSekunden > 0 && "Dein Kontingent reicht nicht für alles – es wird umgewandelt, so weit es reicht."}
                </p>
              )}
              <div className="ki-fuss">
                {audio ? (
                  <KiLimitHinweis
                    verbleibend={Math.floor(restSekunden / 60)}
                    limit={Math.round(audio.limitSekunden / 60)}
                    einheit="Audio-Minuten"
                    zeitraum="monat"
                  />
                ) : (
                  <span />
                )}
                <button type="button" className="btnp" onClick={starten} disabled={!audio || restSekunden <= 0 || !naechster}>
                  🎙️ {fehlerTeil ? "Erneut versuchen" : stand.teile.some((t) => t.status === "fertig") ? "Fortsetzen" : "Transkribieren"}
                </button>
              </div>
              {audio && !audio.verfuegbar && <p className="muted">Die Umwandlung ist gerade nicht verfügbar.</p>}
            </>
          )}
        </section>
      )}

      {fertig && (
        <>
          <div className="tra-aktionen">
            <span className="muted tra-speicher" aria-live="polite">
              <KiMarkierung /> Von der KI umgewandelt – Fehler beim Hören sind möglich.{" "}
              {speicher === "speichert" ? "Speichert …" : speicher === "ungespeichert" ? "Ungespeicherte Änderungen" : speicher === "fehler" ? "Nicht gespeichert" : "Gespeichert"}
            </span>
            <span className="tra-knoepfe">
              {notiz ? (
                <Link href={`/notizen?id=${notiz.id}`} className="btng">
                  📝 Notiz öffnen
                </Link>
              ) : (
                <button type="button" className="btng" onClick={() => void notizSpeichern()} disabled={notizSpeichert || leer}>
                  {notizSpeichert ? "Speichert …" : "In Notizen speichern"}
                </button>
              )}
              {kiVerfuegbar && !leer && (
                <>
                  <button type="button" className="btng" onClick={() => void ausstehendSpeichern().then(() => setDialog("karten"))}>
                    ✨ Karteikarten
                  </button>
                  <button type="button" className="btnp" onClick={() => void ausstehendSpeichern().then(() => setDialog("mitschrift"))}>
                    ✨ Als Notiz aufbereiten
                  </button>
                </>
              )}
            </span>
          </div>

          {leer ? (
            <p className="empty-state">In der Aufnahme wurde keine Sprache erkannt.</p>
          ) : absaetze.length === 0 ? (
            <p className="muted">Text wird zusammengesetzt …</p>
          ) : (
            <section className="card tra-text" aria-label="Transkript">
              {absaetze.map((a, i) => (
                <div key={i} className={`tra-absatz ${aktiv === i ? "aktiv" : ""}`}>
                  {a.start !== null ? (
                    <button
                      type="button"
                      className="tra-zeitstempel mono"
                      title="Ab hier abspielen"
                      onClick={() => void springen(a.teil, a.start, true)}
                    >
                      ▶ {stand.teile.length > 1 ? `T${a.teil} ` : ""}
                      {zeitText(a.start)}
                    </button>
                  ) : (
                    <span className="tra-zeitstempel" />
                  )}
                  <textarea
                    className="tra-absatz-text"
                    aria-label={`Absatz ${i + 1}`}
                    value={a.text}
                    rows={Math.max(2, Math.ceil(a.text.length / 85))}
                    onChange={(e) => absatzAendern(i, e.target.value)}
                    onClick={() => {
                      if (a.start !== null) void springen(a.teil, a.start, false);
                    }}
                    onBlur={() => {
                      if (speicherTimer.current) void speichern();
                    }}
                  />
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {einwilligung && (
        <KiEinwilligungDialog
          art={einwilligung}
          onSchliessen={() => setEinwilligung(null)}
          onZugestimmt={() => {
            const art = einwilligung;
            setEinwilligung(null);
            const neu = audio ? { ...audio, ...(art === "text" ? { eingewilligt: true } : { audioEingewilligt: true }) } : audio;
            setAudio(neu);
            track("ki_einwilligung_erteilt", { ort: "transkription", art });
            // Nach KI-D1 direkt KI-D2, danach geht es los
            if (neu && !neu.audioEingewilligt) setEinwilligung("audio");
            else if (neu) {
              setVersucht([]);
              setLaufend(true);
            }
          }}
        />
      )}
      {dialog === "mitschrift" && <KiMitschriftDialog transkriptId={transkript.id} onSchliessen={() => setDialog(null)} />}
      {dialog === "karten" && (
        <KiKartenDialog
          notiz={{ titel, fach_id: fachId || null }}
          faecher={faecher}
          vorschlagen={(n) =>
            transkriptKartenVorschlagen(transkript.id, n).catch((err) => {
              fehlerMelden(err, { ort: "transkript_karten" });
              throw err;
            })
          }
          ladeText="Die KI liest dein Transkript …"
          kuerzungsText="Nur der Anfang des Transkripts wurde verwendet."
          onSchliessen={() => setDialog(null)}
        />
      )}
    </div>
  );
}
