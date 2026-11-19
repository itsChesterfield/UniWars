"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/nav-icon";
import { SteigText } from "@/components/bewegung/steig-text";
import { Suche } from "@/components/einstellungen/hochschule-wahl";
import { MensaWahl } from "@/components/einstellungen/mensa-wahl";
import { StundenplanFotoDialog } from "@/components/stundenplan-foto-dialog";
import { hochschuleSetzen } from "@/app/(hubs)/einstellungen/hochschule-actions";
import { archiveFach } from "@/app/fach/actions";
import { einrichtungBeenden, einrichtungFachAnlegen, einrichtungSchrittMerken, type FachKurz } from "@/app/einrichtung/actions";
import { zusammenfassung, type Schritt } from "@/lib/einrichtung";
import { track } from "@/lib/analytics";

const TEXTE: Record<Schritt, { ueber: string; titel: string; text: string }> = {
  hochschule: { ueber: "Hochschule", titel: "Wo studierst du?", text: "Damit passen Semesterzeiten und Mensa." },
  stundenplan: {
    ueber: "Stundenplan",
    titel: "Hast du deinen Stundenplan als Foto?",
    text: "Studio liest Fächer, Zeiten und Räume heraus. Du prüfst jeden Eintrag, bevor er gespeichert wird.",
  },
  kalender: {
    ueber: "Termine",
    titel: "Möchtest du deinen Google Kalender verbinden?",
    text: "Vorlesungen und Fristen erscheinen dann auch dort, Termine von dort im Hub.",
  },
  mensa: { ueber: "Mensa", titel: "Welche Mensa soll der Hub zeigen?", text: "Das Tagesangebot erscheint im Hub unter „Mensa heute“." },
  faecher: { ueber: "Fächer", titel: "Welche Fächer hast du dieses Semester?", text: "Tippe auf ein Fach, um es wieder zu entfernen." },
};

