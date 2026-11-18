/**
 * Ortswechsel in Dateiablage und PDF Reader (Prototyp Bewegung, abgestimmte Fassung „Punkt“):
 * Was den Ort wechselt, wird zu einem goldenen Punkt und fliegt auf einem flachen Bogen ans Ziel.
 * Nur transform und opacity, eigene Ebene über der Seite. Bei reduzierter Bewegung kein Flug.
 */
import type React from "react";
import { bewegungReduziert } from "@/lib/personalisierung-store";

export type Punkt = { x: number; y: number };

export const mitteVon = (el: Element): Punkt => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export async function punktFlug(von: Punkt, nach: Punkt): Promise<void> {
  if (bewegungReduziert()) return;
  const dx = nach.x - von.x;
  const dy = nach.y - von.y;
  const laenge = Math.hypot(dx, dy) || 1;
  // Bogen immer nach oben, höchstens 40 px
  let nx = -dy / laenge;
  let ny = dx / laenge;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const hub = Math.min(40, laenge * 0.18);
  const bilder: Keyframe[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const e = t * t * (3 - 2 * t);
    const h = Math.sin(Math.PI * e) * hub;
    const groesse = t > 0.85 ? 1 - ((t - 0.85) / 0.15) * 0.6 : 1;
    bilder.push({ transform: `translate(${von.x + dx * e + nx * h}px, ${von.y + dy * e + ny * h}px) scale(${groesse})`, opacity: t > 0.9 ? (1 - t) * 10 : 1 });
  }
  const p = document.createElement("div");
  p.className = "ortswechsel-punkt";
  p.setAttribute("aria-hidden", "true");
  document.body.append(p);
  const dauer = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dur-long")) || 320;
  try {
    await p.animate(bilder, { duration: dauer, easing: "cubic-bezier(0.22, 0.9, 0.24, 1)", fill: "both" }).finished;
  } catch {
    // abgebrochen
  } finally {
    p.remove();
  }
}

/** Eigenes Ziehbild: eine kleine Pille mit dem Namen statt des halbdurchsichtigen Abbilds der ganzen Zeile */
export function ziehbildSetzen(e: React.DragEvent, name: string) {
  const bild = document.createElement("div");
  bild.className = "ziehbild";
  bild.textContent = name;
  document.body.append(bild);
  e.dataTransfer.setDragImage(bild, 14, 14);
  window.setTimeout(() => bild.remove(), 0);
}
