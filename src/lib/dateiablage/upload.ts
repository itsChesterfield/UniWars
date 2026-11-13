"use client";

// Direkt-Upload zum Supabase Storage (signierte URL) mit Fortschritt – fetch kann das nicht.
// So geht die Datei nicht durch die Vercel-Funktion (dort max. ~4,5 MB pro Anfrage).
export function hochladenMitFortschritt(
  signedUrl: string,
  datei: File,
  mime: string,
  beiFortschritt: (anteil: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", mime);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (apikey) xhr.setRequestHeader("apikey", apikey);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) beiFortschritt(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let meldung = `Upload fehlgeschlagen (${xhr.status})`;
        try {
          const antwort = JSON.parse(xhr.responseText) as { message?: string; error?: string };
          if (antwort.message) meldung = antwort.message;
        } catch {
          // Antwort war kein JSON
        }
        reject(new Error(meldung));
      }
    };
    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Hochladen."));
    xhr.onabort = () => reject(new DOMException("Abgebrochen", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(datei);
  });
}
