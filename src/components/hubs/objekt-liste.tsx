"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { StapelDialog } from "@/components/karteikarten/stapel-dialog";
import type { FachOption } from "@/lib/fach-option";
import { fehlerMelden, track } from "@/lib/analytics";

export type ObjektEintrag = { id: string; titel: string; fach_id: string | null; geaendert_am: string; info?: string };

function datum(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Übersicht für Hubs mit eigenen Editor-Seiten (Textverarbeitung, Tabellen, Präsentationen):
 * Fach-Filter (ALL-04), Löschen mit Nachfrage (ALL-05), sortiert nach Änderung (ALL-06), leerer Zustand (ALL-07).
 */
export function ObjektListe({
  hub,
  untertitel,
  icon,
  neuLabel,
  leerText,
  ohneTitel,
  basisPfad,
  eventName,
  eintraege,
  faecher,
  anlegen,
  loeschen,
  nameAbfragen,
  zusatzAktion,
}: {
  hub: string;
  untertitel: string;
  icon: string;
  neuLabel: string;
  leerText: string;
  ohneTitel: string;
  basisPfad: string;
  eventName: string;
  eintraege: ObjektEintrag[];
  faecher: FachOption[];
  anlegen: (fachId: string | null, name?: string) => Promise<string>;
  loeschen: (id: string) => Promise<void>;
  /** Vor dem Anlegen Name + Fach abfragen (z. B. MM-01). */
  nameAbfragen?: string;
  /** Zusätzlicher Knopf neben "Neu" (z. B. KI-08 "✨ Aus Notiz oder Dokument") */
  zusatzAktion?: React.ReactNode;
}) {
  const router = useRouter();
  const fachFilter = useSearchParams().get("fachId");
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const sichtbar = eintraege.filter((d) => !fachFilter || d.fach_id === fachFilter);

  function neu() {
    if (nameAbfragen) {
      setDialog(true);
      return;
    }
    neuAnlegen(fachFilter);
  }

  function neuAnlegen(fachId: string | null, name?: string) {
    setFehler(null);
    startTransition(async () => {
      try {
        const id = await anlegen(fachId, name);
        track(`${eventName}_angelegt`, { mit_fach: Boolean(fachId) });
        router.push(`${basisPfad}/${id}?neu=1`);
      } catch (err) {
        setFehler("Anlegen hat nicht geklappt.");
        fehlerMelden(err, { ort: `${eventName}_anlegen` });
      }
    });
  }

  async function entfernen(e: ObjektEintrag) {
    if (!window.confirm(`„${e.titel || ohneTitel}“ wirklich löschen?`)) return;
    try {
      await loeschen(e.id);
      track(`${eventName}_geloescht`);
      router.refresh();
    } catch (err) {
      fehlerMelden(err, { ort: `${eventName}_loeschen` });
      window.alert("Löschen hat nicht geklappt.");
    }
  }

  const neuKnopf = (
    <button type="button" className="btnp" onClick={neu} disabled={isPending}>
      + {neuLabel}
    </button>
  );

  return (
    <>
      <HubKopf
        titel={hub}
        untertitel={untertitel}
        aktionen={
          zusatzAktion ? (
            <>
              {zusatzAktion}
              {neuKnopf}
            </>
          ) : (
            neuKnopf
          )
        }
      />
      <FachFilterChips faecher={faecher} />
      {fehler && <p className="auth-error">{fehler}</p>}

      {eintraege.length === 0 ? (
        <LeererZustand
          icon={icon}
          text={leerText}
          aktion={
            <button type="button" className="btnp hub-leer-knopf" onClick={neu} disabled={isPending}>
              + {neuLabel}
            </button>
          }
        />
      ) : sichtbar.length === 0 ? (
        <p className="empty-state">Für dieses Fach gibt es hier noch nichts.</p>
      ) : (
        <section className="card">
          <ul className="pdf-liste">
            {sichtbar.map((d) => {
              const fach = faecher.find((f) => f.id === d.fach_id);
              return (
                <li key={d.id} className="txt-liste-zeile">
                  <Link href={`${basisPfad}/${d.id}`} className="pdf-liste-zeile">
                    <span aria-hidden>{icon}</span>
                    <span className={`pdf-liste-name ${d.titel ? "" : "faint"}`}>{d.titel || ohneTitel}</span>
                    <span className="muted pdf-liste-fach">
                      {fach ? (
                        <>
                          <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} /> {fach.name}
                        </>
                      ) : (
                        "Ohne Fach"
                      )}
                    </span>
                    {d.info && <span className="faint mono">{d.info}</span>}
                    <span className="faint">{datum(d.geaendert_am)}</span>
                  </Link>
                  <DreiPunkteMenue punkte={[{ label: "Löschen", onClick: () => void entfernen(d), gefahr: true }]} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {dialog && nameAbfragen && (
        <StapelDialog
          titel={nameAbfragen}
          knopf="Anlegen"
          faecher={faecher}
          startFachId={fachFilter}
          onSchliessen={() => setDialog(false)}
          onSpeichern={async (name, fachId) => {
            setDialog(false);
            neuAnlegen(fachId, name);
          }}
        />
      )}
    </>
  );
}
