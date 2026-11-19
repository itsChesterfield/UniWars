"use client";

import { useRef, useState } from "react";
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
import { fachZuordnungenSpeichern } from "@/app/(hubs)/dateiablage/zuordnung-actions";
import type { MaterialArt } from "@/lib/dateiablage/material";
import { MaterialFaecherDialog } from "@/components/dateiablage/material-faecher";
import { Bereichskopf } from "@/components/hubs/bereichskopf";
import { kopfListe } from "@/lib/bereichskopf";

export type ObjektEintrag = { id: string; titel: string; fach_id: string | null; fach_ids?: string[]; geaendert_am: string; info?: string };

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
  einheit,
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
  /** Einzahl und Mehrzahl für die Zahl im Kopf, z. B. ["Dokument", "Dokumente"] */
  einheit: [string, string];
  icon: IconName;
  neuLabel: string;
  /** Überschrift des Leerzustands, z. B. „Noch keine Dokumente.“ */
  leerTitel: string;
  leerText: string;
  ohneTitel: string;
  basisPfad: string;
  eventName: MaterialArt;
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
  const [dialog, setDialog] = useState(false);
  const [faecherFuer, setFaecherFuer] = useState<string | null>(null);
  const angelegt = useRef<{ id: string; fachId: string | null } | null>(null);
  const faecherVon = (d: ObjektEintrag) => d.fach_ids ?? (d.fach_id ? [d.fach_id] : []);
  const sichtbar = eintraege.filter((d) => !fachFilter || faecherVon(d).includes(fachFilter));

  function editorOeffnen(id: string) {
    angelegt.current = null;
    setDialog(false);
    router.push(`${basisPfad}/${id}?neu=1`);
  }

  async function neuAnlegen(name: string, fachId: string | null, weitere: string[] = []) {
    try {
      if (!angelegt.current) {
        angelegt.current = { id: await anlegen(fachId, name || undefined), fachId };
      }
      const objekt = angelegt.current;
      const gewuenscht = fachId ? [fachId, ...weitere] : weitere;
      const zuordnungen = gewuenscht.filter((f) => f !== objekt.fachId).map((f) => ({
        art: eventName, material_id: objekt.id, fach_id: f, ausgeblendet: false,
      }));
      if (objekt.fachId && !gewuenscht.includes(objekt.fachId)) {
        zuordnungen.push({ art: eventName, material_id: objekt.id, fach_id: objekt.fachId, ausgeblendet: true });
      }
      if (zuordnungen.length) await fachZuordnungenSpeichern(zuordnungen);
      track(`${eventName}_angelegt`, { mit_fach: Boolean(fachId) });
      editorOeffnen(objekt.id);
    } catch (err) {
      fehlerMelden(err, { ort: `${eventName}_anlegen` });
      throw err;
    }
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
    <button type="button" className={`knopf ${klasse}`} onClick={() => setDialog(true)}>
      <Icon name="plus" groesse={16} />
      {text}
    </button>
  );

  return (
    <>
      <Bereichskopf
        titel={hub}
        untertitel={untertitel}
        {...(eintraege.length ? kopfListe(eintraege.map((e) => ({ titel: e.titel, geaendert: e.geaendert_am })), ohneTitel, einheit) : {})}
        aktionen={
          eintraege.length > 0 ? (
            <>
              {zusatzAktion}
              {neuKnopf("haupt", neuLabel)}
            </>
          ) : undefined
        }
      />
      <FachFilterChips faecher={faecher} />
      {eintraege.length === 0 ? (
        <Zustand art="leer" icon={icon} titel={leerTitel} aktion={neuKnopf("neben klein", neuLabel)}>
          {leerText}
        </Zustand>
      ) : sichtbar.length === 0 ? (
        <Zustand art="leer" icon={icon} titel="In diesem Fach gibt es hier noch nichts." region ebene={3} aktion={neuKnopf("neben klein", neuLabel)} />
      ) : (
        <ul className="entry-list objekt-liste">
          {sichtbar.map((d) => {
            const zugeordnet = faecher.filter((f) => faecherVon(d).includes(f.id));
            const fach = zugeordnet.find((f) => f.id === fachFilter) ?? zugeordnet[0];
            const name = d.titel || ohneTitel;
            return (
              <li key={d.id} className="entry-row fach-zeile">
                <span className="fach-farbe" style={{ "--c": fach?.farbe ?? "var(--linie-2)" } as React.CSSProperties} aria-hidden />
                <div className="entry-info">
                  <Link href={`${basisPfad}/${d.id}`} className={`entry-title objekt-name${d.titel ? "" : " ohne"}`}>
                    {name}
                  </Link>
                  <span className="entry-meta">
                    {[zugeordnet.map((f) => f.name).join(", ") || "Ohne Fach", d.info, `geändert ${datum(d.geaendert_am)}`].filter(Boolean).join(", ")}
                  </span>
                </div>
                <div className="entry-actions">
                  <DreiPunkteMenue label={`Weitere Aktionen für ${name}`} punkte={[
                    { label: "Fächer zuordnen", icon: "faecher", onClick: () => setFaecherFuer(d.id) },
                    { label: "Löschen", onClick: () => void entfernen(d), gefahr: true },
                  ]} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {dialog && (
        <StapelDialog
          titel={nameAbfragen ?? neuLabel}
          knopf="Anlegen"
          faecher={faecher}
          startFachId={faecher.some((f) => f.id === fachFilter) ? fachFilter : null}
          mehrfach
          namePflicht={Boolean(nameAbfragen)}
          onSchliessen={() => angelegt.current ? editorOeffnen(angelegt.current.id) : setDialog(false)}
          onSpeichern={neuAnlegen}
        />
      )}
      {faecherFuer && <MaterialFaecherDialog key={faecherFuer} material={{ art: eventName, id: faecherFuer }} schliessen={() => setFaecherFuer(null)} />}
    </>
  );
}
