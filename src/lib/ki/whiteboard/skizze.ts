/**
 * KI-16.5: Handgezeichnete Striche statt exakter Formen. Jeder Knoten wird als
 * leicht wackeliger Stift-Umriss gezeichnet, jede Kante als handgezogene Linie
 * mit Pfeilspitze. So wirkt es "mit dem Stift gemalt" und laesst sich spaeter
 * 1:1 als Whiteboard-Stiftstrich speichern.
 *
 * Die Striche sind deterministisch (Seed aus einer Zeichenkette), damit sie beim
 * Neu-Rechnen des Layouts stabil bleiben und nicht bei jedem Bild neu zappeln.
 * Ausgabe ist jeweils eine flache Punktliste [x0, y0, x1, y1, ...].
 */

/** Kleiner, schneller Zufall mit festem Startwert (mulberry32). */
function zufall(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed aus einer Zeichenkette (djb2). */
export function seedAus(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/** Erzeugt eine Zufallsfunktion aus einem Seed-Text. */
export function stiftZufall(seedText: string): () => number {
  const rnd = zufall(seedAus(seedText));
  return () => rnd() * 2 - 1; // -1 .. 1
}

const WACKELN = 2.2; // Staerke des Zitterns in px

/**
 * Umriss eines Kastens als durchgehender Stift-Strich (lokale Koordinaten
 * 0..b, 0..h), mit kleinem Ueberstand am Ende wie bei einer Handskizze.
 */
export function kastenStrich(b: number, h: number, rnd: () => number): number[] {
  const r = Math.min(10, b / 4, h / 4);
  const kanten = [
    [r, 0, b - r, 0],
    [b, r, b, h - r],
    [b - r, h, r, h],
    [0, h - r, 0, r],
  ];
  const punkte: number[] = [];
  for (const [x1, y1, x2, y2] of kanten) {
    const schritte = 6;
    for (let i = 0; i <= schritte; i++) {
      const t = i / schritte;
      punkte.push(x1 + (x2 - x1) * t + rnd() * WACKELN, y1 + (y2 - y1) * t + rnd() * WACKELN);
    }
  }
  // Ueberstand: ein Stueck ueber den Anfang hinaus weiterzeichnen.
  punkte.push(r + Math.abs(rnd()) * 8, rnd() * WACKELN);
  return punkte;
}

/** Umriss einer Ellipse als Stift-Strich, etwas ueber eine Umdrehung hinaus. */
export function ellipseStrich(b: number, h: number, rnd: () => number): number[] {
  const cx = b / 2;
  const cy = h / 2;
  const rx = b / 2;
  const ry = h / 2;
  const schritte = 28;
  const punkte: number[] = [];
  const start = rnd() * 0.4;
  for (let i = 0; i <= schritte + 3; i++) {
    const w = start + (i / schritte) * Math.PI * 2;
    punkte.push(cx + Math.cos(w) * rx + rnd() * WACKELN, cy + Math.sin(w) * ry + rnd() * WACKELN);
  }
  return punkte;
}

/** Umriss je nach Form. */
export function knotenStrich(form: "kasten" | "ellipse", b: number, h: number, rnd: () => number): number[] {
  return form === "ellipse" ? ellipseStrich(b, h, rnd) : kastenStrich(b, h, rnd);
}

/** Handgezogene Linie mit leichter Durchbiegung in der Mitte. */
export function linieStrich(x1: number, y1: number, x2: number, y2: number, rnd: () => number): number[] {
  const schritte = 8;
  const durchbiegung = rnd() * 3;
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  const len = Math.hypot(nx, ny) || 1;
  const punkte: number[] = [];
  for (let i = 0; i <= schritte; i++) {
    const t = i / schritte;
    const bogen = Math.sin(t * Math.PI) * durchbiegung;
    punkte.push(x1 + (x2 - x1) * t + (nx / len) * bogen + rnd() * 1.2, y1 + (y2 - y1) * t + (ny / len) * bogen + rnd() * 1.2);
  }
  return punkte;
}

/** Pfeilspitze am Ende (x2,y2) als ein Strich: eine Seite, Spitze, andere Seite. */
export function pfeilStrich(x1: number, y1: number, x2: number, y2: number): number[] {
  const winkel = Math.atan2(y2 - y1, x2 - x1);
  const laenge = 11;
  const a = winkel + Math.PI - 0.5;
  const b = winkel + Math.PI + 0.5;
  return [x2 + laenge * Math.cos(a), y2 + laenge * Math.sin(a), x2, y2, x2 + laenge * Math.cos(b), y2 + laenge * Math.sin(b)];
}
