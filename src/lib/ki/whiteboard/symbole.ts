/**
 * KI-16: Katalog handgezeichneter Sinnbilder. Die KI platziert sie per Namen
 * frei auf der Tafel (siehe protokoll `bild`). Jeder Eintrag erzeugt eine Liste
 * von Stift-Strichen (jeder Strich eine flache Punktliste) im lokalen Feld
 * 0..100 x 0..100, y nach unten. Der Renderer skaliert und verschiebt sie an
 * den Platz und zeichnet jeden Strich wie mit dem Stift.
 *
 * Deterministisch ueber eine Zufallsfunktion, damit die Striche stabil bleiben.
 * Der Katalog ist bewusst erweiterbar: neue Sinnbilder einfach ergaenzen.
 */
import { kreisStrich, bogenStrich, ellipseRotStrich, linieStrich, polyStrich } from "./skizze.ts";

type Zufall = () => number;
type Sinnbild = (rnd: Zufall) => number[][];

const PI = Math.PI;

const mensch: Sinnbild = (r) => [
  kreisStrich(50, 20, 12, r),
  linieStrich(50, 32, 50, 64, r),
  linieStrich(28, 46, 72, 46, r),
  linieStrich(50, 64, 36, 90, r),
  linieStrich(50, 64, 64, 90, r),
];

const baum: Sinnbild = (r) => [
  kreisStrich(50, 34, 28, r, 1.14, 3.2),
  polyStrich([44, 96, 44, 60, 56, 60, 56, 96], r, 3),
];

const herz: Sinnbild = (r) => [
  polyStrich([50, 40, 40, 26, 30, 24, 22, 30, 20, 42, 32, 60, 50, 82, 68, 60, 80, 42, 78, 30, 70, 24, 60, 26, 50, 40], r, 2, 1.1),
];

const gehirn: Sinnbild = (r) => [
  bogenStrich(50, 46, 32, 27, 0, PI * 2 * 1.04, r, 2.2),
  bogenStrich(40, 40, 11, 8, 0.4, 3.2, r),
  bogenStrich(58, 50, 10, 7, 0.2, 2.6, r),
];

const zelle: Sinnbild = (r) => [
  bogenStrich(50, 50, 40, 32, 0, PI * 2 * 1.05, r, 2),
  kreisStrich(58, 46, 11, r),
  kreisStrich(60, 46, 3, r),
];

const sonne: Sinnbild = (r) => {
  const striche = [kreisStrich(50, 50, 17, r)];
  for (let k = 0; k < 8; k++) {
    const w = (k / 8) * PI * 2;
    striche.push(linieStrich(50 + Math.cos(w) * 24, 50 + Math.sin(w) * 24, 50 + Math.cos(w) * 40, 50 + Math.sin(w) * 40, r));
  }
  return striche;
};

const wolke: Sinnbild = (r) => [
  polyStrich([20, 66, 14, 54, 24, 44, 36, 46, 42, 34, 58, 34, 66, 44, 78, 46, 86, 56, 80, 66, 20, 66], r, 2, 1.6),
];

const wasser: Sinnbild = (r) => [
  polyStrich([50, 16, 30, 46, 28, 62, 38, 80, 50, 84, 62, 80, 72, 62, 70, 46, 50, 16], r, 2, 1.2),
];

const haus: Sinnbild = (r) => [
  polyStrich([22, 92, 22, 52, 78, 52, 78, 92, 22, 92], r, 3),
  polyStrich([14, 54, 50, 24, 86, 54], r, 3),
  polyStrich([44, 92, 44, 70, 58, 70, 58, 92], r, 2),
];

const buch: Sinnbild = (r) => [
  polyStrich([50, 30, 22, 36, 22, 76, 50, 70], r, 3),
  polyStrich([50, 30, 78, 36, 78, 76, 50, 70], r, 3),
  linieStrich(50, 30, 50, 70, r),
];

const gluehbirne: Sinnbild = (r) => [
  kreisStrich(50, 40, 23, r, 1.04),
  polyStrich([40, 62, 40, 72, 60, 72, 60, 62], r, 2),
  linieStrich(40, 76, 60, 76, r),
  polyStrich([44, 46, 50, 54, 56, 46], r, 2),
];

const blatt: Sinnbild = (r) => [
  polyStrich([50, 16, 72, 40, 66, 74, 50, 86, 34, 74, 28, 40, 50, 16], r, 2, 1.2),
  linieStrich(50, 22, 50, 82, r),
];

