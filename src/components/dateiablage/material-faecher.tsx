"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { fachZuordnungenSpeichern, materialFaecherLaden } from "@/app/(hubs)/dateiablage/zuordnung-actions";
import { Icon } from "@/components/nav-icon";
import { materialRef, materialVomPfad, type MaterialRef } from "@/lib/dateiablage/material";
import { MaterialDialog } from "./material-dialog";

export function MaterialFaecherDialog({ material, schliessen }: { material: MaterialRef; schliessen: () => void }) {
  const { id, art } = material;
  const [daten, setDaten] = useState<Awaited<ReturnType<typeof materialFaecherLaden>> | null>(null);
  const [wahl, setWahl] = useState<string[]>([]);
  const [fehler, setFehler] = useState("");
  const [wartet, starten] = useTransition();

  useEffect(() => {
    let aktiv = true;
    void materialFaecherLaden({ art, id }).then((antwort) => {
      if (!aktiv) return;
      setDaten(antwort);
      setWahl(antwort.aktuell);
    }).catch(() => {
      if (aktiv) setFehler("Die Fächer konnten nicht geladen werden.");
    });
    return () => { aktiv = false; };
  }, [art, id]);

  function speichern() {
    if (!daten) return;
    const zuordnungen = daten.faecher.flatMap((fach) => {
      const neu = wahl.includes(fach.id);
      if (neu === daten.aktuell.includes(fach.id)) return [];
      return [{ art, material_id: id, fach_id: fach.id, ausgeblendet: !neu }];
    });
    starten(async () => {
      setFehler("");
      try {
        if (zuordnungen.length) await fachZuordnungenSpeichern(zuordnungen);
        schliessen();
      } catch {
        setFehler("Die Fachzuordnungen konnten nicht gespeichert werden.");
      }
    });
  }

  return <MaterialDialog titel="Fächer zuordnen" schliessen={schliessen}>
    {daten ? <form className="dat-workflow-feld" onSubmit={(e) => { e.preventDefault(); speichern(); }}>
      <fieldset disabled={wartet}>
        <legend>Fächer in der Dateiablage</legend>
        {!daten.faecher.length && <p>Du hast noch keine Fächer angelegt.</p>}
        {daten.faecher.map((fach) => <label key={fach.id} className="dat-workflow-mitglied">
          <input type="checkbox" checked={wahl.includes(fach.id)} onChange={(e) => {
            const aktiv = e.target.checked;
            setWahl((alt) => aktiv ? [...alt, fach.id] : alt.filter((id) => id !== fach.id));
          }} />
          {fach.name}{fach.aktiv ? "" : " (archiviert)"}
        </label>)}
      </fieldset>
      <button type="submit" className="knopf haupt" disabled={wartet}>Speichern</button>
    </form> : !fehler && <p role="status">Fächer werden geladen …</p>}
    {fehler && <p role="alert">{fehler}</p>}
  </MaterialDialog>;
}

function MaterialFaecherKnopf({ material }: { material: MaterialRef }) {
  const [offen, setOffen] = useState(false);
  return <>
    <button type="button" className="knopf leise klein" onClick={() => setOffen(true)}>
      <Icon name="faecher" groesse={15} /> Fächer
    </button>
    {offen && <MaterialFaecherDialog material={material} schliessen={() => setOffen(false)} />}
  </>;
}

export function FaecherImHub() {
  const pfad = usePathname();
  const parameter = useSearchParams();
  const key = materialVomPfad(pfad, parameter);
  if (!key) return null;
  const [art, id] = key.split(":");
  const ref = materialRef({ art, id });
  return ref ? <MaterialFaecherKnopf key={key} material={ref} /> : null;
}
