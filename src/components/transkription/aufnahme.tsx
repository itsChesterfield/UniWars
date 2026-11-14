"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { transkriptAnlegen } from "@/app/(hubs)/transkription/actions";
import { inDateiablage } from "@/components/transkription/audio-hilfen";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";
import { aufnahmeFormat, aufnahmeName, MAX_AUFNAHME_SEKUNDEN, TEIL_SEKUNDEN, zeitText } from "@/lib/transkription/transkript";

type Phase = "bereit" | "laeuft" | "speichert";
type Teil = { nr: number; sekunden: number; blob: Blob; status: "laedt" | "fertig" | "fehler"; anteil: number; dateiId?: string };

function datumUhrzeit(d: Date) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

/**
 * TRA-01: Aufnahme im Browser. Alle 10 Minuten beginnt ein neuer Teil (eigene Datei),
 * der sofort im Hintergrund in die Dateiablage hochgeladen wird. Nach "Stopp" entsteht
 * das Transkript; umgewandelt wird erst auf Knopfdruck (mit Anzeige der Kosten).
 */
export function Aufnahme({ faecher, verfuegbar }: { faecher: FachOption[]; verfuegbar: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("bereit");
  const [fachId, setFachId] = useState<string>("");
  const [sprache, setSprache] = useState<"de" | "en">("de");
  const [sekunden, setSekunden] = useState(0);
  const [pegel, setPegel] = useState(0);
  const [teile, setTeile] = useState<Teil[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const kontext = useRef<AudioContext | null>(null);
  const takt = useRef<number | null>(null);
  const bild = useRef<number | null>(null);
  const start = useRef<{ zeit: number; datum: Date; teilStart: number; nr: number; endung: string; mime: string; aufnahmeMime: string } | null>(null);
  const uploads = useRef<Promise<void>>(Promise.resolve());
  const teileRef = useRef<Teil[]>([]);
  const fachRef = useRef<string | null>(null);

  function teilSetzen(nr: number, aenderung: Partial<Teil>) {
    teileRef.current = teileRef.current.map((t) => (t.nr === nr ? { ...t, ...aenderung } : t));
    setTeile(teileRef.current);
  }

  // Beim Verlassen während der Aufnahme warnen; Mikrofon immer freigeben
  useEffect(() => {
    const warnen = (e: BeforeUnloadEvent) => {
      if (phase !== "bereit") e.preventDefault();
    };
    window.addEventListener("beforeunload", warnen);
    return () => window.removeEventListener("beforeunload", warnen);
  }, [phase]);
  useEffect(() => () => aufraeumen(), []);

  function aufraeumen() {
    if (takt.current) window.clearInterval(takt.current);
    if (bild.current) cancelAnimationFrame(bild.current);
    takt.current = null;
    bild.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void kontext.current?.close().catch(() => undefined);
    kontext.current = null;
  }

  async function hochladen(nr: number) {
    const teil = teileRef.current.find((t) => t.nr === nr);
    const s = start.current;
    if (!teil || !s) return;
    teilSetzen(nr, { status: "laedt", anteil: 0 });
    try {
      const datei = new File([teil.blob], aufnahmeName(s.datum, nr, s.endung), { type: s.mime });
      const neu = await inDateiablage(datei, fachRef.current, (anteil) => teilSetzen(nr, { anteil }));
      teilSetzen(nr, { status: "fertig", dateiId: neu.id, anteil: 1 });
    } catch (err) {
      teilSetzen(nr, { status: "fehler" });
      fehlerMelden(err, { ort: "aufnahme_upload" });
    }
  }

  function teilBeginnen() {
    const s = start.current;
    if (!s || !stream.current) return;
    const nr = s.nr + 1;
    const beginn = Date.now();
    s.nr = nr;
    s.teilStart = beginn;
    const rec = new MediaRecorder(stream.current, { mimeType: s.aufnahmeMime, audioBitsPerSecond: 48_000 });
    const stuecke: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) stuecke.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(stuecke, { type: s.mime });
      const dauer = Math.max(1, Math.round((Date.now() - beginn) / 1000));
      teileRef.current = [...teileRef.current, { nr, sekunden: dauer, blob, status: "laedt", anteil: 0 }];
      setTeile(teileRef.current);
      uploads.current = uploads.current.then(() => hochladen(nr));
    };
    rec.start(1000);
    recorder.current = rec;
  }

  async function starten() {
    setFehler(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setFehler("Dein Browser kann leider nicht aufnehmen. Versuch es mit einem aktuellen Chrome, Firefox oder Safari.");
      return;
    }
    const format = aufnahmeFormat((m) => MediaRecorder.isTypeSupported(m));
    if (!format) {
      setFehler("Dein Browser unterstützt kein passendes Aufnahmeformat.");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      const verweigert = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
      setFehler(verweigert ? "Bitte erlaube den Zugriff aufs Mikrofon (Schloss-Symbol in der Adressleiste)." : "Es wurde kein Mikrofon gefunden.");
      return;
    }
    fachRef.current = fachId || null;
    teileRef.current = [];
    setTeile([]);
    uploads.current = Promise.resolve();
    start.current = { zeit: Date.now(), datum: new Date(), teilStart: Date.now(), nr: 0, endung: format.endung, mime: format.mime.split(";")[0], aufnahmeMime: format.mime };

    // Pegelanzeige
    try {
      const ctx = new AudioContext();
      const analyse = ctx.createAnalyser();
      analyse.fftSize = 512;
      ctx.createMediaStreamSource(stream.current).connect(analyse);
      kontext.current = ctx;
      const werte = new Uint8Array(analyse.fftSize);
      const zeichnen = () => {
        analyse.getByteTimeDomainData(werte);
        let summe = 0;
        for (const w of werte) summe += ((w - 128) / 128) ** 2;
        setPegel(Math.min(1, Math.sqrt(summe / werte.length) * 3));
        bild.current = requestAnimationFrame(zeichnen);
      };
      zeichnen();
    } catch {
      // ohne Pegelanzeige weiter aufnehmen
    }

    teilBeginnen();
    setSekunden(0);
    setPhase("laeuft");
    track("aufnahme_gestartet");
    takt.current = window.setInterval(() => {
      const s = start.current;
      if (!s) return;
      const jetzt = Date.now();
      const gesamt = (jetzt - s.zeit) / 1000;
      setSekunden(gesamt);
      if (gesamt >= MAX_AUFNAHME_SEKUNDEN) {
        void stoppen();
        return;
      }
      // Neuer Teil: erst den neuen starten, dann den alten beenden – keine Lücke
      if (jetzt - s.teilStart >= TEIL_SEKUNDEN * 1000) {
        const alt = recorder.current;
        teilBeginnen();
        alt?.stop();
      }
    }, 250);
  }

  async function stoppen() {
    if (!recorder.current || phase === "speichert") return;
    const rec = recorder.current;
    recorder.current = null;
    if (takt.current) window.clearInterval(takt.current);
    takt.current = null;
    setPhase("speichert");
    await new Promise<void>((fertig) => {
      rec.addEventListener("stop", () => fertig(), { once: true });
      rec.stop();
    });
    aufraeumen();
    setPegel(0);
    track("aufnahme_beendet", { sekunden: Math.round(sekunden), teile: start.current?.nr ?? 0 });
    await abschliessen();
  }

  async function abschliessen() {
    await uploads.current;
    const liste = teileRef.current;
    if (liste.some((t) => t.status !== "fertig")) {
      setFehler("Ein Teil der Aufnahme konnte nicht gespeichert werden. Bitte versuch es noch einmal.");
      return;
    }
    const s = start.current;
    const fach = faecher.find((f) => f.id === fachRef.current);
    const titel = [fach?.name, `Aufnahme ${s ? datumUhrzeit(s.datum) : ""}`.trim()].filter(Boolean).join(" – ");
    const a = await transkriptAnlegen({
      titel,
      fachId: fachRef.current,
      quelle: "aufnahme",
      sprache,
      teile: liste.map((t) => ({ dateiId: t.dateiId as string, sekunden: t.sekunden })),
    }).catch(() => null);
    if (!a?.ok) {
      setFehler(a && !a.ok ? a.fehler : "Speichern hat nicht geklappt. Bitte versuch es noch einmal.");
      return;
    }
    setPhase("bereit");
    router.push(`/transkription/${a.daten.id}`);
  }

  function erneutHochladen() {
    setFehler(null);
    for (const t of teileRef.current.filter((x) => x.status === "fehler")) {
      uploads.current = uploads.current.then(() => hochladen(t.nr));
    }
    void abschliessen();
  }

  const teilNr = start.current?.nr ?? 0;
  const hochgeladen = teile.filter((t) => t.status === "fertig").length;
  const fehlgeschlagen = teile.some((t) => t.status === "fehler");

  return (
    <section className="card tra-aufnahme" aria-label="Aufnahme">
      <h2 className="ct">🎙️ Aufnehmen</h2>
      {phase === "bereit" && (
        <div className="tra-einstellungen">
          <label className="ki-feld">
            <span>Fach</span>
            <select className="field" value={fachId} onChange={(e) => setFachId(e.target.value)}>
              <option value="">Allgemein</option>
              {faecher.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="ki-feld">
            <span>Sprache</span>
            <select className="field" value={sprache} onChange={(e) => setSprache(e.target.value === "en" ? "en" : "de")}>
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
            </select>
          </label>
        </div>
      )}

      <div className="tra-rekorder">
        {phase === "bereit" ? (
          <button type="button" className="tra-start" onClick={() => void starten()}>
            <span className="tra-punkt" aria-hidden />
            Aufnahme starten
          </button>
        ) : (
          <>
            <div className="tra-zeit" aria-live="off">
              <span className={`tra-punkt ${phase === "laeuft" ? "an" : ""}`} aria-hidden />
              <strong className="mono">{zeitText(sekunden)}</strong>
              <span className="muted">/ {zeitText(MAX_AUFNAHME_SEKUNDEN)}</span>
              {teilNr > 1 && <span className="muted">· Teil {teilNr}</span>}
            </div>
            <div className="tra-pegel" role="meter" aria-label="Lautstärke" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pegel * 100)}>
              <span style={{ width: `${Math.round(pegel * 100)}%` }} />
            </div>
            {phase === "laeuft" ? (
              <button type="button" className="btnp tra-stopp" onClick={() => void stoppen()}>
                ■ Stopp
              </button>
            ) : (
              <p className="muted" aria-live="polite">
                {fehlgeschlagen ? "Speichern unterbrochen." : `Aufnahme wird gespeichert … (${hochgeladen} von ${teile.length} Teilen)`}
              </p>
            )}
          </>
        )}
      </div>

      {fehler && (
        <div className="tra-fehler">
          <p className="auth-error">{fehler}</p>
          {fehlgeschlagen && (
            <button type="button" className="btng" onClick={erneutHochladen}>
              Erneut speichern
            </button>
          )}
        </div>
      )}
      <p className="faint tra-hinweis">
        Die Aufnahme landet in der Dateiablage{fachId ? " im gewählten Fach" : ""}. Höchstens 2 Stunden.
        {!verfuegbar && " Umwandeln in Text ist gerade nicht verfügbar – aufnehmen geht trotzdem."}
      </p>
    </section>
  );
}