const auge: Sinnbild = (r) => [
  bogenStrich(50, 52, 30, 22, PI + 0.2, PI * 2 - 0.2, r),
  bogenStrich(50, 48, 30, 22, 0.2, PI - 0.2, r),
  kreisStrich(50, 50, 9, r),
  kreisStrich(50, 50, 3, r),
];

const stern: Sinnbild = (r) => {
  const ecken: number[] = [];
  for (let k = 0; k <= 10; k++) {
    const w = -PI / 2 + (k / 10) * PI * 2;
    const rad = k % 2 === 0 ? 40 : 17;
    ecken.push(50 + Math.cos(w) * rad, 50 + Math.sin(w) * rad);
  }
  return [polyStrich(ecken, r, 2, 1.1)];
};

const uhr: Sinnbild = (r) => [kreisStrich(50, 50, 34, r), linieStrich(50, 50, 50, 28, r), linieStrich(50, 50, 66, 54, r)];

const berg: Sinnbild = (r) => [
  polyStrich([10, 86, 34, 44, 50, 60, 68, 34, 90, 86], r, 3),
  polyStrich([62, 44, 68, 34, 74, 44], r, 2),
];

const becher: Sinnbild = (r) => [
  polyStrich([32, 24, 36, 84, 64, 84, 68, 24], r, 3),
  linieStrich(30, 24, 70, 24, r),
  linieStrich(35, 60, 65, 60, r),
];

const atom: Sinnbild = (r) => [
  kreisStrich(50, 50, 7, r),
  ellipseRotStrich(50, 50, 42, 15, 0, r),
  ellipseRotStrich(50, 50, 42, 15, PI / 3, r),
  ellipseRotStrich(50, 50, 42, 15, -PI / 3, r),
];

const globus: Sinnbild = (r) => [
  kreisStrich(50, 50, 34, r),
  ellipseRotStrich(50, 50, 13, 34, 0, r),
  linieStrich(16, 50, 84, 50, r),
];

const blitz: Sinnbild = (r) => [polyStrich([56, 14, 38, 52, 52, 52, 40, 86, 72, 44, 56, 44, 60, 16], r, 2, 1.1)];

const frage: Sinnbild = (r) => [
  polyStrich([34, 34, 42, 24, 56, 24, 62, 34, 58, 46, 50, 52, 50, 62], r, 2),
  kreisStrich(50, 74, 3, r),
];

const haken: Sinnbild = (r) => [polyStrich([28, 52, 44, 72, 76, 28], r, 3)];

const kreuz: Sinnbild = (r) => [linieStrich(28, 28, 72, 72, r), linieStrich(72, 28, 28, 72, r)];

const klammer: Sinnbild = (r) => [polyStrich([44, 16, 34, 24, 34, 44, 24, 50, 34, 56, 34, 76, 44, 84], r, 2)];

const zahnrad: Sinnbild = (r) => {
  const striche = [kreisStrich(50, 50, 24, r), kreisStrich(50, 50, 8, r)];
  for (let k = 0; k < 8; k++) {
    const w = (k / 8) * PI * 2;
    striche.push(linieStrich(50 + Math.cos(w) * 24, 50 + Math.sin(w) * 24, 50 + Math.cos(w) * 33, 50 + Math.sin(w) * 33, r));
  }
  return striche;
};

const pfeilRunter: Sinnbild = (r) => [linieStrich(50, 18, 50, 80, r), polyStrich([36, 64, 50, 82, 64, 64], r, 2)];

const pfeilHoch: Sinnbild = (r) => [linieStrich(50, 82, 50, 20, r), polyStrich([36, 36, 50, 18, 64, 36], r, 2)];

/** Der Katalog. Namen sind das, was die KI im Feld `symbol` schreibt. */
export const SYMBOLE: Record<string, Sinnbild> = {
  mensch,
  baum,
  herz,
  gehirn,
  zelle,
  sonne,
  wolke,
  wasser,
  haus,
  buch,
  gluehbirne,
  blatt,
  auge,
  stern,
  uhr,
  berg,
  becher,
  atom,
  globus,
  blitz,
  frage,
  haken,
  kreuz,
  klammer,
  zahnrad,
  "pfeil-runter": pfeilRunter,
  "pfeil-hoch": pfeilHoch,
};

/** Alle bekannten Namen (fuer den Prompt und die Pruefung). */
export const SYMBOL_NAMEN = Object.keys(SYMBOLE);

/** Striche eines Sinnbilds oder, bei unbekanntem Namen, null. */
export function sinnbildStriche(name: string, rnd: Zufall): number[][] | null {
  const bild = SYMBOLE[name];
  return bild ? bild(rnd) : null;
}
