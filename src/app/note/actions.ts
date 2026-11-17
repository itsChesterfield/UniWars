"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/supabase/types";

export type NoteInput = {
  titel: string;
  fach_id: string;
  /** leer = ausstehend (z. B. Prüfung ohne Ergebnis) */
  wert: number | null;
  gewicht: number;
  datum: string;
};

export async function createNote(input: NoteInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const payload: TablesInsert<"note"> = {
    user_id: user.id,
    fach_id: input.fach_id,
    titel: input.titel,
    wert: input.wert,
    gewicht: input.gewicht,
    datum: input.datum,
  };

  const { data, error } = await supabase.from("note").insert(payload).select().single();
  if (error) throw new Error(error.message);

  revalidatePath("/");
  return data;
}

/** Note mit Prüfung: Mit eingetragenem Wert ist die Prüfung bestanden (bis 4,0) oder nicht */
async function pruefungAbgleichen(supabase: Awaited<ReturnType<typeof createClient>>, pruefungId: string | null, wert: number | null) {
  if (!pruefungId) return;
  const status = wert === null ? "ANSTEHEND" : wert <= 4 ? "BESTANDEN" : "NICHT_BESTANDEN";
  await supabase.from("pruefung").update({ status }).eq("id", pruefungId);
}

export async function updateNote(id: string, input: NoteInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("note")
    .update({
      fach_id: input.fach_id,
      titel: input.titel,
      wert: input.wert,
      gewicht: input.gewicht,
      datum: input.datum,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  await pruefungAbgleichen(supabase, data.pruefung_id, data.wert);
  revalidatePath("/");
  return data;
}

export async function deleteNote(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("note").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
