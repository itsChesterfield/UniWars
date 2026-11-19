"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ablageFaecherLaden, chatDateiUebernehmen } from "@/app/(hubs)/dateiablage/actions";
import { MaterialDialog } from "@/components/dateiablage/material-dialog";

export function AnhangAblage({ nachrichtId, schliessen }: { nachrichtId: string; schliessen: () => void }) {
  const [faecher, setFaecher] = useState<Awaited<ReturnType<typeof ablageFaecherLaden>>>([]);
  const [fach, setFach] = useState("");
  const [ergebnis, setErgebnis] = useState<Exclude<Awaited<ReturnType<typeof chatDateiUebernehmen>>, { status: "update_noetig" }> | null>(null);
  const [fehler, setFehler] = useState("");
  const [wartet, starten] = useTransition();
  useEffect(() => {
    let aktiv = true;
    void ablageFaecherLaden().then((f) => { if (aktiv) setFaecher(f); }).catch(() => {
      if (aktiv) setFehler("Fächer konnten nicht geladen werden.");
    });
    return () => { aktiv = false; };
  }, []);
  function uebernehmen(kopie = false) {
    starten(async () => {
      setFehler("");
      try {
        const antwort = await chatDateiUebernehmen(nachrichtId, fach || null, kopie);
        if (antwort.status === "update_noetig") {
          setFehler("Ein weiteres Fach lässt sich nach dem Datenbankupdate zuordnen.");
        } else {
          setErgebnis(antwort);
        }
      } catch {
        setFehler("Der Anhang konnte nicht übernommen werden.");
      }
    });
  }
  const ablageort = ergebnis?.fachId ? faecher.find((f) => f.id === ergebnis.fachId)?.name ?? "Fachordner" : "Lose Blätter";
  return <MaterialDialog titel="In Dateiablage übernehmen" schliessen={schliessen}>
    {fehler && <p role="alert">{fehler}</p>}
    {ergebnis ? <>
      <p role="status">{ergebnis.status === "bereits_abgelegt" ? "Bereits abgelegt in" : "Abgelegt in"} „{ablageort}“.</p>
      <Link className="knopf neben" href={ergebnis.fachId ? `/dateiablage?ordner=${ergebnis.fachId}` : "/dateiablage"} onNavigate={schliessen}>Ablageort öffnen</Link>
      {ergebnis.status === "bereits_abgelegt" && !fach && ergebnis.fachId && (
        <button type="button" className="knopf leise" disabled={wartet} onClick={() => uebernehmen(true)}>Kopie unter „Lose Blätter“ ablegen</button>
      )}
    </> :
      <form className="dat-workflow-feld" onSubmit={(e) => { e.preventDefault(); uebernehmen(); }}>
        <label className="dat-workflow-feld">Ablageort
          <select className="field" value={fach} disabled={wartet} onChange={(e) => setFach(e.target.value)}>
            <option value="">Lose Blätter</option>
            {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <button className="knopf haupt" disabled={wartet}>Übernehmen</button>
      </form>}
  </MaterialDialog>;
}
