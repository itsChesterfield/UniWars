"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { designLesen, folienLesen, neueFolie, type Design, type Folie } from "@/lib/praesentationen/folien";
import type { Json } from "@/lib/supabase/types";

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

/** PRÄ-01: neue Präsentation, erste Folie mit Layout "Titel". */
export async function praesentationAnlegen(fachId: string | null): Promise<string> {
  const { supabase, userId } = await nutzer();
  const titel = "Neue Präsentation";
  const { data, error } = await supabase
    .from("praesentation")
    .insert({ user_id: userId, fach_id: fachId || null, titel, folien: [neueFolie("TITEL", titel)] as unknown as Json })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/praesentationen");
  return data.id;
}

export async function praesentationSpeichern(
  id: string,
  aenderung: { titel?: string; design?: Design; folien?: Folie[] },
): Promise<string> {
  const { supabase } = await nutzer();
  const update: { titel?: string; design?: Design; folien?: Json } = {};
  if (typeof aenderung.titel === "string") update.titel = aenderung.titel.trim().slice(0, 200) || "Unbenannte Präsentation";
  if (aenderung.design !== undefined) update.design = designLesen(aenderung.design);
  if (aenderung.folien !== undefined) update.folien = folienLesen(aenderung.folien) as unknown as Json;
  const { data, error } = await supabase.from("praesentation").update(update).eq("id", id).select("geaendert_am").single();
  if (error) throw new Error(error.message);
  return data.geaendert_am;
}

export async function praesentationFachSetzen(id: string, fachId: string | null) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("praesentation").update({ fach_id: fachId || null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/praesentationen");
}

export async function praesentationLoeschen(id: string) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("praesentation").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/praesentationen");
}
