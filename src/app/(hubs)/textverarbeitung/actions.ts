"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json, Tables } from "@/lib/supabase/types";

export type Dokument = Tables<"dokument">;

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

/** TXT-01: leeres Dokument anlegen. */
export async function dokumentAnlegen(fachId: string | null): Promise<string> {
  const { supabase, userId } = await nutzer();
  const { data, error } = await supabase
    .from("dokument")
    .insert({ user_id: userId, fach_id: fachId || null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/textverarbeitung");
  return data.id;
}

type Aenderung = { titel?: string; inhalt?: Json; klartext?: string; woerter?: number };

/** ALL-08: Autospeichern. */
export async function dokumentSpeichern(id: string, aenderung: Aenderung): Promise<string> {
  const { supabase } = await nutzer();
  const update: Aenderung = {};
  if (typeof aenderung.titel === "string") update.titel = aenderung.titel.slice(0, 300);
  if (aenderung.inhalt !== undefined) {
    const doc = aenderung.inhalt as { type?: unknown } | null;
    if (!doc || typeof doc !== "object" || doc.type !== "doc") throw new Error("Ungültiger Inhalt");
    update.inhalt = aenderung.inhalt;
  }
  if (typeof aenderung.klartext === "string") update.klartext = aenderung.klartext.slice(0, 500000);
  if (typeof aenderung.woerter === "number") update.woerter = Math.max(0, Math.floor(aenderung.woerter));
  const { data, error } = await supabase.from("dokument").update(update).eq("id", id).select("geaendert_am").single();
  if (error) throw new Error(error.message);
  return data.geaendert_am;
}

export async function dokumentFachSetzen(id: string, fachId: string | null) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("dokument").update({ fach_id: fachId || null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/textverarbeitung");
}

export async function dokumentLoeschen(id: string) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("dokument").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/textverarbeitung");
}

/** Bilder aus der Dateiablage für "Bild einfügen" (TXT-02) und Folien (PRÄ-04). */
export async function bilderLaden(): Promise<{ id: string; name: string }[]> {
  const { supabase } = await nutzer();
  const { data } = await supabase
    .from("datei")
    .select("id, name")
    .in("mime_typ", ["image/png", "image/jpeg"])
    .order("erstellt_am", { ascending: false })
    .limit(200);
  return data ?? [];
}
