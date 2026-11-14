"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { transkriptAnlegen, transkriptLoeschen } from "@/app/(hubs)/transkription/actions";
import { dateiLink } from "@/app/(hubs)/dateiablage/actions";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { Aufnahme } from "@/components/transkription/aufnahme";
import { audioDauer, inDateiablage } from "@/components/transkription/audio-hilfen";
import { groesseText } from "@/lib/dateiablage/dateien";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";
import { gesamtStatus, MAX_DATEI_SEKUNDEN, zeitText, type TeilInfo, type TeilStatus } from "@/lib/transkription/transkript";

export type TranskriptEintrag = {
  id: string;
  titel: string;
  fach_id: string | null;
  quelle: "aufnahme" | "datei";
  erstellt_am: string;
  teile: TeilInfo[];
};

type AudioDatei = { id: string; name: string; fach_id: string | null; groesse: number; erstellt_am: string };

const STATUS_TEXT: Record<TeilStatus, string> = {
  ausstehend: "Noch nicht umgewandelt",
  in_bearbeitung: "In Bearbeitung …",
  fertig: "Fertig",
  fehler: "Fehler",
};

const AUDIO_ENDUNGEN = ".mp3,.m4a,.wav,.webm,.ogg";

function datum(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** TRA-02: Audio aus der Dateiablage wählen oder neu hochladen (MP3, M4A, WAV …). */
function DateiAuswahl({ audioDateien, faecher, startDateiId }: { audioDateien: AudioDatei[]; faecher: FachOption[]; startDateiId: string | null }) {
  const router = useRouter();
  const eingabe = useRef<HTMLInputElement>(null);
  const [auswahl, setAuswahl] = useState<string>(startDateiId && audioDateien.some((d) => d.id === startDateiId) ? startDateiId : "");
  const [sprache, setSprache] = useState<"de" | "en">("de");
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (startDateiId && auswahl === startDateiId) document.getElementById("tra-datei")?.scrollIntoView({ block: "center" });
  }, [startDateiId, auswahl]);

  async function anlegen(datei: { id: string; name: string; fach_id: string | null }, sekunden: number) {
    if (sekunden > MAX_DATEI_SEKUNDEN) {
      setFehler("Die Datei ist länger als 60 Minuten. Nimm längere Vorlesungen direkt hier auf – dann wird automatisch geteilt.");
      return;
    }
    setLaeuft("Wird vorbereitet …");
    const a = await transkriptAnlegen({
      titel: datei.name.replace(/\.[a-z0-9]+$/i, ""),
      fachId: datei.fach_id,
      quelle: "datei",
      sprache,
      teile: [{ dateiId: datei.id, sekunden }],
    }).catch(() => null);
    if (!a?.ok) {
      setLaeuft(null);
      setFehler(a && !a.ok ? a.fehler : "Das hat nicht geklappt. Bitte versuch es noch einmal.");
      return;
    }
    track("transkript_angelegt", { quelle: "datei" });
    router.push(`/transkription/${a.daten.id}`);
  }

  async function vorhandeneNehmen() {
    const datei = audioDateien.find((d) => d.id === auswahl);
    if (!datei) return;
    setFehler(null);
    setLaeuft("Länge wird geprüft …");
    try {
      await anlegen(datei, await audioDauer(await dateiLink(datei.id)));
    } catch (err) {
      setLaeuft(null);
      setFehler(err instanceof Error && err.message.includes("Länge") ? err.message : "Die Datei konnte nicht gelesen werden.");
    }
  }

  async function neueHochladen(datei: File) {
    setFehler(null);
    const url = URL.createObjectURL(datei);
    try {
      setLaeuft("Länge wird geprüft …");
      const sekunden = await audioDauer(url);
      if (sekunden > MAX_DATEI_SEKUNDEN) {
        await anlegen({ id: "", name: datei.name, fach_id: null }, sekunden);
        return;
      }
      setLaeuft("Wird hochgeladen …");
      const neu = await inDateiablage(datei, null, (anteil) => setLaeuft(`Wird hochgeladen … ${Math.round(anteil * 100)} %`));
      await anlegen(neu, sekunden);
    } catch (err) {
      setLaeuft(null);
      setFehler(err instanceof Error && err.message.length < 160 ? err.message : "Hochladen hat nicht geklappt.");
      fehlerMelden(err, { ort: "transkription_upload" });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return (
    <section className="card tra-datei" id="tra-datei" aria-label="Datei transkribieren">
      <h2 className="ct">📁 Datei transkribieren</h2>
      <p className="muted">Audio aus der Dateiablage wählen oder neu hochladen (MP3, M4A, WAV, WebM, Ogg · bis 25 MB und 60 Minuten).</p>
      <div className="tra-einstellungen">
        <label className="ki-feld tra-breit">
          <span>Aus der Dateiablage</span>
          <select className="field" value={auswahl} onChange={(e) => setAuswahl(e.target.value)} disabled={Boolean(laeuft)}>
            <option value="">{audioDateien.length ? "Datei wählen …" : "Noch keine Audiodateien"}</option>
            {audioDateien.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {groesseText(d.groesse)}
                {d.fach_id ? ` · ${faecher.find((f) => f.id === d.fach_id)?.name ?? ""}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="ki-feld">
          <span>Sprache</span>
          <select className="field" value={sprache} onChange={(e) => setSprache(e.target.value === "en" ? "en" : "de")} disabled={Boolean(laeuft)}>
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
          </select>
        </label>
      </div>
      <div className="tra-knoepfe">
        <button type="button" className="btng" onClick={() => eingabe.current?.click()} disabled={Boolean(laeuft)}>
          ⤒ Neue Datei hochladen
        </button>
        <button type="button" className="btnp" onClick={() => void vorhandeneNehmen()} disabled={!auswahl || Boolean(laeuft)}>
          Weiter
        </button>
        <input
          ref={eingabe}
          type="file"
          hidden
          accept={AUDIO_ENDUNGEN}
          onChange={(e) => {
            const datei = e.target.files?.[0];
            e.target.value = "";
            if (datei) void neueHochladen(datei);
          }}
        />
      </div>
      {laeuft && (
        <p className="muted" aria-live="polite">
          {laeuft}
        </p>
      )}
      {fehler && <p className="auth-error">{fehler}</p>}
    </section>
  );
}

export function TranskriptionHub({
  eintraege,
  faecher,
  audioDateien,
  startDateiId,
  verfuegbar,
}: {
  eintraege: TranskriptEintrag[];
  faecher: FachOption[];
  audioDateien: AudioDatei[];
  startDateiId: string | null;
  verfuegbar: boolean;
}) {
  const router = useRouter();
  const fachFilter = useSearchParams().get("fachId");
  const sichtbar = eintraege.filter((e) => !fachFilter || e.fach_id === fachFilter);

  async function loeschen(e: TranskriptEintrag) {
    if (!window.confirm(`„${e.titel}“ wirklich löschen? Die Audiodateien bleiben in der Dateiablage.`)) return;
    const a = await transkriptLoeschen(e.id).catch(() => null);
    if (!a?.ok) {
      window.alert("Löschen hat nicht geklappt.");
      return;
    }
    track("transkript_geloescht");
    router.refresh();
  }

  return (
    <>
      <HubKopf titel="Transkription" untertitel="Vorlesungen aufnehmen und in Text umwandeln – mit Zeitstempeln zum Nachhören." />
      {!verfuegbar && <p className="ki-hinweis">Die Umwandlung in Text ist gerade nicht verfügbar. Aufnehmen und Hochladen funktioniert trotzdem.</p>}
      <div className="tra-start-raster">
        <Aufnahme faecher={faecher} verfuegbar={verfuegbar} />
        <DateiAuswahl audioDateien={audioDateien} faecher={faecher} startDateiId={startDateiId} />
      </div>

      <h2 className="tra-liste-titel">Deine Transkripte</h2>
      <FachFilterChips faecher={faecher} />
      {sichtbar.length === 0 ? (
        <LeererZustand icon="🎙️" text={eintraege.length ? "In diesem Fach gibt es noch keine Transkripte." : "Noch keine Transkripte. Starte eine Aufnahme oder wähle eine Audiodatei."} />
      ) : (
        <section className="card">
          <ul className="tra-liste">
            {sichtbar.map((e) => {
              const status = gesamtStatus(e.teile);
              const dauer = e.teile.reduce((n, t) => n + t.sekunden, 0);
              const fach = faecher.find((f) => f.id === e.fach_id);
              return (
                <li key={e.id}>
                  <Link href={`/transkription/${e.id}`} className="tra-eintrag">
                    <span className="tra-eintrag-titel">
                      {e.quelle === "aufnahme" ? "🎙️" : "📁"} {e.titel}
                    </span>
                    <span className="muted tra-eintrag-info">
                      {fach && (
                        <>
                          <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} aria-hidden /> {fach.name} ·{" "}
                        </>
                      )}
                      {datum(e.erstellt_am)} · {zeitText(dauer)}
                    </span>
                    <span className={`tra-status tra-status-${status}`}>{STATUS_TEXT[status]}</span>
                  </Link>
                  <DreiPunkteMenue punkte={[{ label: "Löschen", onClick: () => void loeschen(e), gefahr: true }]} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
