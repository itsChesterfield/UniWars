"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { arbeitszeitLaden, type Arbeitszeit } from "@/app/(hubs)/work-station/actions";
import { dauerText, startZustand, type AufgabeTyp } from "@/lib/work-station/timer";
import { timerLesen, timerSchreiben } from "@/lib/work-station/timer-store";
import { track } from "@/lib/analytics";

/**
 * Aufgaben-Detail: Fokuszeit an dieser Aufgabe (inkl. Unteraufgaben), bei Gruppenarbeit je Person,
 * dazu „Fokus starten“ mit dieser Aufgabe in der Work Station.
 */
export function FokusZeit({ typ, id, titel, fachId }: { typ: AufgabeTyp; id: string; titel: string; fachId: string | null }) {
  const router = useRouter();
  const [zeiten, setZeiten] = useState<{ fuer: string; liste: Arbeitszeit[] } | null>(null);
  const schluessel = `${typ}:${id}`;

  useEffect(() => {
    let aktuell = true;
    arbeitszeitLaden({ typ, id })
      .then((liste) => aktuell && setZeiten({ fuer: schluessel, liste }))
      .catch(() => undefined);
    return () => {
      aktuell = false;
    };
  }, [typ, id, schluessel]);

  const liste = zeiten?.fuer === schluessel ? zeiten.liste : null;
  const gesamt = (liste ?? []).reduce((n, z) => n + z.minuten, 0);
  const max = Math.max(1, ...(liste ?? []).map((z) => z.minuten));

  function fokusStarten() {
    const z = timerLesen();
    // Läuft schon ein Timer, nur die Aufgabe wechseln; sonst frisch vorbereiten
    const basis = z ?? startZustand(undefined, fachId);
    timerSchreiben({ ...basis, aufgabe: { typ, id, titel }, fachId: fachId ?? basis.fachId });
    track("fokus_aus_aufgabe", { typ });
    router.push("/work-station");
  }

  return (
    <section className="detail-abschnitt" aria-labelledby="detail-fokuszeit">
      <div className="detail-abschnitt-kopf">
        <h3 id="detail-fokuszeit" className="aufgaben-untertitel">
          Fokuszeit
        </h3>
        <button type="button" className="link" onClick={fokusStarten}>
          Fokus starten
        </button>
      </div>
      {liste === null ? (
        <p className="detail-leer">Wird geladen …</p>
      ) : gesamt === 0 ? (
        <p className="detail-leer">Noch keine Fokuszeit. Starte eine Runde in der Work Station und wähle diese Aufgabe.</p>
      ) : (
        <>
          <p className="fokuszeit-gesamt">
            Insgesamt <b className="zahl">{dauerText(gesamt)}</b>
          </p>
          {liste.length > 1 && (
            <ul className="fokuszeit-personen">
              {liste.map((z) => (
                <li key={z.userId}>
                  <span>{z.name}</span>
                  <span className="fokuszeit-balken" aria-hidden>
                    <span style={{ width: `${(z.minuten / max) * 100}%` }} />
                  </span>
                  <span className="zahl">{dauerText(z.minuten)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
