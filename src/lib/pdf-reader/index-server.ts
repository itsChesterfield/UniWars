import "server-only";

import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function pdfIndexieren(supabase: Supabase, datei: { id: string; user_id: string; speicher_pfad: string }) {
  const { data, error } = await supabase.storage.from("dateiablage").download(datei.speicher_pfad);
  if (error) throw error;

  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Der Worker registriert seinen Message Handler für PDF.js im Node-Prozess.
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const laden = getDocument({
    data: new Uint8Array(await data.arrayBuffer()),
    stopAtErrors: true,
    useSystemFonts: false,
  });
  try {
    const pdf = await laden.promise;
    let zeilen = [];
    for (let seite = 1; seite <= pdf.numPages; seite++) {
      const blatt = await pdf.getPage(seite);
      const { items } = await blatt.getTextContent();
      const text = items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim().slice(0, 30_000);
      blatt.cleanup();
      zeilen.push({ datei_id: datei.id, user_id: datei.user_id, seite, text });
      if (zeilen.length === 20 || seite === pdf.numPages) {
        const { error: speichernFehler } = await supabase.from("quelle_seite").upsert(zeilen, { onConflict: "datei_id,seite" });
        if (speichernFehler) throw speichernFehler;
        zeilen = [];
      }
    }
  } finally {
    await laden.destroy();
  }
}
