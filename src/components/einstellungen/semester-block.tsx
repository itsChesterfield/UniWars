"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rueckmeldungAlsFrist, semesterSpeichern } from "@/app/(hubs)/einstellungen/semester-actions";
import type { Ergebnis } from "@/app/settings/actions";
import { datumKurz, semesterName, semesterStand, type SemesterTermine } from "@/lib/semester";
import { track } from "@/lib/analytics";

const FELDER: { feld: keyof Omit<SemesterTermine, "semester">; name: string; pflicht?: boolean }[] = [
  { feld: "vorlesung_beginn", name: "Vorlesungsbeginn", pflicht: true },
  { feld: "vorlesung_ende", name: "Vorlesungsende", pflicht: true },
  { feld: "pruefung_beginn", name: "Prüfungszeit ab" },
  { feld: "pruefung_ende", name: "Prüfungszeit bis" },
  { feld: "rueckmeldung_bis", name: "Rückmeldung bis" },
];

/** Semestertermine der eigenen Hochschule: anzeigen, gemeinsam pflegen, Rückmeldung als Frist übernehmen */
export function SemesterBlock({
  termine,
  gepflegt,
  geaendertAm,
  land,
  heute,
}: {
  termine: SemesterTermine;
  gepflegt: boolean;
  geaendertAm: string | null;
  land: string;
  heute: string;
}) {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [bearbeiten, setBearbeiten] = useState(false);
  const [werte, setWerte] = useState(termine);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const stand = semesterStand(termine, heute);

  function ausfuehren(aktion: () => Promise<Ergebnis>, ereignis: string, danach?: () => void) {
    starte(async () => {
      try {
        const e = await aktion();
        setErgebnis(e);
        if (e.ok) {
          track(ereignis);
          danach?.();
          router.refresh();
        }
      } catch {
        setErgebnis({ ok: false, fehler: "Das hat nicht geklappt. Bitte versuch es noch einmal." });
      }
    });
  }

  const standText =
    stand.phase === "vorlesungen"
      ? `Vorlesungswoche ${stand.woche} von ${stand.wochen}`
      : stand.phase === "vor_beginn"
        ? `Vorlesungen ab ${datumKurz(termine.vorlesung_beginn)}`
        : stand.phase === "pruefungen"
          ? "Prüfungszeit"
          : "Vorlesungsfreie Zeit";

  return (
    <div className="hs-verif">
      <h3>
        {semesterName(termine.semester, land)}<span className="faint">, {standText}</span>
      </h3>
      <p className="muted">
        {gepflegt
          ? `Von Studierenden deiner Hochschule eingetragen${geaendertAm ? ` (zuletzt ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(geaendertAm))})` : ""}. Stimmt etwas nicht? Korrigiere es für alle.`
          : "Das sind Richtwerte für deine Hochschulart. Trag die echten Termine ein, sie gelten dann für alle an deiner Hochschule."}
      </p>

      {!bearbeiten ? (
        <>
          <dl className="sem-termine">
            {FELDER.map(({ feld, name }) => (
              <div key={feld}>
                <dt>{name}</dt>
                <dd className="zahl">{datumKurz(termine[feld])}</dd>
              </div>
            ))}
          </dl>
          <div className="hs-gewaehlt">
            {termine.rueckmeldung_bis && termine.rueckmeldung_bis >= heute && (
              <button type="button" className="knopf neben klein" disabled={laeuft} onClick={() => ausfuehren(rueckmeldungAlsFrist, "rueckmeldung_als_frist")}>
                Rückmeldung als Frist eintragen
              </button>
            )}
            <button type="button" className={gepflegt ? "knopf leise klein" : "knopf haupt klein"} disabled={laeuft} onClick={() => setBearbeiten(true)}>
              {gepflegt ? "Termine korrigieren" : "Echte Termine eintragen"}
            </button>
          </div>
        </>
      ) : (
        <form
          className="sem-form"
          onSubmit={(e) => {
            e.preventDefault();
            ausfuehren(() => semesterSpeichern(werte), "semester_gespeichert", () => setBearbeiten(false));
          }}
        >
          {FELDER.map(({ feld, name, pflicht }) => (
            <label key={feld}>
              <span>{name}</span>
              <input
                className="field"
                type="date"
                required={pflicht}
                value={werte[feld] ?? ""}
                onChange={(e) => setWerte((w) => ({ ...w, [feld]: e.target.value || null }))}
              />
            </label>
          ))}
          <div className="hs-gewaehlt">
            <button type="button" className="knopf leise" disabled={laeuft} onClick={() => (setWerte(termine), setBearbeiten(false))}>
              Abbrechen
            </button>
            <button type="submit" className="knopf haupt" disabled={laeuft}>
              Für alle speichern
            </button>
          </div>
        </form>
      )}
      {ergebnis && (ergebnis.ok ? <p className="einst-ok">{ergebnis.hinweis}</p> : <p className="auth-error">{ergebnis.fehler}</p>)}
    </div>
  );
}
