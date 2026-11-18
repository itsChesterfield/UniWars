"use client";

import { useEffect } from "react";
import { gleicheLage, markeLage, type MarkeLage } from "@/lib/bewegung/segment";

const GEWAEHLT = 'button[aria-pressed="true"], button[aria-selected="true"]';

/**
 * Gemeinsamer Baustein für alle `.segment`-Umschalter (wie die Reiter bei Mistral): Die Markierung liegt als
 * eigene Fläche unter den Knöpfen und gleitet in --dur-short zum gewählten Eintrag, statt zu springen.
 * Nur `transform` gleitet; die Breite passt sich ohne Übergang an. Einmal im Hub-Rahmen eingebunden, erfasst
 * er auch Segmente, die später erscheinen. Bei reduzierter Bewegung springt die Markierung (CSS).
 */
export function SegmentMarke() {
  useEffect(() => {
    const lagen = new WeakMap<HTMLElement, MarkeLage | null>();
    const beobachtet = new WeakSet<HTMLElement>();
    let geplant = 0;

    const setzen = (seg: HTMLElement) => {
      const knoepfe = [...seg.querySelectorAll<HTMLElement>(":scope > button")];
      const lage = markeLage(
        knoepfe.map((k) => ({ links: k.offsetLeft, oben: k.offsetTop, breite: k.offsetWidth, hoehe: k.offsetHeight, gewaehlt: k.matches(GEWAEHLT) })),
      );
      if (gleicheLage(lage, lagen.get(seg) ?? null) && seg.hasAttribute("data-marke") === !!lage) return;
      const vorher = lagen.get(seg);
      lagen.set(seg, lage);
      if (!lage) {
        seg.removeAttribute("data-marke");
        return;
      }
      seg.style.setProperty("--marke-x", `${lage.x}px`);
      seg.style.setProperty("--marke-y", `${lage.y}px`);
      seg.style.setProperty("--marke-b", `${lage.breite}px`);
      seg.style.setProperty("--marke-h", `${lage.hoehe}px`);
      // Erste Lage ohne Gleiten, danach gleitet jeder Wechsel
      if (!vorher) {
        seg.setAttribute("data-marke", "da");
        requestAnimationFrame(() => requestAnimationFrame(() => seg.isConnected && seg.setAttribute("data-marke", "gleitet")));
      }
    };

    const ro = new ResizeObserver((eintraege) => eintraege.forEach((e) => setzen(e.target as HTMLElement)));
    const alle = () => {
      geplant = 0;
      document.querySelectorAll<HTMLElement>(".segment").forEach((seg) => {
        if (!beobachtet.has(seg)) {
          beobachtet.add(seg);
          ro.observe(seg);
        }
        setzen(seg);
      });
    };
    const planen = () => {
      if (!geplant) geplant = requestAnimationFrame(alle);
    };

    alle();
    const mo = new MutationObserver(planen);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed", "aria-selected"] });
    document.fonts?.ready.then(planen);
    return () => {
      mo.disconnect();
      ro.disconnect();
      if (geplant) cancelAnimationFrame(geplant);
    };
  }, []);

  return null;
}
