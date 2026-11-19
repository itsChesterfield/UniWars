"use server";

import { createClient } from "@/lib/supabase/server";
import { dateiVerschieben } from "@/app/(hubs)/dateiablage/actions";
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
  let { error } = await supabase.from("pdf_stand").upsert(zeile, { onConflict: "datei_id,user_id" });
  if (error?.code === "42P10") {
    ({ error } = await supabase.from("pdf_stand").upsert(zeile, { onConflict: "datei_id" }));
  }
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

// --- Ordner im PDF Reader ------------------------------------------------------

export type PdfOrdner = { id: string; name: string };

function ordnerName(eingabe: string): string {
  const name = eingabe.replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Der Ordnername darf nicht leer sein.");
  if (name.length > 100) throw new Error("Der Ordnername ist zu lang (höchstens 100 Zeichen).");
  return name;
}

function ordnerFehler(error: { code?: string; message: string }): never {
  if (error.code === "23505") throw new Error("Es gibt schon einen Ordner mit diesem Namen.");
  throw new Error(error.message);
}

export async function pdfOrdnerAnlegen(eingabe: string): Promise<PdfOrdner> {
  const supabase = await angemeldet();
  const { data, error } = await supabase.from("pdf_ordner").insert({ name: ordnerName(eingabe) }).select("id, name").single();
  if (error) ordnerFehler(error);
  return data;
}

export async function pdfOrdnerUmbenennen(id: string, eingabe: string): Promise<PdfOrdner> {
  const supabase = await angemeldet();
  const { data, error } = await supabase.from("pdf_ordner").update({ name: ordnerName(eingabe) }).eq("id", id).select("id, name").single();
  if (error) ordnerFehler(error);
  return data;
}

/** Die PDFs bleiben erhalten und landen wieder in "Ohne Ordner". */
export async function pdfOrdnerLoeschen(id: string) {
  const supabase = await angemeldet();
  const { error } = await supabase.from("pdf_ordner").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Wohin eine PDF gezogen wurde: in ein Fach (= Ordner der Dateiablage), einen eigenen Ordner oder ganz raus. */
export type PdfZiel = { art: "fach"; id: string } | { art: "ordner"; id: string } | { art: "wurzel" };

/**
 * PDF verschieben. Fach-Ordner sind dieselben wie in der Dateiablage (fach_id);
 * eigene Ordner gibt es nur im PDF Reader (pdf_ordner_id). "Ganz raus" heißt:
 * ohne Fach und ohne Ordner. Gibt den (evtl. eindeutig gemachten) Namen zurück.
 */
export async function pdfVerschieben(dateiId: string, ziel: PdfZiel): Promise<{ name: string }> {
  const supabase = await angemeldet();
  if (ziel.art === "ordner") {
    // Nur eigene Ordner (RLS liefert fremde gar nicht erst)
    const { data: ordner } = await supabase.from("pdf_ordner").select("id").eq("id", ziel.id).maybeSingle();
    if (!ordner) throw new Error("Ordner nicht gefunden.");
    const { data, error } = await supabase.from("datei").update({ pdf_ordner_id: ziel.id }).eq("id", dateiId).select("name").single();
    if (error) throw new Error(error.message);
    return data;
  }
  // Fach oder ganz raus: wie in der Dateiablage verschieben (Name wird bei Bedarf eindeutig)
  const verschoben = await dateiVerschieben(dateiId, ziel.art === "fach" ? ziel.id : null);
  const { error } = await supabase.from("datei").update({ pdf_ordner_id: null }).eq("id", dateiId);
  if (error) throw new Error(error.message);
  return { name: verschoben.name };
}
