"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { datenLesen, type TabellenDaten } from "@/lib/tabellen/formeln";
import type { Json, Tables } from "@/lib/supabase/types";

export type Tabelle = Tables<"tabelle">;

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

/** TAB-01: neue Tabelle mit 10 Spalten × 20 Zeilen. */
export async function tabelleAnlegen(fachId: string | null): Promise<string> {
  const { supabase, userId } = await nutzer();
  const { data, error } = await supabase.from("tabelle").insert({ user_id: userId, fach_id: fachId || null }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/tabellen");
  return data.id;
}

export async function tabelleSpeichern(id: string, aenderung: { titel?: string; daten?: TabellenDaten }): Promise<string> {
  const { supabase } = await nutzer();
  const update: { titel?: string; daten?: Json } = {};
  if (typeof aenderung.titel === "string") update.titel = aenderung.titel.slice(0, 300);
  if (aenderung.daten) {
    const daten = datenLesen(aenderung.daten);
    for (const zelle of Object.values(daten.zellen)) {
      if (zelle.w && zelle.w.length > 2000) zelle.w = zelle.w.slice(0, 2000);
    }
    update.daten = daten as unknown as Json;
  }
  const { data, error } = await supabase.from("tabelle").update(update).eq("id", id).select("geaendert_am").single();
  if (error) throw new Error(error.message);
  return data.geaendert_am;
}

export async function tabelleFachSetzen(id: string, fachId: string | null) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("tabelle").update({ fach_id: fachId || null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tabellen");
}

export async function tabelleLoeschen(id: string) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("tabelle").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tabellen");
}
