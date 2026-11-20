"use client";

import { useLayoutEffect, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { usePersoenlich } from "@/lib/personalisierung-store";
import { designAttribut, type Darstellung, type Theme } from "@/lib/personalisierung";
import { bereichZuPfad } from "@/lib/hintergrund";
import { BEREICHE } from "@/lib/dashboard-bereiche";
import type { BildAnzeige, BilderAnsicht } from "@/lib/hintergrund-server";

const HUB_UNTERSEITEN = BEREICHE.map((b) => b.href).filter((h) => h !== "/");
const url = (u: string) => `url(${JSON.stringify(u)})`;

/** CSS-Variablen für eine Fläche: Bild, Ausschnitt und Schleier je Design (globals.css, „Eigene Bilder“). */
function bildVariablen(name: string, b: BildAnzeige, quelle: "weich" | "gross"): Record<string, string> {
  return {
    [`--bild-${name}`]: url(quelle === "weich" || b.unscharf ? b.weich : b.gross),
    [`--bild-${name}-m`]: url(quelle === "weich" || b.unscharf ? b.weich : b.mittel),
    [`--bild-${name}-pos`]: b.pos,
    [`--bild-${name}-a-n`]: String(b.aN),
    [`--bild-${name}-a-h`]: String(b.aH),
  };
}

const ATTRIBUTE = ["data-theme", "data-schrift", "data-dichte", "data-bewegung", "data-leiste"] as const;

/**
 * Design B3: äußerer Rahmen jeder angemeldeten Seite (`.dashboard`). Trägt Design und Darstellung als Attribute,
 * schon im Server-HTML, damit nichts aufblitzt. Änderungen aus der Personalisierung gelten sofort.
 *
 * Dieselben Attribute kommen zusätzlich auf <html>: Für Elemente, die direkt an <body> hängen
 * (Befehlspalette, Dialoge) und für die Übergänge zwischen Bereichen (::view-transition).
 */
export function DesignRahmen({
  theme,
  darstellung,
  bilder = null,
  children,
}: {
  theme: Theme;
  darstellung: Darstellung;
  /** Eigene Bilder (lib/hintergrund.ts), schon signiert; `null` heißt keine */
  bilder?: BilderAnsicht | null;
  children: ReactNode;
}) {
  const t = usePersoenlich("theme", theme);
  const d = usePersoenlich("darstellung", darstellung);
  const pfad = usePathname();

  // Eigene Bilder: Symbolleiste und Studio immer, der Bereich je nach Seite
  const stil: Record<string, string> = {};
  const bildAttribute: Record<string, string | undefined> = {};
  if (bilder) {
    const bereich = bereichZuPfad(pfad ?? "/", HUB_UNTERSEITEN);
    const bereichBild = bereich === null ? null : bereich in bilder.bereich ? bilder.bereich[bereich] : bilder.bereiche;
    const flaechen: [string, string | null, "weich" | "gross"][] = [
      ["leiste", bilder.leiste, "weich"],
      ["studio", bilder.studio, "weich"],
      ["bereich", bereichBild, "gross"],
    ];
    for (const [name, id, quelle] of flaechen) {
      const b = id ? bilder.bilder[id] : null;
      if (!b) continue;
      Object.assign(stil, bildVariablen(name, b, quelle));
      bildAttribute[`data-bild-${name}`] = name === "bereich" ? bilder.groesse : "";
    }
    if (bilder.lernenAus) bildAttribute["data-bild-lernen"] = "";
  }
  const werte = {
    "data-theme": designAttribut(t),
    "data-schrift": d.schrift === "gross" ? "gross" : undefined,
    "data-dichte": d.dichte === "kompakt" ? "kompakt" : undefined,
    "data-bewegung": d.bewegung === "reduziert" ? "reduziert" : undefined,
    "data-leiste": d.leiste,
  };

  const schluessel = JSON.stringify(werte);
  // Das Studio hängt an <body>: seine Bild-Variablen und die Attribute zusätzlich auf <html>
  const studioStil = JSON.stringify({
    stil: Object.fromEntries(Object.entries(stil).filter(([k]) => k.startsWith("--bild-studio"))),
    studio: "data-bild-studio" in bildAttribute,
    lernen: "data-bild-lernen" in bildAttribute,
  });
  useLayoutEffect(() => {
    const html = document.documentElement;
    const { stil: v, studio, lernen } = JSON.parse(studioStil) as { stil: Record<string, string>; studio: boolean; lernen: boolean };
    for (const [k, w] of Object.entries(v)) html.style.setProperty(k, w);
    html.toggleAttribute("data-bild-studio", studio);
    html.toggleAttribute("data-bild-lernen", lernen);
    return () => {
      for (const k of Object.keys(v)) html.style.removeProperty(k);
      html.removeAttribute("data-bild-studio");
      html.removeAttribute("data-bild-lernen");
    };
  }, [studioStil]);
  useLayoutEffect(() => {
    const html = document.documentElement;
    const gesetzt = JSON.parse(schluessel) as Record<string, string | undefined>;
    for (const a of ATTRIBUTE) {
      if (gesetzt[a]) html.setAttribute(a, gesetzt[a]);
      else html.removeAttribute(a);
    }
    // Installierte App: Statusleiste in der Farbe des Grunds; die Offline-Seite übernimmt das zuletzt gewählte Design
    const grund = getComputedStyle(document.querySelector(".dashboard") ?? html).getPropertyValue("--grund").trim();
    if (grund) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", grund));
    try {
      if (gesetzt["data-theme"]) localStorage.setItem("universe-design", gesetzt["data-theme"]);
    } catch {
      // ohne Speicher folgt die Offline-Seite dem System
    }
    return () => ATTRIBUTE.forEach((a) => html.removeAttribute(a));
  }, [schluessel]);

  return (
    <div className="dashboard" {...werte} {...bildAttribute} style={stil as CSSProperties}>
      {children}
    </div>
  );
}
