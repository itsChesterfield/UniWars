"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mensaSetzen, mensenLaden } from "@/app/(hubs)/einstellungen/mensa-actions";
import type { Ergebnis } from "@/app/settings/actions";
import { normalisieren } from "@/lib/hochschulen";
import type { Mensa } from "@/lib/mensa";
import { track } from "@/lib/analytics";

let laden: Promise<Mensa[]> | null = null;
function alleMensen() {
  laden ??= mensenLaden().catch((e) => {
    laden = null;
    throw e;
  });
  return laden;
}

function suchen(liste: Mensa[], eingabe: string): Mensa[] {
  const woerter = normalisieren(eingabe).split(" ").filter(Boolean);
  if (!woerter.length) return [];
  return liste
    .filter((m) => {
      const text = ` ${normalisieren(`${m.name} ${m.stadt ?? ""}`)}`;
      return woerter.every((w) => text.includes(` ${w}`));
    })
    .slice(0, 8);
}

/** Lieblingsmensa für „Mensa heute“ (Daten: OpenMensa) */
export function MensaWahl({ mensa, vorschlag, ohneKopf = false }: { mensa: string | null; vorschlag: string | null; ohneKopf?: boolean }) {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [offen, setOffen] = useState(false);
  const [alle, setAlle] = useState<Mensa[] | null>(null);
  const [eingabe, setEingabe] = useState(vorschlag ?? "");
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const listeId = useId();

  useEffect(() => {
    if (offen) alleMensen().then(setAlle, () => setAlle([]));
  }, [offen]);

  function speichern(m: { id: number; name: string } | null) {
    starte(async () => {
      try {
        const e = await mensaSetzen(m);
        setErgebnis(e);
        if (e.ok) {
          track(m ? "mensa_gewaehlt" : "mensa_entfernt");
          setOffen(false);
          router.refresh();
        }
      } catch {
        setErgebnis({ ok: false, fehler: "Das hat nicht geklappt. Bitte versuch es noch einmal." });
      }
    });
  }

  const treffer = alle ? suchen(alle, eingabe) : [];

  return (
    <div className="hs-verif">
      {!ohneKopf && (
        <>
          <h3>Mensa</h3>
          <p className="muted">Deine Mensa erscheint mit dem Speiseplan von heute in der Übersicht.</p>
        </>
      )}
      {!offen ? (
        <div className="hs-gewaehlt">
          <span className={mensa ? "hs-name" : "faint"}>{mensa ?? "Keine Mensa gewählt"}</span>
          {mensa && (
            <button type="button" className="knopf leise klein" disabled={laeuft} onClick={() => speichern(null)}>
              Entfernen
            </button>
          )}
          <button type="button" className={mensa ? "knopf leise klein" : "knopf haupt klein"} disabled={laeuft} onClick={() => setOffen(true)}>
            {mensa ? "Ändern" : "Mensa wählen"}
          </button>
        </div>
      ) : (
        <div className="hs-suche">
          <input
            className="field"
            autoFocus
            role="combobox"
            aria-expanded={treffer.length > 0}
            aria-controls={listeId}
            aria-label="Mensa suchen"
            placeholder={alle ? "Stadt oder Name – z. B. Aachen, Bochum" : "Mensen werden geladen …"}
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && treffer[0]) {
                e.preventDefault();
                speichern({ id: treffer[0].id, name: treffer[0].name });
              } else if (e.key === "Escape") setOffen(false);
            }}
          />
          {treffer.length > 0 && (
            <ul className="hs-treffer" id={listeId} role="listbox" aria-label="Mensen">
              {treffer.map((m) => (
                <li key={m.id} role="option" aria-selected={false} onMouseDown={(e) => (e.preventDefault(), speichern({ id: m.id, name: m.name }))}>
                  <span className="hs-name">{m.name}</span>
                  {m.stadt && <span className="hs-meta">{m.stadt}</span>}
                </li>
              ))}
            </ul>
          )}
          {alle && eingabe.trim().length >= 2 && treffer.length === 0 && (
            <p className="muted">Keine Mensa gefunden. Nicht jede Mensa ist bei OpenMensa eingetragen – versuch es mit der Stadt.</p>
          )}
          <button type="button" className="link hs-nicht-dabei" onClick={() => setOffen(false)}>
            Abbrechen
          </button>
        </div>
      )}
      {ergebnis && (ergebnis.ok ? <p className="einst-ok">{ergebnis.hinweis}</p> : <p className="auth-error">{ergebnis.fehler}</p>)}
    </div>
  );
}
