/**
 * Eigene Bilder: im Browser verkleinern, bevor etwas hochgeladen wird.
 * Neu kodieren entfernt nebenbei alle Metadaten (Ort, Kamera, Zeit). Die Ausrichtung aus dem Foto wird vorher angewendet.
 */
import { EINGABE_TYPEN, KANTEN, MAX_EINGABE_BYTES, helligkeitMessen } from "./hintergrund.ts";

export type Fassungen = { gross: Blob; mittel: Blob; weich: Blob; endung: "webp" | "jpg"; tief: number; hoch: number };

/** Höchstgröße einer Fassung, wie im Bucket eingestellt */
const MAX_FASSUNG = 2 * 1024 * 1024;

export class BildFehler extends Error {}

export function eingabePruefen(datei: File): string | null {
  if (!EINGABE_TYPEN.includes(datei.type)) {
    return /heic|heif/i.test(datei.type) || /\.hei[cf]$/i.test(datei.name)
      ? "HEIC-Fotos kann der Browser nicht lesen. Speichere das Foto als JPEG (am iPhone: Teilen, „Als JPEG sichern“ oder ein Bildschirmfoto)."
      : "Das geht mit JPEG, PNG oder WebP.";
  }
  if (datei.size > MAX_EINGABE_BYTES) return "Das Bild ist größer als 20 MB. Nimm bitte eine kleinere Fassung.";
  return null;
}

function leinwand(b: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(b));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d");
  if (!ctx) throw new BildFehler("Kein Zeichenbereich");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

function alsBlob(c: HTMLCanvasElement, typ: string, q: number): Promise<Blob> {
  return new Promise((ok, nein) => c.toBlob((b) => (b ? ok(b) : nein(new BildFehler("Kodieren"))), typ, q));
}

/** WebP, wo der Browser es schreiben kann, sonst JPEG. Zu groß: noch einmal mit weniger Qualität. */
async function kodieren(c: HTMLCanvasElement, endung: "webp" | "jpg"): Promise<Blob> {
  const typ = endung === "webp" ? "image/webp" : "image/jpeg";
  for (const q of [0.82, 0.7, 0.55]) {
    const b = await alsBlob(c, typ, q);
    if (b.size <= MAX_FASSUNG) return b;
  }
  throw new BildFehler("Zu groß");
}

function skaliert(quelle: CanvasImageSource, b: number, h: number, kante: number) {
  const f = Math.min(1, kante / Math.max(b, h));
  const { c, ctx } = leinwand(b * f, h * f);
  ctx.drawImage(quelle, 0, 0, c.width, c.height);
  return c;
}

export async function bildVorbereiten(datei: File): Promise<Fassungen> {
  const bitmap = await createImageBitmap(datei, { imageOrientation: "from-image" }).catch(() => {
    throw new BildFehler("Lesen");
  });
  const { width: b, height: h } = bitmap;
  // WebP schreiben kann nicht jeder Browser; dann liefert toBlob PNG zurück
  const probe = await alsBlob(leinwand(2, 2).c, "image/webp", 0.8);
  const endung = probe.type === "image/webp" ? "webp" : "jpg";

  const gross = skaliert(bitmap, b, h, KANTEN.gross);
  const mittel = skaliert(gross, gross.width, gross.height, KANTEN.mittel);
  // Unscharf ohne Filter (den nicht jeder Browser kann): sehr klein rechnen und wieder vergrößern
  const winzig = skaliert(mittel, mittel.width, mittel.height, 48);
  const f = KANTEN.weich / Math.max(winzig.width, winzig.height);
  const w2 = leinwand(winzig.width * f, winzig.height * f);
  w2.ctx.drawImage(winzig, 0, 0, w2.c.width, w2.c.height);
  bitmap.close();

  // Helligkeit an einer kleinen Fassung messen: reicht für Perzentile und geht schnell
  const mess = skaliert(mittel, mittel.width, mittel.height, 256);
  const daten = mess.getContext("2d")?.getImageData(0, 0, mess.width, mess.height).data ?? new Uint8ClampedArray();
  const { tief, hoch } = helligkeitMessen(daten);

  return { gross: await kodieren(gross, endung), mittel: await kodieren(mittel, endung), weich: await kodieren(w2.c, endung), endung, tief, hoch };
}
