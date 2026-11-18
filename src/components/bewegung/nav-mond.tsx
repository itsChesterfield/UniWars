"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Hub-Wechsel (Prototyp Bewegung): Ein goldener Punkt am Rand der Symbolleiste steht neben dem
 * aktiven Bereich und gleitet beim Wechsel in 200 ms zum neuen Eintrag. Nur transform und opacity.
 * `schluessel` ändert sich mit Pfad und Reihenfolge der Leiste; dann wird neu gemessen.
 */
export function NavMond({ schluessel }: { schluessel: string }) {
  const mond = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = mond.current;
    const leiste = el?.parentElement;
    if (!el || !leiste) return;
    const setzen = () => {
      const aktiv = leiste.querySelector<HTMLElement>(".rgruppe .rpunkt[aria-current]");
      if (!aktiv) {
        el.style.opacity = "0";
        return;
      }
      const l = leiste.getBoundingClientRect();
      const a = aktiv.getBoundingClientRect();
      const y = a.top - l.top + leiste.scrollTop + a.height / 2;
      el.style.transform = `translateY(${Math.round(y)}px)`;
      el.style.opacity = "1";
    };
    setzen();
    // Erst nach der ersten Messung gleiten, damit der Punkt beim Laden nicht von oben einfliegt
    const rahmen = requestAnimationFrame(() => el.classList.add("gleitet"));
    const beobachter = new ResizeObserver(setzen);
    beobachter.observe(leiste);
    return () => {
      cancelAnimationFrame(rahmen);
      beobachter.disconnect();
    };
  }, [schluessel]);

  return <span ref={mond} className="nav-mond" aria-hidden />;
}
