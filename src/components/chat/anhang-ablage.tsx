"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ablageFaecherLaden, chatDateiUebernehmen } from "@/app/(hubs)/dateiablage/actions";
import { MaterialDialog } from "@/components/dateiablage/material-dialog";

export function AnhangAblage({ nachrichtId, schliessen }: { nachrichtId: string; schliessen: () => void }) {
  const [faecher, setFaecher] = useState<Awaited<ReturnType<typeof ablageFaecherLaden>>>([]);
  const [fach, setFach] = useState("");
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState("");
  const [wartet, starten] = useTransition();
  useEffect(() => {
    let aktiv = true;
    void ablageFaecherLaden().then((f) => { if (aktiv) setFaecher(f); }).catch(() => {
      if (aktiv) setFehler("Fächer konnten nicht geladen werden.");
    });
    return () => { aktiv = false; };
  }, []);
  return <MaterialDialog titel="In Dateiablage übernehmen" schliessen={schliessen}>
    {fehler && <p role="alert">{fehler}</p>}
    {fertig ? <Link className="knopf neben" href={fach ? `/dateiablage?ordner=${fach}` : "/dateiablage"} onNavigate={schliessen}>Dateiablage öffnen</Link> :
      <form className="dat-workflow-feld" onSubmit={(e) => {
        e.preventDefault();
        starten(async () => {
          try { await chatDateiUebernehmen(nachrichtId, fach || null); setFertig(true); setFehler(""); }
          catch { setFehler("Der Anhang konnte nicht übernommen werden."); }
        });
      }}>
        <label className="dat-workflow-feld">Ablageort
          <select className="field" value={fach} onChange={(e) => setFach(e.target.value)}>
            <option value="">Lose Blätter</option>
            {faecher.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <button className="knopf haupt" disabled={wartet}>Übernehmen</button>
      </form>}
  </MaterialDialog>;
}
