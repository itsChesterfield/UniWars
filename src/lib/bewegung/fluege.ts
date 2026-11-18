/**
 * Ortswechsel als kleine eigene Form (Prototyp Bewegung, Regel 2): Ein Element wird zur feinen Linie
 * und fliegt an seinen neuen Platz. Die Flüge liegen in einer eigenen Ebene über der Seite (position: fixed)
 * und bewegen sich nur über transform und opacity. Bei reduzierter Bewegung gibt es keinen Flug.
 */
import { bewegungReduziert } from "@/lib/personalisierung-store";

export type Linie = { x: number; y: number; w: number };

function dauer(name: "--dur-short" | "--dur-long", ersatz: number): number {
  const wert = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(wert) ? wert : ersatz;
}

const EIN = "cubic-bezier(0.22, 0.9, 0.24, 1)";
const AUS = "cubic-bezier(0.4, 0, 0.9, 0.5)";

function ebene(klasse: string, x: number, y: number, w: number, h: number): HTMLElement {
  const el = document.createElement("div");
  el.className = `bewegung-flug ${klasse}`;
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  document.body.append(el);
  return el;
}

async function fertig(a: Animation, el: HTMLElement) {
  try {
    await a.finished;
  } catch {
    // abgebrochen (Seite gewechselt): nichts zu tun
  } finally {
    el.remove();
  }
}

/**
 * Papier (eine Karte) legt sich als Linie ab: von `von` (Rechteck der Karte) auf die Linie `nach`.
 * `farbe` ist die Farbe der Linie am Ziel, sie blendet während des Flugs ein.
 */
export function papierFlug(von: DOMRect, nach: Linie, farbe: string): Promise<void> {
  if (bewegungReduziert() || von.width === 0) return Promise.resolve();
  const el = ebene("papier", von.left, von.top, von.width, von.height);
  el.append(document.createElement("i"));
  el.style.setProperty("--flug-farbe", farbe);
  const sx = nach.w / von.width;
  const sy = 1 / von.height;
  const ziel = `translate(${nach.x - von.left}px, ${nach.y - von.top}px) scale(${sx}, ${sy})`;
  const t = dauer("--dur-long", 320) + 40;
  el.firstElementChild?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration: t, easing: "linear", fill: "forwards" });
  return fertig(el.animate([{ transform: "none" }, { transform: ziel }], { duration: t, easing: EIN, fill: "forwards" }), el);
}

/** Eine Linie fliegt von `von` nach `nach` und erlischt dort (`aus`), oder bleibt bis zum Ende sichtbar. */
export function linieFlug(von: Linie, nach: Linie, farbe: string, { verzug = 0, aus = true } = {}): Promise<void> {
  if (bewegungReduziert()) return Promise.resolve();
  const el = ebene("linie", nach.x, nach.y, nach.w, 1);
  el.style.setProperty("--flug-farbe", farbe);
  const start = `translate(${von.x - nach.x}px, ${von.y - nach.y}px) scaleX(${von.w / Math.max(1, nach.w)})`;
  const bilder: Keyframe[] = [
    { transform: start, opacity: 1 },
    { transform: "none", opacity: 1, offset: aus ? 0.85 : 1 },
    ...(aus ? [{ transform: "none", opacity: 0 }] : []),
  ];
  return fertig(el.animate(bilder, { duration: dauer("--dur-long", 320), delay: verzug, easing: EIN, fill: "both" }), el);
}

/** Linie mitten durch ein Element (für Zeilen und Fächer) */
export function linieVon(r: DOMRect): Linie {
  return { x: r.left, y: r.top + r.height / 2, w: r.width };
}

export { EIN as KURVE_EIN, AUS as KURVE_AUS };
