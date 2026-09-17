"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums, TablesInsert } from "@/lib/supabase/types";

export type DeadlineInput = {
  titel: string;
  fach_id: string | null;
  faellig_am: string;
  typ: Enums<"deadline_typ">;
  kategorie: Enums<"deadline_kategorie">;
};

export async function createDeadline(input: DeadlineInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const payload: TablesInsert<"deadline"> = {
    user_id: user.id,
    fach_id: input.fach_id,
    titel: input.titel,
    faellig_am: input.faellig_am,
    typ: input.typ,
    kategorie: input.kategorie,
  };

  const { data, error } = await supabase.from("deadline").insert(payload).select().single();
  if (error) throw new Error(error.message);

  revalidatePath("/");
  return data;
}

export async function updateDeadline(id: string, input: DeadlineInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deadline")
    .update({
      fach_id: input.fach_id,
      titel: input.titel,
      faellig_am: input.faellig_am,
      typ: input.typ,
      kategorie: input.kategorie,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function toggleDeadlineErledigt(id: string, erledigt: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("deadline").update({ erledigt }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function deleteDeadline(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("deadline").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
