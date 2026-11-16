"use client";

import { useEffect, useState } from "react";
import type { Briefing } from "@/app/(hubs)/assistent/briefing-actions";
import { BRIEFING_EREIGNIS, briefingHolen } from "@/components/ki/tages-briefing";
import { einsetzen, tageszeit, UEBERSCHRIFTEN, ueberschriftWaehlen } from "@/lib/ki/briefing";

const ZULETZT = "uniwars-ueberschrift-zuletzt";

function zuletztLesen(): string | null {
  try {
    return window.localStorage.getItem(ZULETZT);
  } catch {
    return null;
  }
}

/**
 * Persönliche Überschrift im Dashboard – bei jedem Öffnen eine andere („Kaffee und Uni, Max?“,
 * „Gute Nacht, Max 🌙“). Erst aus einer festen Sammlung, dann die von der KI geschriebenen.
 * Im Zentralen Hub steht sie als Zeile über der Überschrift (`als="p"`): Die h1 nennt dort die nächste Aufgabe.
 */
export function DashboardUeberschrift({ name, standard, als = "h1" }: { name: string; standard: string; als?: "h1" | "p" }) {
  const [text, setText] = useState(standard);
  const vorname = name.split(/[\s._-]/)[0];
  const anzeigeName = vorname ? vorname.charAt(0).toUpperCase() + vorname.slice(1) : "";

  useEffect(() => {
    let ab = false;
    let vonKi = false;
    const waehlen = (liste: string[]) => {
      const t = ueberschriftWaehlen(liste, zuletztLesen(), Math.random());
      if (!t || ab) return;
      setText(t);
      try {
        window.localStorage.setItem(ZULETZT, t);
      } catch {
        // egal
      }
    };
    // Sofort: passend zur Tageszeit
    const id = window.setTimeout(() => waehlen(UEBERSCHRIFTEN[tageszeit(new Date().getHours())].map((v) => einsetzen(v, anzeigeName))), 0);
    // Dann: passend zur Lage bzw. von der KI geschrieben (einmal wechseln)
    const nimm = (b: Briefing | null) => {
      if (!b?.ueberschriften.length || vonKi) return;
      if (b.vonKi) vonKi = true;
      waehlen(b.ueberschriften);
    };
    void briefingHolen().then(nimm);
    const ereignis = (e: Event) => nimm((e as CustomEvent<Briefing>).detail);
    window.addEventListener(BRIEFING_EREIGNIS, ereignis);
    return () => {
      ab = true;
      window.clearTimeout(id);
      window.removeEventListener(BRIEFING_EREIGNIS, ereignis);
    };
  }, [anzeigeName]);

  if (als === "p") {
    return (
      <p className="gruss-zeile" key={text}>
        {text}
      </p>
    );
  }
  return (
    <h1 className="dashboard-ueberschrift" key={text}>
      {text}
    </h1>
  );
}
