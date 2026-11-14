"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AssistentChat } from "@/components/assistent/assistent-chat";
import { kontextAusPfad } from "@/lib/ki/assistent";
import { track } from "@/lib/analytics";

/**
 * KI-12 (8.1): Schwebender ✨-Knopf unten rechts in jedem Hub und Strg+J.
 * Desktop: Seitenleiste rechts (400 px), Handy: Vollbild. Auf /assistent nicht nötig.
 */
export function AssistentStarter() {
  const pfad = usePathname();
  const suche = useSearchParams();
  const [offen, setOffen] = useState(false);
  const [unterhaltung, setUnterhaltung] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);
  const kontext = useMemo(() => kontextAusPfad(pfad, new URLSearchParams(suche.toString())), [pfad, suche]);
  const aufSeite = pfad.startsWith("/assistent");

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (aufSeite) return;
        setOffen((o) => {
          if (!o) track("ki_assistent_geoeffnet", { weg: "tastatur" });
          return !o;
        });
      } else if (e.key === "Escape" && offen) {
        setOffen(false);
      }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [aufSeite, offen]);

  if (aufSeite) return null;

  return (
    <>
      {!offen && (
        <button
          type="button"
          className="ki-starter"
          aria-label="Assistent öffnen (Strg+J)"
          title="Assistent (Strg+J)"
          onClick={() => {
            setOffen(true);
            track("ki_assistent_geoeffnet", { weg: "knopf" });
          }}
        >
          ✨
        </button>
      )}
      {offen && (
        <aside className="ki-panel" aria-label="UniWars-Assistent">
          <div className="ki-panel-kopf">
            <h2>✨ Assistent</h2>
            <span className="ki-panel-knoepfe">
              <button
                type="button"
                className="btng"
                onClick={() => {
                  setUnterhaltung(null);
                  setRunde((r) => r + 1);
                }}
                title="Neue Unterhaltung"
              >
                + Neu
              </button>
              <Link href={unterhaltung ? `/assistent?u=${unterhaltung}` : "/assistent"} className="icon-knopf" title="Alle Unterhaltungen" aria-label="Alle Unterhaltungen" onClick={() => setOffen(false)}>
                ⤢
              </Link>
              <button type="button" className="icon-knopf" aria-label="Assistent schließen" onClick={() => setOffen(false)}>
                ✕
              </button>
            </span>
          </div>
          <AssistentChat key={`${runde}`} unterhaltungId={unterhaltung} kontext={kontext} onUnterhaltung={setUnterhaltung} />
        </aside>
      )}
    </>
  );
}
