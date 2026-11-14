"use client";

import { uploadAbschliessen, uploadVerwerfen, uploadVorbereiten, type Datei } from "@/app/(hubs)/dateiablage/actions";
import { hochladenMitFortschritt } from "@/lib/dateiablage/upload";

/**
 * Länge einer Audiodatei im Browser bestimmen. WebM-Aufnahmen haben oft keine Länge im
 * Kopf (Infinity) – dann wird ans Ende gesprungen, bis der Browser sie kennt.
 */
export function audioDauer(url: string, timeoutMs = 20_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = "metadata";
    const fertig = (wert: number | null) => {
      window.clearTimeout(zeit);
      audio.removeAttribute("src");
      audio.load();
      if (wert && Number.isFinite(wert) && wert > 0) resolve(wert);
      else reject(new Error("Die Länge der Aufnahme konnte nicht bestimmt werden."));
    };
    const zeit = window.setTimeout(() => fertig(null), timeoutMs);
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) return fertig(audio.duration);
      audio.ontimeupdate = () => {
        if (Number.isFinite(audio.duration)) fertig(audio.duration);
      };
      audio.currentTime = 1e101;
    };
    audio.onerror = () => fertig(null);
    audio.src = url;
  });
}

/** In die Dateiablage hochladen (gleicher Weg wie DAT-02: direkt in den Storage). */
export async function inDateiablage(datei: File, fachId: string | null, beiFortschritt: (anteil: number) => void = () => undefined): Promise<Datei> {
  let pfad: string | null = null;
  try {
    const ticket = await uploadVorbereiten({ name: datei.name, groesse: datei.size, fachId });
    pfad = ticket.pfad;
    await hochladenMitFortschritt(ticket.signedUrl, datei, ticket.mime, beiFortschritt);
    return await uploadAbschliessen({ pfad: ticket.pfad, name: ticket.name, fachId });
  } catch (err) {
    if (pfad) void uploadVerwerfen(pfad).catch(() => undefined);
    throw err;
  }
}
