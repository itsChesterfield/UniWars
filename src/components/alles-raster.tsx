"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { NavIcon, Icon } from "@/components/nav-icon";
import { befehleOeffnen } from "@/components/befehlspalette";
import { KURZNAMEN, hubVonId } from "@/lib/hubs/navigation";
import { BEREICHE } from "@/lib/dashboard-bereiche";
import { bereichHref, type Symbolleiste } from "@/lib/personalisierung";
import { rasterFiltern, rasterGruppen } from "@/lib/alles-raster";
import { studioOeffnen } from "@/lib/ki/studio-kontext";
import { track } from "@/lib/analytics";

export const ALLES_OEFFNEN = "uniwars-alles-oeffnen";

/** Öffnet das Raster aller Bereiche (Handy, „Alles“ in der Tab-Leiste). */
export function allesOeffnen() {
  window.dispatchEvent(new CustomEvent(ALLES_OEFFNEN));
}

const namenVon = (id: string) => {
  const hub = hubVonId(id);
  return [hub?.name ?? id, KURZNAMEN[id] ?? ""].filter(Boolean);
};

/**
 * Handy: Raster aller Bereiche, gruppiert wie die Symbolleiste, mit Suche darüber.
 * Die Suche filtert das Raster; „In allem suchen“ (oder Enter ohne eindeutigen Treffer) gibt die Eingabe
 * an die Befehlspalette weiter, die auch Inhalte findet.
 */
export function AllesRaster({ leiste, kiVerfuegbar }: { leiste: Symbolleiste; kiVerfuegbar: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const pfad = usePathname();
  const titelId = useId();
  const gruppen = rasterFiltern(rasterGruppen(leiste), q, namenVon);
  const treffer = gruppen.flatMap((g) => g.eintraege);

  useEffect(() => {
    const oeffnen = () => {
      const d = dialog.current;
      if (!d || d.open) return;
      setQ("");
      d.showModal();
      // Fokus auf das Blatt selbst, damit am Handy nicht sofort die Tastatur aufgeht
      d.focus();
      track("alles_geoeffnet");
    };
    window.addEventListener(ALLES_OEFFNEN, oeffnen);
    return () => window.removeEventListener(ALLES_OEFFNEN, oeffnen);
  }, []);

  const schliessen = () => dialog.current?.close();

  const inAllemSuchen = () => {
    const text = q.trim();
    schliessen();
    befehleOeffnen(text);
  };

  const istAktiv = (href: string) =>
    href === "/" ? BEREICHE.some((b) => b.href === pfad) : pfad === href || pfad.startsWith(`${href}/`);

  const taste = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (treffer.length === 1) {
      const a = dialog.current?.querySelector<HTMLAnchorElement>(".alles-kachel");
      a?.click();
    } else if (q.trim()) {
      inAllemSuchen();
    }
  };

  return (
    <dialog
      ref={dialog}
      className="alles"
      aria-labelledby={titelId}
      tabIndex={-1}
      onClick={(e) => {
        // Klick auf den abgedunkelten Rand schließt
        if (e.target === e.currentTarget) schliessen();
      }}
    >
      <div className="alles-blatt">
        <div className="alles-kopf">
          <h2 id={titelId}>Alle Bereiche</h2>
          <button type="button" className="knopf leise klein nur-symbol" aria-label="Schließen" onClick={schliessen}>
            <Icon name="schliessen" groesse={18} />
          </button>
        </div>
        <label className="alles-suche">
          <Icon name="suchen" groesse={18} />
          <span className="vh">Bereich oder Inhalt suchen</span>
          <input
            type="search"
            value={q}
            placeholder="Bereich oder Inhalt suchen"
            enterKeyHint="search"
            autoComplete="off"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={taste}
          />
        </label>

        {gruppen.map((g) => (
          <section key={g.name} className="alles-gruppe" aria-label={g.name}>
            <h3>{g.name}</h3>
            <ul>
              {g.eintraege.map((e) => {
                const hub = hubVonId(e.id);
                if (!hub) return null;
                const href = bereichHref(e.id);
                return (
                  <li key={e.id}>
                    <Link
                      href={href}
                      className="alles-kachel"
                      aria-current={istAktiv(href) ? "page" : undefined}
                      onNavigate={schliessen}
                    >
                      <NavIcon path={hub.icon} groesse={22} />
                      <span>{hub.name}</span>
                      {e.ausgeblendet && <small>ausgeblendet</small>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {q.trim() ? (
          <div className="alles-weiter">
            {treffer.length === 0 && <p>Kein Bereich heißt so.</p>}
            <button type="button" className="knopf neben" onClick={inAllemSuchen}>
              <Icon name="suchen" groesse={16} />
              In allem suchen
            </button>
          </div>
        ) : (
          <section className="alles-gruppe" aria-label="Mehr">
            <h3>Mehr</h3>
            <ul>
              {kiVerfuegbar && (
                <li>
                  <button
                    type="button"
                    className="alles-kachel"
                    onClick={() => {
                      schliessen();
                      studioOeffnen();
                    }}
                  >
                    <Icon name="studio" groesse={22} />
                    <span>UniVerse Studio</span>
                  </button>
                </li>
              )}
              <li>
                <Link href="/einstellungen/personalisierung" className="alles-kachel" aria-current={pfad === "/einstellungen/personalisierung" ? "page" : undefined} onNavigate={schliessen}>
                  <Icon name="stift" groesse={22} />
                  <span>Personalisierung</span>
                </Link>
              </li>
              <li>
                <Link href="/einstellungen" className="alles-kachel" aria-current={pfad === "/einstellungen" ? "page" : undefined} onNavigate={schliessen}>
                  <Icon name="einstellungen" groesse={22} />
                  <span>Einstellungen</span>
                </Link>
              </li>
            </ul>
          </section>
        )}
      </div>
    </dialog>
  );
}
