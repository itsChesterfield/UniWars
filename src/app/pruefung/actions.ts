"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums, TablesInsert } from "@/lib/supabase/types";

export type PruefungInput = {
  titel: string;
  fach_id: string;
  datum: string;
  raum: string | null;
  status: Enums<"pruefung_status">;
};

export async function createPruefung(input: PruefungInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const payload: TablesInsert<"pruefung"> = {
    user_id: user.id,
    fach_id: input.fach_id,
    titel: input.titel,
    datum: input.datum,
    raum: input.raum,
    status: input.status,
  };

  const { data, error } = await supabase.from("pruefung").insert(payload).select().single();
  if (error) throw new Error(error.message);

  revalidatePath("/");
  return data;
}

export async function updatePruefung(id: string, input: PruefungInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pruefung")
    .update({
      fach_id: input.fach_id,
      titel: input.titel,
      datum: input.datum,
      raum: input.raum,
      status: input.status,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function deletePruefung(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pruefung").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