export function Einrichtung({
  name,
  schritte,
  start,
  hochschule,
  mensa,
  faecher,
  termine,
  kalenderVerbunden,
}: {
  name: string;
  schritte: Schritt[];
  start: number;
  hochschule: string | null;
  mensa: string | null;
  faecher: FachKurz[];
  termine: number;
  kalenderVerbunden: boolean;
}) {
  const router = useRouter();
  const [nr, setNr] = useState(start);
  const [richtung, setRichtung] = useState<"vor" | "zurueck">("vor");
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [hsSuchen, setHsSuchen] = useState(!hochschule);
  const [fotoOffen, setFotoOffen] = useState(false);
  const [fachName, setFachName] = useState("");
  const kopf = useRef<HTMLHeadingElement>(null);
  const erster = useRef(true);

  const n = schritte.length;
  const schritt = nr >= 1 && nr <= n ? schritte[nr - 1] : null;
  const fertig = nr > n;

  // Nach jedem Wechsel: Fokus auf die neue Frage, Stand merken
  useEffect(() => {
    if (erster.current) {
      erster.current = false;
      return;
    }
    kopf.current?.focus();
    if (nr >= 1 && nr <= n) void einrichtungSchrittMerken(nr);
  }, [nr, n]);

  function gehen(ziel: number) {
    setFehler(null);
    setRichtung(ziel < nr ? "zurueck" : "vor");
    setNr(ziel);
    if (ziel === 1 && nr === 0) track("einrichtung_gestartet");
    if (ziel > n) track("einrichtung_fertig");
  }

  function beenden(ereignis?: string) {
    if (ereignis) track(ereignis);
    starte(async () => {
      await einrichtungBeenden();
      router.replace("/");
    });
  }

  function hochschuleWaehlen(id: string | null, frei?: string) {
    setFehler(null);
    starte(async () => {
      const e = await hochschuleSetzen(id, frei ?? null).catch(() => null);
      if (!e?.ok) {
        setFehler(e && !e.ok ? e.fehler : "Speichern hat nicht geklappt.");
        return;
      }
      setHsSuchen(false);
      router.refresh();
    });
  }

  function fachHinzu() {
    const name = fachName.trim();
    if (!name) return;
    setFehler(null);
    starte(async () => {
      const e = await einrichtungFachAnlegen(name).catch(() => null);
      if (!e?.ok) {
        setFehler(e && !e.ok ? e.fehler : "Speichern hat nicht geklappt.");
        return;
      }
      setFachName("");
      router.refresh();
    });
  }

  function fachWeg(id: string) {
    setFehler(null);
    starte(async () => {
      try {
        await archiveFach(id);
        router.refresh();
      } catch {
        setFehler("Entfernen hat nicht geklappt.");
      }
    });
  }

  const texte = schritt ? TEXTE[schritt] : null;

  return (
    <div className="einr">
      <header className="einr-kopf">
        <span className="einr-marke" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M3.5 14.5c2.5 3.5 14.5-1.5 17-6" />
          </svg>
          <b>
            <span>Uni</span>Verse
          </b>
        </span>
        {schritt && (
          <span className="einr-stand">
            <span>
              {nr} von {n}
            </span>
            <span
              className="einr-bahn"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={n}
              aria-valuenow={nr}
              aria-label="Fortschritt der Einrichtung"
            >
              <i style={{ transform: `scaleX(${nr / n})` }} />
            </span>
          </span>
        )}
        {schritt && (
          <button type="button" className="link einr-spaeter" disabled={laeuft} onClick={() => beenden("einrichtung_abgebrochen")}>
            Später einrichten
          </button>
        )}
      </header>

      <main className="einr-mitte">
        <div key={nr} className={`einr-stufe ${richtung}`}>
          {nr === 0 && (
            <>
              <p className="einr-ueber">Willkommen, {name}</p>
              <h1 ref={kopf} tabIndex={-1}>
                <SteigText text="Richten wir deinen Hub ein." />
              </h1>
              <p className="einr-text">
                {n === 4 ? "Vier" : "Fünf"} kurze Fragen, je eine Sache. Alles lässt sich überspringen und später in den Einstellungen ändern.
              </p>
              <div className="einr-aktionen">
                <button type="button" className="knopf haupt gross" onClick={() => gehen(1)}>
                  Los geht’s
                </button>
                <button type="button" className="link" disabled={laeuft} onClick={() => beenden("einrichtung_uebersprungen")}>
                  Ohne Einrichtung starten
                </button>
              </div>
            </>
          )}

          {texte && (
            <>
              <p className="einr-ueber">{texte.ueber}</p>
              <h1 ref={kopf} tabIndex={-1}>
                <SteigText text={texte.titel} />
              </h1>
              <p className="einr-text">{texte.text}</p>
            </>
          )}

          {schritt === "hochschule" &&
            (hsSuchen ? (
              <div className="einr-feld">
                <Suche onGewaehlt={(h, frei) => hochschuleWaehlen(h?.id ?? null, frei)} />
              </div>
            ) : (
              <div className="einr-gewaehlt" role="status">
                <span className="einr-haken" aria-hidden="true">
                  <Icon name="haken" groesse={16} />
                </span>
                <b>{hochschule}</b>
                <button type="button" className="knopf leise klein" onClick={() => setHsSuchen(true)}>
                  Ändern
                </button>
              </div>
            ))}

          {schritt === "stundenplan" &&
            (termine > 0 ? (
              <div className="einr-gewaehlt" role="status">
                <span className="einr-haken" aria-hidden="true">
                  <Icon name="haken" groesse={16} />
                </span>
                <b>{termine === 1 ? "1 Termin" : `${termine} Termine`} im Stundenplan</b>
                <button type="button" className="knopf leise klein" onClick={() => setFotoOffen(true)}>
                  Weiteres Foto
                </button>
              </div>
            ) : (
              <button type="button" className="einr-ablage" onClick={() => setFotoOffen(true)}>
                <Icon name="kamera" groesse={22} />
                <b>Foto oder Screenshot wählen</b>
                <span>JPG oder PNG, zum Beispiel aus dem Uni-Portal</span>
              </button>
            ))}

          {schritt === "kalender" &&
            (kalenderVerbunden ? (
              <div className="einr-gewaehlt" role="status">
                <span className="einr-haken" aria-hidden="true">
                  <Icon name="haken" groesse={16} />
                </span>
                <b>Google Kalender ist verbunden</b>
              </div>
            ) : (
              <a
                className="knopf gross einr-google"
                href="/kalender/google/verbinden"
                onClick={() => {
                  track("einrichtung_kalender");
                  void einrichtungSchrittMerken(nr);
                }}
              >
                <Icon name="termine" groesse={18} />
                Mit Google Kalender verbinden
              </a>
            ))}

          {schritt === "mensa" && (
            <div className="einr-feld">
              <MensaWahl mensa={mensa} vorschlag={null} ohneKopf />
            </div>
          )}

          {schritt === "faecher" && (
            <div className="einr-feld">
              {faecher.length > 0 && (
                <ul className="einr-chips" aria-label="Deine Fächer">
                  {faecher.map((f) => (
                    <li key={f.id}>
                      <button type="button" className="einr-chip" disabled={laeuft} onClick={() => fachWeg(f.id)} aria-label={`${f.name} entfernen`}>
                        <span className="einr-fq" style={{ background: f.farbe ?? "var(--text-3)" }} aria-hidden="true" />
                        {f.name}
                        <Icon name="schliessen" groesse={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="einr-neu"
                onSubmit={(e) => {
                  e.preventDefault();
                  fachHinzu();
                }}
              >
                <input
                  className="field"
                  value={fachName}
                  maxLength={120}
                  aria-label="Neues Fach"
                  placeholder="Fach, z. B. Methodenlehre"
                  onChange={(e) => setFachName(e.target.value)}
                />
                <button type="submit" className="knopf" disabled={laeuft || !fachName.trim()}>
                  <Icon name="plus" groesse={16} />
                  Hinzufügen
                </button>
              </form>
            </div>
          )}

          {fehler && (
            <p className="auth-error" role="alert">
              {fehler}
            </p>
          )}

          {fertig && (
            <>
              <span className="einr-ring" aria-hidden="true">
                <svg viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="24" cy="24" r="21" className="kreis" pathLength={1} />
                  <path d="m15 24.5 6 6 12-13" className="hak" pathLength={1} />
                </svg>
              </span>
              <h1 ref={kopf} tabIndex={-1}>
                <SteigText text="Dein Hub ist bereit." />
              </h1>
              <p className="einr-text">
                {zusammenfassung({ hochschule, termine, faecher: faecher.length, mensa, kalender: kalenderVerbunden })}
              </p>
              <div className="einr-aktionen">
                <button type="button" className="knopf haupt gross" disabled={laeuft} onClick={() => beenden()}>
                  Zum Hub
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {schritt && (
        <footer className="einr-fuss">
          <button type="button" className="knopf" onClick={() => gehen(nr - 1)}>
            <Icon name="pfeil-links" groesse={16} />
            Zurück
          </button>
          <span className="einr-weit" />
          <button type="button" className="link" onClick={() => gehen(nr + 1)}>
            Überspringen
          </button>
          <button type="button" className="knopf haupt" onClick={() => gehen(nr + 1)}>
            Weiter
            <Icon name="pfeil-rechts" groesse={16} />
          </button>
        </footer>
      )}

      {fotoOffen && (
        <StundenplanFotoDialog
          faecher={faecher}
          vorhandene={termine}
          onSchliessen={() => setFotoOffen(false)}
          onUebernommen={() => {
            setFotoOffen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
