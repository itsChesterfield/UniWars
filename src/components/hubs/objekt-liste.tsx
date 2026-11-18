"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FachFilterChips } from "@/components/fach-filter-chips";
import { DreiPunkteMenue } from "@/components/hubs/drei-punkte-menue";
import { Icon } from "@/components/nav-icon";
import { Zustand } from "@/components/zustand";
import { StapelDialog } from "@/components/karteikarten/stapel-dialog";
import type { FachOption } from "@/lib/fach-option";
import type { IconName } from "@/lib/icons";
import { fehlerMelden, track } from "@/lib/analytics";

export type ObjektEintrag = { id: string; titel: string; fach_id: string | null; geaendert_am: string; info?: string };

function datum(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "numeric", year: "numeric" });
}

/**
 * Übersicht für Hubs mit eigenen Editor-Seiten (Textverarbeitung, Tabellen, Präsentationen, MindMap, Whiteboard):
 * Fach-Filter (ALL-04), Löschen mit Nachfrage (ALL-05), sortiert nach Änderung (ALL-06), leerer Zustand (ALL-07).
 * Design B3: Seitenkopf, Zeilen wie die übrigen Listen, Leerzustand mit genau einer Aktion.
 */
export function ObjektListe({
  hub,
  untertitel,
  icon,
  neuLabel,
  leerTitel,
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
  icon: IconName;
  neuLabel: string;
  /** Überschrift des Leerzustands, z. B. „Noch keine Dokumente.“ */
  leerTitel: string;
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
  /** Zusätzlicher Knopf neben „Neu“ (z. B. KI-08 „Aus Notiz oder Dokument“) */
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

  const neuKnopf = (klasse: string, text: string) => (
    <button type="button" className={`knopf ${klasse}`} onClick={neu} disabled={isPending} aria-busy={isPending}>
      <Icon name="plus" groesse={16} />
      {text}
    </button>
  );

  return (
    <>
      <header className="seitenkopf">
        <div>
          <h1>{hub}</h1>
          <p>{untertitel}</p>
        </div>
        {eintraege.length > 0 && (
          <div className="rechts">
            {zusatzAktion}
            {neuKnopf("haupt", neuLabel)}
          </div>
        )}
      </header>
      <FachFilterChips faecher={faecher} />
      {fehler && (
        <p className="formular-fehler" role="alert">
          {fehler}
        </p>
      )}

      {eintraege.length === 0 ? (
        <Zustand art="leer" icon={icon} titel={leerTitel} aktion={neuKnopf("neben klein", neuLabel)}>
          {leerText}
        </Zustand>
      ) : sichtbar.length === 0 ? (
        <Zustand art="leer" icon={icon} titel="In diesem Fach gibt es hier noch nichts." region ebene={3} aktion={neuKnopf("neben klein", neuLabel)} />
      ) : (
        <ul className="entry-list objekt-liste">
          {sichtbar.map((d) => {
            const fach = faecher.find((f) => f.id === d.fach_id);
            const name = d.titel || ohneTitel;
            return (
              <li key={d.id} className="entry-row fach-zeile">
                <span className="fach-farbe" style={{ "--c": fach?.farbe ?? "var(--linie-2)" } as React.CSSProperties} aria-hidden />
                <div className="entry-info">
                  <Link href={`${basisPfad}/${d.id}`} className={`entry-title objekt-name${d.titel ? "" : " ohne"}`}>
                    {name}
                  </Link>
                  <span className="entry-meta">
                    {[fach?.name ?? "Ohne Fach", d.info, `geändert ${datum(d.geaendert_am)}`].filter(Boolean).join(", ")}
                  </span>
                </div>
                <div className="entry-actions">
                  <DreiPunkteMenue label={`Weitere Aktionen für ${name}`} punkte={[{ label: "Löschen", onClick: () => void entfernen(d), gefahr: true }]} />
                </div>
              </li>
            );
          })}
        </ul>
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
