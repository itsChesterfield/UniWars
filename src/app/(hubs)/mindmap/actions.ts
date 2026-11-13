"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { datenLesen, startDaten, type MindmapDaten } from "@/lib/mindmap/knoten";
import type { Json } from "@/lib/supabase/types";

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

function nameBereinigen(name: string | undefined, standard: string) {
  return (name ?? "").trim().slice(0, 200) || standard;
}

/** MM-01: neue Map mit Startknoten (= Name der Map). */
export async function mindmapAnlegen(fachId: string | null, name?: string): Promise<string> {
  const { supabase, userId } = await nutzer();
  const n = nameBereinigen(name, "Neue MindMap");
  const { data, error } = await supabase
    .from("mindmap")
    .insert({ user_id: userId, fach_id: fachId || null, name: n, daten: startDaten(n) as unknown as Json })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/mindmap");
  return data.id;
}

/** MM-07: Autospeichern der ganzen Map. */
export async function mindmapSpeichern(id: string, aenderung: { name?: string; daten?: MindmapDaten }): Promise<string> {
  const { supabase } = await nutzer();
  const update: { name?: string; daten?: Json } = {};
  if (aenderung.name !== undefined) update.name = nameBereinigen(aenderung.name, "Unbenannte MindMap");
  if (aenderung.daten) update.daten = datenLesen(aenderung.daten, update.name ?? "MindMap") as unknown as Json;
  const { data, error } = await supabase.from("mindmap").update(update).eq("id", id).select("geaendert_am").single();
  if (error) throw new Error(error.message);
  return data.geaendert_am;
}

export async function mindmapFachSetzen(id: string, fachId: string | null) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("mindmap").update({ fach_id: fachId || null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/mindmap");
}

export async function mindmapLoeschen(id: string) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("mindmap").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/mindmap");
}
