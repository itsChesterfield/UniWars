"use client";

import { useState } from "react";
import Link from "next/link";
import {
  gedaechtnisStatusSetzen,
  kennenlernenBestaetigen,
  kennenlernenSpeichern,
  kennenlernenUeberspringen,
  studioRueckmeldung,
  type StudioPersoenlich,
} from "@/app/(hubs)/einstellungen/gedaechtnis-actions";
import { KENNENLERN_FRAGEN } from "@/lib/ki/gedaechtnis";
import type { Gemerkt } from "@/lib/ki/studio";
import type { Rueckmeldung } from "@/lib/ki/lernraum";
import { STUDIO_NAME } from "@/lib/ki/studio";
import { fehlerMelden, track } from "@/lib/analytics";

/** Unter einer Antwort: was Studio über dich gelernt hat – mit Rückgängig bzw. Ja/Nein */
export function GemerktListe({ eintraege }: { eintraege: Gemerkt[] }) {
  const [liste, setListe] = useState(
    eintraege.map((e) => ({
      ...e,
      erledigt: null as null | "ja" | "nein" | "zurueck",
    })),
  );
  if (!liste.length) return null;
  const setzen = (id: string, erledigt: "ja" | "nein" | "zurueck") =>
    setListe((l) => l.map((x) => (x.id === id ? { ...x, erledigt } : x)));
  return (
    <ul className="studio-gemerkt">
      {liste.map((e) => (
        <li
          key={`${e.id}-${e.art}`}
          className={
            e.erledigt === "zurueck" || e.erledigt === "nein" ? "zurueck" : ""
          }
        >
          <span aria-hidden>🧠</span>
          {e.status === "vorschlag" && e.art === "neu" && !e.erledigt ? (
            <>
              <span>
                Soll ich mir merken: <strong>{e.inhalt}</strong>?
              </span>
              <span className="studio-gemerkt-knoepfe">
                <button
                  type="button"
                  onClick={() => {
                    setzen(e.id, "ja");
                    void gedaechtnisStatusSetzen(e.id, "aktiv").catch(
                      () => undefined,
                    );
                    track("gedaechtnis_vorschlag", { antwort: "ja" });
                  }}
                >
                  Ja
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setzen(e.id, "nein");
                    void gedaechtnisStatusSetzen(e.id, "verworfen").catch(
                      () => undefined,
                    );
                    track("gedaechtnis_vorschlag", { antwort: "nein" });
                  }}
                >
                  Nein
                </button>
              </span>
            </>
          ) : (
            <>
              <span>
                {e.erledigt === "nein"
                  ? "Nicht gemerkt: "
                  : e.erledigt === "zurueck"
                    ? "Rückgängig: "
                    : e.art === "vergessen"
                      ? "Vergessen: "
                      : e.art === "geaendert"
                        ? "Aktualisiert: "
                        : "Gemerkt: "}
                {e.inhalt}
              </span>
              {!e.erledigt && e.art !== "vergessen" && (
                <button
                  type="button"
                  className="studio-zurueck"
                  onClick={() => {
                    setzen(e.id, "zurueck");
                    void gedaechtnisStatusSetzen(e.id, "verworfen").catch(
                      () => undefined,
                    );
                    track("gedaechtnis_rueckgaengig");
                  }}
                >
                  Rückgängig
                </button>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

const RUECKMELDUNGEN: { art: Rueckmeldung; text: string; titel: string }[] = [
  { art: "gut", text: "👍", titel: "Hilfreich" },
  {
    art: "einfacher",
    text: "Einfacher",
    titel: "Bitte einfacher erklären – merke ich mir",
  },
  { art: "kuerzer", text: "Kürzer", titel: "Bitte kürzer – merke ich mir" },
  {
    art: "beispiele",
    text: "Mehr Beispiele",
    titel: "Mehr Beispiele – merke ich mir",
  },
];

/** Rückmeldung in einem Klick – fließt ins Lernprofil und ins Gedächtnis */
export function RueckmeldungKnoepfe({
  onNochmal,
}: {
  onNochmal?: (art: Rueckmeldung) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<Rueckmeldung | null>(null);
  if (gewaehlt)
    return (
      <span className="studio-rueckmeldung-danke faint">
        {gewaehlt === "gut" ? "Danke!" : "Gemerkt – ab jetzt so."}
      </span>
    );
  return (
    <span className="studio-rueckmeldung">
      {RUECKMELDUNGEN.map((r) => (
        <button
          key={r.art}
          type="button"
          title={r.titel}
          onClick={() => {
            setGewaehlt(r.art);
            track("studio_rueckmeldung", { art: r.art });
            studioRueckmeldung(r.art).catch((err) =>
              fehlerMelden(err, { ort: "studio_rueckmeldung" }),
            );
            if (r.art !== "gut") onNochmal?.(r.art);
          }}
        >
          {r.text}
        </button>
      ))}
    </span>
  );
}

/** Kennenlernen (5 Fragen) beim ersten Mal – bzw. Auffrischen zum Semesterwechsel */
export function KennenlernKarte({
  daten,
  onFertig,
}: {
  daten: StudioPersoenlich;
  onFertig: () => void;
}) {
  const [modus, setModus] = useState<"fragen" | "auffrischen">(
    daten.kennenlernen === "auffrischen" && daten.auffrischen.length
      ? "auffrischen"
      : "fragen",
  );
  const [schritt, setSchritt] = useState(0);
  const [antworten, setAntworten] = useState<Record<string, string>>({});
  const [eingabe, setEingabe] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  if (modus === "auffrischen") {
    return (
      <div className="studio-kennenlernen">
        <p className="studio-kennenlernen-titel">
          🎓 Neues Semester? Stimmt das noch?
        </p>
        <ul className="studio-kennenlernen-liste">
          {daten.auffrischen.map((e) => (
            <li key={e.id}>{e.inhalt}</li>
          ))}
        </ul>
        <div className="studio-kennenlernen-knoepfe">
          <button
            type="button"
            className="btnp"
            onClick={() => {
              void kennenlernenBestaetigen().catch(() => undefined);
              track("kennenlernen_auffrischen", { antwort: "stimmt" });
              onFertig();
            }}
          >
            Stimmt alles
          </button>
          <button
            type="button"
            className="btng"
            onClick={() => setModus("fragen")}
          >
            Neu beantworten
          </button>
        </div>
      </div>
    );
  }

  const frage = KENNENLERN_FRAGEN[schritt];
  const weiter = (antwort: string) => {
    const neu = { ...antworten, [frage.id]: antwort.trim() };
    setAntworten(neu);
    setEingabe("");
    if (schritt + 1 < KENNENLERN_FRAGEN.length) {
      setSchritt(schritt + 1);
      return;
    }
    setLaeuft(true);
    kennenlernenSpeichern(neu)
      .then((a) => track("kennenlernen_fertig", { antworten: a.anzahl }))
      .catch((err) => fehlerMelden(err, { ort: "kennenlernen" }))
      .finally(() => onFertig());
  };

  return (
    <div className="studio-kennenlernen">
      <p className="studio-kennenlernen-titel">
        👋 Lass uns kurz kennenlernen{" "}
        <span className="faint">
          ({schritt + 1}/{KENNENLERN_FRAGEN.length})
        </span>
      </p>
      <p className="faint studio-kennenlernen-text">
        Damit {STUDIO_NAME} Erklärungen, Beispiele und Pläne auf dich
        zuschneidet. Alles änderbar unter „Was Studio über dich weiß“.
      </p>
      <p className="studio-kennenlernen-frage">{frage.frage}</p>
      <div className="ki-chips">
        {frage.vorschlaege.map((v) => (
          <button
            key={v}
            type="button"
            className="ki-chip"
            disabled={laeuft}
            onClick={() => weiter(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <form
        className="studio-kennenlernen-eingabe"
        onSubmit={(e) => {
          e.preventDefault();
          if (eingabe.trim()) weiter(eingabe);
        }}
      >
        <input
          className="field"
          value={eingabe}
          maxLength={200}
          placeholder="Oder in eigenen Worten …"
          onChange={(e) => setEingabe(e.target.value)}
          disabled={laeuft}
        />
        <button
          type="submit"
          className="btnp"
          disabled={laeuft || !eingabe.trim()}
        >
          Weiter
        </button>
      </form>
      <div className="studio-kennenlernen-knoepfe">
        <button
          type="button"
          className="studio-zurueck"
          disabled={laeuft}
          onClick={() => weiter("")}
        >
          Frage überspringen
        </button>
        <button
          type="button"
          className="studio-zurueck"
          disabled={laeuft}
          onClick={() => {
            void kennenlernenUeberspringen().catch(() => undefined);
            track("kennenlernen_uebersprungen", { schritt });
            onFertig();
          }}
        >
          Später
        </button>
      </div>
    </div>
  );
}

/** Monatsrückblick: was Studio in den letzten 30 Tagen gelernt hat */
export function RueckblickKarte({
  eintraege,
  onSchliessen,
}: {
  eintraege: { id: string; inhalt: string }[];
  onSchliessen: () => void;
}) {
  return (
    <div className="studio-kennenlernen studio-rueckblick">
      <p className="studio-kennenlernen-titel">
        🧠 Das habe ich diesen Monat über dich gelernt
      </p>
      <ul className="studio-kennenlernen-liste">
        {eintraege.map((e) => (
          <li key={e.id}>{e.inhalt}</li>
        ))}
      </ul>
      <div className="studio-kennenlernen-knoepfe">
        <Link
          href="/einstellungen/gedaechtnis"
          className="btng"
          onClick={onSchliessen}
        >
          Ansehen und korrigieren
        </Link>
        <button type="button" className="studio-zurueck" onClick={onSchliessen}>
          Passt so
        </button>
      </div>
    </div>
  );
}
