"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { usePersoenlich } from "@/lib/personalisierung-store";
import { designAttribut, type Darstellung, type Theme } from "@/lib/personalisierung";

const ATTRIBUTE = ["data-theme", "data-schrift", "data-dichte", "data-bewegung"] as const;

/**
 * Design B3: äußerer Rahmen jeder angemeldeten Seite (`.dashboard`). Trägt Design und Darstellung als Attribute,
 * schon im Server-HTML, damit nichts aufblitzt. Änderungen aus der Personalisierung gelten sofort.
 *
 * Dieselben Attribute kommen zusätzlich auf <html>: Für Elemente, die direkt an <body> hängen
 * (Befehlspalette, Dialoge) und für die Übergänge zwischen Bereichen (::view-transition).
 */
export function DesignRahmen({ theme, darstellung, children }: { theme: Theme; darstellung: Darstellung; children: ReactNode }) {
  const t = usePersoenlich("theme", theme);
  const d = usePersoenlich("darstellung", darstellung);
  const werte = {
    "data-theme": designAttribut(t),
    "data-schrift": d.schrift === "gross" ? "gross" : undefined,
    "data-dichte": d.dichte === "kompakt" ? "kompakt" : undefined,
    "data-bewegung": d.bewegung === "reduziert" ? "reduziert" : undefined,
  };

  const schluessel = JSON.stringify(werte);
  useLayoutEffect(() => {
    const html = document.documentElement;
    const gesetzt = JSON.parse(schluessel) as Record<string, string | undefined>;
    for (const a of ATTRIBUTE) {
      if (gesetzt[a]) html.setAttribute(a, gesetzt[a]);
      else html.removeAttribute(a);
    }
    return () => ATTRIBUTE.forEach((a) => html.removeAttribute(a));
  }, [schluessel]);

  return (
    <div className="dashboard" {...werte}>
      {children}
    </div>
  );
}
