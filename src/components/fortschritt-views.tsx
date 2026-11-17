"use client";

import { useState, useSyncExternalStore, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { fehltageAendern } from "@/app/fach/actions";
import type { Tables } from "@/lib/supabase/types";
import { track } from "@/lib/analytics";
import { Zustand } from "@/components/zustand";
import { Icon } from "@/components/nav-icon";
import { WOCHENTAGE_KURZ, dauerText, minutenProFach, minutenProTag, wochenbeginn } from "@/lib/fortschritt";

type Fach = Tables<"fach">;
type Settings = Tables<"settings">;
type LernSession = Tables<"lern_session">;

const ECTS_BACHELOR = 120;
const keinAbo = () => () => {};

/** Design B3, Fortschritt: drei Abschnitte untereinander wie im Dummy (Lernzeit, Anwesenheit, Bachelorarbeit). */
export function FortschrittSeite({
  lernSessions,
  faecher,
  settings,
}: {
  lernSessions: LernSession[];
  faecher: Fach[];
  settings: Settings;
}) {
  return (
    <div className="fortschritt-seite">
      <LernzeitWoche lernSessions={lernSessions} faecher={faecher} settings={settings} />
      <AnwesenheitUebersicht faecher={faecher} />
      <BachelorStand faecher={faecher} />
    </div>
  );
}

function LernzeitWoche({
  lernSessions,
  faecher,
  settings,
}: {
  lernSessions: LernSession[];
  faecher: Fach[];
  settings: Settings;
}) {
  // Woche und Wochentag gelten in der Ortszeit: erst im Browser rechnen, damit Server- und Browser-HTML gleich sind
  const imBrowser = useSyncExternalStore(keinAbo, () => true, () => false);
  const jetzt = imBrowser ? new Date() : null;
  const tage = jetzt ? minutenProTag(lernSessions, wochenbeginn(jetzt)) : [0, 0, 0, 0, 0, 0, 0];
  const heute = jetzt ? (jetzt.getDay() + 6) % 7 : -1;
  const summe = tage.reduce((s, m) => s + m, 0);
  const hoechster = Math.max(...tage, 1);
  const proFach = minutenProFach(lernSessions);
  const fachMax = Math.max(...proFach.map((f) => f.minuten), 1);
  const streak = settings.streak_count;

  return (
    <section aria-labelledby="abschnitt-lernzeit">
      <div className="abschnitt-kopf">
        <h2 id="abschnitt-lernzeit" className="abschnitt-titel">
          Lernzeit diese Woche
        </h2>
        <span className="abschnitt-info">
          <span className="zahl">{dauerText(summe)}</span>
          {streak > 0 && (
            <>
              , <Icon name="serie" groesse={14} /> <span className="zahl">{streak}</span> {streak === 1 ? "Tag" : "Tage"} in Folge
            </>
          )}
          {settings.streak_freezes > 0 &&
            `, ${settings.streak_freezes} ${settings.streak_freezes === 1 ? "Streak-Freeze" : "Streak-Freezes"} übrig`}
        </span>
      </div>

      {lernSessions.length === 0 ? (
        <Zustand
          art="leer"
          region
          ebene={3}
          titel="Noch keine Lernzeit."
          aktion={
            <Link href="/work-station" className="knopf neben klein">
              <Icon name="fokus" groesse={16} />
              Fokus starten
            </Link>
          }
        >
          Starte in der Work Station einen Fokus-Timer. Die Minuten landen hier, nach Tag und Fach.
        </Zustand>
      ) : (
        <>
          <div
            className="wochenbalken"
            role="img"
            aria-label={`Lernminuten pro Tag: ${tage.map((m, i) => `${WOCHENTAGE_KURZ[i]} ${m}`).join(", ")}`}
          >
            {tage.map((m, i) => (
              <div key={WOCHENTAGE_KURZ[i]} className={i === heute ? "heute" : undefined}>
                <i style={{ height: `${Math.max((m / hoechster) * 100, 2)}%` }} />
                {WOCHENTAGE_KURZ[i]}
              </div>
            ))}
          </div>
          <h3 className="unter-titel">Pro Fach, insgesamt</h3>
          <ul className="entry-list">
            {proFach.map(({ fachId, minuten }) => {
              const fach = faecher.find((f) => f.id === fachId);
              return (
                <li key={fachId ?? "ohne"} className="entry-row fach-zeile">
                  <span className="fach-farbe" style={{ "--c": fach?.farbe ?? "var(--text-3)" } as CSSProperties} aria-hidden />
                  <div className="entry-info">
                    <span className="entry-title">{fach?.name ?? "Ohne Fach"}</span>
                    <span className="balkenf" style={{ "--c": fach?.farbe ?? "var(--text-3)" } as CSSProperties} aria-hidden>
                      <i style={{ width: `${(minuten / fachMax) * 100}%` }} />
                    </span>
                  </div>
                  <span className="fortschritt-wert zahl">{dauerText(minuten)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

export function AnwesenheitUebersicht({ faecher: initialFaecher }: { faecher: Fach[] }) {
  const [faecher, setFaecher] = useState(initialFaecher);
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const relevante = faecher.filter((f) => f.anwesenheitspflicht);

  function handleFehltag(id: string, delta: number) {
    track("fehltag_geaendert", { richtung: delta > 0 ? "hinzugefuegt" : "entfernt" });
    setFehler(null);
    startTransition(async () => {
      try {
        const updated = await fehltageAendern(id, delta);
        setFaecher((prev) => prev.map((f) => (f.id === id ? updated : f)));
      } catch (err) {
        setFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <section aria-labelledby="abschnitt-anwesenheit">
      <div className="abschnitt-kopf">
        <h2 id="abschnitt-anwesenheit" className="abschnitt-titel">
          Anwesenheit
        </h2>
        <span className="abschnitt-info">Fächer mit Anwesenheitspflicht</span>
      </div>
      {fehler && (
        <p className="formular-fehler" role="alert">
          {fehler}
        </p>
      )}
      {relevante.length === 0 ? (
        <Zustand
          art="leer"
          region
          ebene={3}
          titel="Kein Fach mit Anwesenheitspflicht."
          aktion={
            <Link href="/faecher" className="knopf leise klein">
              Fächer öffnen
            </Link>
          }
        >
          Hak beim Bearbeiten eines Fachs „Anwesenheitspflicht“ an. Dann zählst du hier die Fehltage.
        </Zustand>
      ) : (
        <ul className="entry-list">
          {relevante.map((f) => {
            const max = f.max_fehltage;
            const stufe = max == null ? "" : f.fehltage_genutzt >= max ? " grenze" : f.fehltage_genutzt >= max - 1 ? " knapp" : "";
            const farbe = { "--c": f.farbe ?? "var(--text-3)" } as CSSProperties;
            return (
              <li key={f.id} className={`entry-row fach-zeile anwesenheit${stufe}`}>
                <span className="fach-farbe" style={farbe} aria-hidden />
                <div className="entry-info">
                  <span className="entry-title">{f.name}</span>
                  {max != null && (
                    <span className="balkenf" style={farbe} aria-hidden>
                      <i style={{ width: `${Math.min(f.fehltage_genutzt / Math.max(max, 1), 1) * 100}%` }} />
                    </span>
                  )}
                </div>
                <span className="fortschritt-wert">
                  <span className="zahl">{f.fehltage_genutzt}</span>
                  {max != null ? (
                    <>
                      {" "}von <span className="zahl">{max}</span> Fehltagen
                    </>
                  ) : f.fehltage_genutzt === 1 ? (
                    " Fehltag"
                  ) : (
                    " Fehltage"
                  )}
                </span>
                <div className="entry-actions">
                  <button
                    type="button"
                    className="knopf leise klein nur-symbol"
                    onClick={() => handleFehltag(f.id, -1)}
                    disabled={isPending || f.fehltage_genutzt === 0}
                    aria-label={`Einen Fehltag in ${f.name} entfernen`}
                  >
                    <Icon name="minus" groesse={16} />
                  </button>
                  <button
                    type="button"
                    className="knopf leise klein"
                    onClick={() => handleFehltag(f.id, 1)}
                    disabled={isPending}
                    aria-label={`Einen Fehltag in ${f.name} eintragen`}
                  >
                    <Icon name="plus" groesse={16} />
                    Fehltag
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Bachelorarbeit-Tracker: gesperrt bis 120 ECTS, dann folgt der eigentliche Tracker (noch ohne Datenlogik). */
function BachelorStand({ faecher }: { faecher: Fach[] }) {
  const ects = faecher.reduce((s, f) => s + (f.ects ?? 0), 0);
  const anteil = Math.min(ects / ECTS_BACHELOR, 1);
  return (
    <section aria-labelledby="abschnitt-bachelor">
      <div className="abschnitt-kopf">
        <h2 id="abschnitt-bachelor" className="abschnitt-titel">
          Bachelorarbeit
        </h2>
        <span className="abschnitt-info">ab {ECTS_BACHELOR} ECTS</span>
      </div>
      <div className="gesperrt">
        <p>
          <Icon name="schloss" groesse={16} />
          Der Tracker für die Bachelorarbeit mit Countdown und Meilensteinen öffnet sich ab {ECTS_BACHELOR} ECTS. Du hast{" "}
          <span className="zahl">{ects.toLocaleString("de-DE")}</span>.
        </p>
        <span
          className="balkenf"
          role="progressbar"
          aria-label="ECTS bis zur Bachelorarbeit"
          aria-valuemin={0}
          aria-valuemax={ECTS_BACHELOR}
          aria-valuenow={Math.min(ects, ECTS_BACHELOR)}
          style={{ "--c": "var(--text-3)" } as CSSProperties}
        >
          <i style={{ width: `${anteil * 100}%` }} />
        </span>
      </div>
    </section>
  );
}
