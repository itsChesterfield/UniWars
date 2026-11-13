"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  bewerten,
  boxAusIntervall,
  istBewertung,
  NOCHMAL_MINUTEN,
  STREAK_MIN_KARTEN,
  type Bewertung,
  type KartenStand,
} from "@/lib/karteikarten/wiederholung";
import { lernaktivitaetVermerken } from "@/lib/hubs/lernaktivitaet";
import { berlinDatum, berlinMitternacht } from "@/lib/zeit";
import type { Tables } from "@/lib/supabase/types";

export type Stapel = Tables<"kk_stapel">;
export type Karte = Tables<"kk_karte">;

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

function pflichttext(wert: string, feld: string, max: number) {
  const text = wert.trim();
  if (!text) throw new Error(`${feld} darf nicht leer sein.`);
  if (text.length > max) throw new Error(`${feld} ist zu lang.`);
  return text;
}

/** KK-01 */
export async function stapelAnlegen(name: string, fachId: string | null): Promise<Stapel> {
  const { supabase, userId } = await nutzer();
  const { data, error } = await supabase
    .from("kk_stapel")
    .insert({ user_id: userId, name: pflichttext(name, "Name", 120), fach_id: fachId || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/karteikarten");
  return data;
}

export async function stapelBearbeiten(id: string, name: string, fachId: string | null) {
  const { supabase } = await nutzer();
  const { error } = await supabase
    .from("kk_stapel")
    .update({ name: pflichttext(name, "Name", 120), fach_id: fachId || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/karteikarten");
  revalidatePath(`/karteikarten/${id}`);
}

export async function stapelLoeschen(id: string) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("kk_stapel").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/karteikarten");
}

/** KK-02 */
export async function karteAnlegen(stapelId: string, vorderseite: string, rueckseite: string): Promise<Karte> {
  const { supabase, userId } = await nutzer();
  const { data, error } = await supabase
    .from("kk_karte")
    .insert({
      user_id: userId,
      stapel_id: stapelId,
      vorderseite: pflichttext(vorderseite, "Vorderseite", 5000),
      rueckseite: pflichttext(rueckseite, "Rückseite", 5000),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  // Stapel als geändert markieren (Sortierung der Übersicht)
  await supabase.from("kk_stapel").update({ geaendert_am: new Date().toISOString() }).eq("id", stapelId);
  revalidatePath("/karteikarten");
  revalidatePath(`/karteikarten/${stapelId}`);
  return data;
}

/** KK-03 */
export async function karteBearbeiten(id: string, vorderseite: string, rueckseite: string): Promise<Karte> {
  const { supabase } = await nutzer();
  const { data, error } = await supabase
    .from("kk_karte")
    .update({
      vorderseite: pflichttext(vorderseite, "Vorderseite", 5000),
      rueckseite: pflichttext(rueckseite, "Rückseite", 5000),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/karteikarten/${data.stapel_id}`);
  return data;
}

export async function karteLoeschen(id: string) {
  const { supabase } = await nutzer();
  const { data, error } = await supabase.from("kk_karte").delete().eq("id", id).select("stapel_id").maybeSingle();
  if (error) throw new Error(error.message);
  revalidatePath("/karteikarten");
  if (data) revalidatePath(`/karteikarten/${data.stapel_id}`);
}

/**
 * KK-04/KK-05: Bewertung sofort speichern, damit ein Abbruch nichts verliert.
 * Gibt den neuen Stand zurück (für die Anzeige im Lernmodus).
 */
export async function karteBeantworten(id: string, bewertung: Bewertung): Promise<KartenStand & { naechste_abfrage: string }> {
  if (!istBewertung(bewertung)) throw new Error("Ungültige Bewertung");
  const { supabase } = await nutzer();
  const { data: karte, error: ladeFehler } = await supabase
    .from("kk_karte")
    .select("intervall_tage, leichtigkeit, wiederholungen, fehler")
    .eq("id", id)
    .single();
  if (ladeFehler) throw new Error(ladeFehler.message);
  const stand = bewerten(karte, bewertung);
  const jetzt = new Date();
  const naechste =
    stand.intervall_tage === 0
      ? new Date(jetzt.getTime() + NOCHMAL_MINUTEN * 60_000)
      : berlinMitternacht(berlinDatum(), stand.intervall_tage);
  const { error } = await supabase
    .from("kk_karte")
    .update({
      ...stand,
      box: boxAusIntervall(stand.intervall_tage),
      naechste_abfrage: naechste.toISOString(),
      zuletzt_gelernt: jetzt.toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ...stand, naechste_abfrage: naechste.toISOString() };
}

/** KK-06: Lernrunde abgeschlossen – ab 10 Karten zählt sie für den Streak. */
export async function lernrundeAbschliessen(stapelId: string, anzahlKarten: number) {
  const { supabase, userId } = await nutzer();
  if (anzahlKarten >= STREAK_MIN_KARTEN) await lernaktivitaetVermerken(supabase, userId);
  revalidatePath("/karteikarten");
  revalidatePath(`/karteikarten/${stapelId}`);
}
