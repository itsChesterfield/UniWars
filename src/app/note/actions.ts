"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/supabase/types";

export type NoteInput = {
  titel: string;
  fach_id: string;
  wert: number;
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
  revalidatePath("/");
  return data;
}

export async function deleteNote(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("note").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
