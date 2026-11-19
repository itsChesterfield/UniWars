"use client";

import { useEffect, useState } from "react";
import { allesSuchen } from "@/app/(hubs)/suche-actions";
import { materialRef, materialZiel, type MaterialRef, type MaterialZiel } from "@/lib/dateiablage/material";
import type { SuchTreffer } from "@/lib/befehle";

export function suchMaterial(treffer: SuchTreffer): { ref: MaterialRef; seite: number | null } | null {
  if (treffer.art === "fundstelle") {
    const [pfad, query] = treffer.href.split("?");
    const ref = materialRef({ art: "datei", id: pfad.split("/").at(-1) });
    const seite = Number(new URLSearchParams(query).get("seite"));
    return ref && Number.isSafeInteger(seite) && seite > 0 ? { ref, seite } : null;
  }
  const ref = materialRef({ art: treffer.art === "pdf" ? "datei" : treffer.art, id: treffer.id });
  return ref ? { ref, seite: null } : null;
}

export function MaterialAuswahl({ modus, waehlen, gesperrt }: {
  modus: "unterlagen" | "aufgaben"; waehlen: (treffer: SuchTreffer) => void; gesperrt?: boolean;
}) {
  const [suche, setSuche] = useState("");
  const [ergebnis, setErgebnis] = useState<{ fuer: string; treffer: SuchTreffer[]; fehler?: boolean } | null>(null);
  const wort = suche.trim();
  useEffect(() => {
    if (wort.length < 2) return;
    let aktiv = true;
    const timer = window.setTimeout(() => {
      void allesSuchen(wort).then((antwort) => {
        if (aktiv) setErgebnis({ fuer: wort, treffer: antwort.filter((t) => modus === "unterlagen" ? suchMaterial(t) : suchZiel(t)) });
      }).catch(() => { if (aktiv) setErgebnis({ fuer: wort, treffer: [], fehler: true }); });
    }, 220);
    return () => { aktiv = false; window.clearTimeout(timer); };
  }, [wort, modus]);
  const treffer = ergebnis?.fuer === wort ? ergebnis.treffer : [];
  return (
    <>
      <label className="dat-workflow-feld">
        {modus === "unterlagen" ? "Unterlagen suchen" : "Aufgaben und Prüfungen suchen"}
        <input className="field" value={suche} onChange={(e) => setSuche(e.target.value)} type="search" autoFocus />
      </label>
      {wort.length >= 2 && (
        ergebnis?.fuer !== wort ? <p role="status">Suche läuft</p>
          : ergebnis.fehler ? <p role="alert">Die Suche konnte nicht geladen werden.</p>
          : treffer.length === 0 ? <p>Keine passenden Treffer.</p>
          : <ul className="dat-workflow-liste">{treffer.map((t) => (
            <li key={`${t.art}:${t.id}`}>
              <button className="knopf leise" type="button" disabled={gesperrt} onClick={() => waehlen(t)}>
                {t.titel} <span className="muted">{t.info}</span>
              </button>
            </li>
          ))}</ul>
      )}
    </>
  );
}

export function suchZiel(treffer: SuchTreffer): MaterialZiel | null {
  return materialZiel(treffer);
}
