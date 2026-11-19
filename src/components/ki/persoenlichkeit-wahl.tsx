"use client";

import { useState } from "react";
import { lernprofilSetzen } from "@/app/(hubs)/lernraum/actions";
import { PERSOENLICHKEITEN, type Lernprofil, type Persoenlichkeit } from "@/lib/ki/lernraum";
import { STUDIO_NAME } from "@/lib/ki/studio";
import type { IconName } from "@/lib/icons";
import { fehlerMelden, track } from "@/lib/analytics";
import { Icon } from "@/components/nav-icon";

const REIHENFOLGE: Persoenlichkeit[] = ["kumpel", "coach", "sachlich"];
const ICON: Record<Persoenlichkeit, IconName> = { kumpel: "chat", coach: "ziel", sachlich: "info" };

/** Einstellungen: Wie soll UniVerse Studio auftreten? */
export function PersoenlichkeitWahl({ startProfil }: { startProfil: Lernprofil }) {
  const [profil, setProfil] = useState(startProfil);
  const [laeuft, setLaeuft] = useState(false);

  function waehlen(p: Persoenlichkeit) {
    if (p === profil.persoenlichkeit) return;
    const vorher = profil;
    setProfil({ ...profil, persoenlichkeit: p });
    setLaeuft(true);
    lernprofilSetzen({ ...profil, persoenlichkeit: p })
      .then((neu) => {
        setProfil(neu);
        track("studio_persoenlichkeit", { wert: p });
      })
      .catch((err) => {
        setProfil(vorher);
        fehlerMelden(err, { ort: "studio_persoenlichkeit" });
      })
      .finally(() => setLaeuft(false));
  }

  return (
    <div className="einst-zeile einst-persoenlichkeit">
      <span>
        Persönlichkeit von {STUDIO_NAME}
        <small className="faint einst-klein">{PERSOENLICHKEITEN[profil.persoenlichkeit].beschreibung}</small>
      </span>
      <span className="segwrap" role="radiogroup" aria-label="Persönlichkeit">
        {REIHENFOLGE.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={profil.persoenlichkeit === p}
            className={`seg ${profil.persoenlichkeit === p ? "on" : ""}`}
            disabled={laeuft}
            onClick={() => waehlen(p)}
          >
            <Icon name={ICON[p]} groesse={16} /> {PERSOENLICHKEITEN[p].name}
          </button>
        ))}
      </span>
    </div>
  );
}
