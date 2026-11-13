"use server";

import { createClient } from "@/lib/supabase/server";
import { alsRechtecke, istFarbe, type Farbe, type Rechteck } from "@/lib/pdf-reader/markierungen";

/** PDF-04 / PDF-05: Lesezeichen und zuletzt gelesene Seite merken. */
export async function pdfStandSpeichern(dateiId: string, stand: { letzteSeite?: number; lesezeichen?: number[] }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const zeile: { datei_id: string; user_id: string; letzte_seite?: number; lesezeichen?: number[] } = {
    datei_id: dateiId,
    user_id: user.id,
  };
  if (stand.letzteSeite !== undefined) zeile.letzte_seite = Math.max(1, Math.floor(stand.letzteSeite));
  if (stand.lesezeichen !== undefined) {
    zeile.lesezeichen = [...new Set(stand.lesezeichen.map((s) => Math.floor(s)).filter((s) => s >= 1))].sort((a, b) => a - b).slice(0, 500);
  }
  const { error } = await supabase.from("pdf_stand").upsert(zeile, { onConflict: "datei_id" });
  if (error) throw new Error(error.message);
}

export type Markierung = {
  id: string;
  seite: number;
  farbe: Farbe;
  rechtecke: Rechteck[];
  text: string;
  notiz: string | null;
};

async function angemeldet() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return supabase;
}

/** Textmarker setzen. */
export async function markierungAnlegen(
  dateiId: string,
  daten: { seite: number; farbe: string; rechtecke: Rechteck[]; text: string },
): Promise<Markierung> {
  const rechtecke = alsRechtecke(daten.rechtecke).slice(0, 200);
  if (rechtecke.length === 0) throw new Error("Keine Markierung");
  const supabase = await angemeldet();
  const { data, error } = await supabase
    .from("pdf_markierung")
    .insert({
      datei_id: dateiId,
      seite: Math.max(1, Math.floor(daten.seite)),
      farbe: istFarbe(daten.farbe) ? daten.farbe : "GELB",
      rechtecke,
      text: daten.text.slice(0, 5000),
    })
    .select("id, seite, farbe, rechtecke, text, notiz")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, farbe: istFarbe(data.farbe) ? data.farbe : "GELB", rechtecke: alsRechtecke(data.rechtecke) };
}

/** Farbe oder Notiz einer Markierung ändern. */
export async function markierungAendern(id: string, aenderung: { farbe?: string; notiz?: string | null }) {
  const zeile: { farbe?: Farbe; notiz?: string | null } = {};
  if (aenderung.farbe !== undefined && istFarbe(aenderung.farbe)) zeile.farbe = aenderung.farbe;
  if (aenderung.notiz !== undefined) zeile.notiz = aenderung.notiz?.trim() ? aenderung.notiz.trim().slice(0, 2000) : null;
  if (Object.keys(zeile).length === 0) return;
  const supabase = await angemeldet();
  const { error } = await supabase.from("pdf_markierung").update(zeile).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markierungLoeschen(id: string) {
  const supabase = await angemeldet();
  const { error } = await supabase.from("pdf_markierung").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
