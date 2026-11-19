import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { MAX_DATEI_BYTES } from "@/lib/dateiablage/dateien";
import type { PDFDocumentProxy } from "pdfjs-dist";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function pdfLaden(supabase: Supabase, pfad: string) {
  const { data, error } = await supabase.storage.from("dateiablage").download(pfad);
  if (error || !data || data.size > MAX_DATEI_BYTES) throw new Error("PDF konnte nicht geladen werden.");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Der Worker registriert seinen Message Handler für PDF.js im Node-Prozess.
  await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  return getDocument({
    data: new Uint8Array(await data.arrayBuffer()),
    stopAtErrors: true,
    useSystemFonts: false,
  });
}

async function seitenText(pdf: PDFDocumentProxy, seite: number) {
  const blatt = await pdf.getPage(seite);
  try {
    const { items } = await blatt.getTextContent();
    return {
      seite,
      text: items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim().slice(0, 30_000),
    };
  } finally {
    blatt.cleanup();
  }
}

/** Kurzer Auszug für Titel und Themen, solange die PDF noch keinen Suchindex hat. */
export async function pdfTextAnfang(supabase: Supabase, pfad: string, limit: number) {
  const laden = await pdfLaden(supabase, pfad);
  try {
    const pdf = await laden.promise;
    const zeilen = [];
    for (let seite = 1; seite <= Math.min(5, pdf.numPages) && zeilen.length < limit; seite++) {
      const zeile = await seitenText(pdf, seite);
      if (zeile.text) zeilen.push(zeile);
    }
    return zeilen;
  } finally {
    await laden.destroy();
  }
}

/** Leseprobe für Studio, wenn noch kein Suchindex vorhanden ist. Zugriff und Storage bleiben an RLS gebunden. */
export async function pdfTextFuerStudio(supabase: Supabase, id: string, aktuelleSeite?: number) {
  const { data } = await supabase.from("datei").select("speicher_pfad").eq("id", id)
    .eq("mime_typ", "application/pdf").maybeSingle();
  if (!data) return [];
  const laden = await pdfLaden(supabase, data.speicher_pfad);
  try {
    const pdf = await laden.promise;
    const nummern = new Set(Array.from({ length: Math.min(8, pdf.numPages) }, (_, i) => i + 1));
    if (aktuelleSeite) {
      for (const seite of [aktuelleSeite - 1, aktuelleSeite, aktuelleSeite + 1]) {
        if (seite >= 1 && seite <= pdf.numPages) nummern.add(seite);
      }
    }
    for (let i = 0; i < 9; i++) nummern.add(1 + Math.round(i * (pdf.numPages - 1) / 8));
    const zeilen = [];
    for (const seite of [...nummern].sort((a, b) => a - b)) {
      const zeile = await seitenText(pdf, seite);
      if (zeile.text) zeilen.push(zeile);
    }
    return zeilen;
  } finally {
    await laden.destroy();
  }
}

export async function pdfIndexieren(supabase: Supabase, datei: { id: string; user_id: string; speicher_pfad: string }) {
  const laden = await pdfLaden(supabase, datei.speicher_pfad);
  try {
    const pdf = await laden.promise;
    let zeilen = [];
    for (let seite = 1; seite <= pdf.numPages; seite++) {
      zeilen.push({ datei_id: datei.id, user_id: datei.user_id, ...await seitenText(pdf, seite) });
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
