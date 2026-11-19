import "server-only";

import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function pdfIndexieren(supabase: Supabase, datei: { id: string; user_id: string; speicher_pfad: string }) {
  const { data, error } = await supabase.storage.from("dateiablage").download(datei.speicher_pfad);
  if (error) throw error;

  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // PDF.js nutzt im Node-Prozess seinen eigenen Worker als Modul. Der Browser-Worker
  // aus dem Next-Bundle hat einen anderen Einstiegspunkt.
  const ladeModul = createRequire(resolve("package.json"));
  GlobalWorkerOptions.workerSrc = pathToFileURL(ladeModul.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
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
