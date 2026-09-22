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
  /** ISO-Datum: wenn gesetzt, wöchentliche Einzel-Instanzen bis einschließlich diesem Datum anlegen. */
  wiederholenBisDatum?: string | null;
  /** Gesetzt, wenn dies eine Unteraufgabe eines Todos, einer Prüfung oder einer anderen Deadline ist. */
  todoId?: string | null;
  pruefungId?: string | null;
  parentDeadlineId?: string | null;
};

function woechentlicheTermine(start: string, bisDatum: string): string[] {
  const termine: string[] = [start];
  const startDatum = new Date(start);
  const ende = new Date(bisDatum);
  ende.setHours(23, 59, 59, 999);

  let naechster = new Date(startDatum);
  naechster.setDate(naechster.getDate() + 7);

  while (naechster <= ende) {
    termine.push(naechster.toISOString());
    naechster = new Date(naechster);
    naechster.setDate(naechster.getDate() + 7);
  }

  return termine;
}

export async function createDeadline(input: DeadlineInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const termine = input.wiederholenBisDatum
    ? woechentlicheTermine(input.faellig_am, input.wiederholenBisDatum)
    : [input.faellig_am];

  const wiederhol_regel = input.wiederholenBisDatum
    ? `woechentlich_bis_${input.wiederholenBisDatum}`
    : null;

  const payload: TablesInsert<"deadline">[] = termine.map((faellig_am) => ({
    user_id: user.id,
    fach_id: input.fach_id,
    titel: input.titel,
    faellig_am,
    typ: input.typ,
    kategorie: input.kategorie,
    wiederhol_regel,
    todo_id: input.todoId ?? null,
    pruefung_id: input.pruefungId ?? null,
    parent_deadline_id: input.parentDeadlineId ?? null,
  }));

  const { data, error } = await supabase.from("deadline").insert(payload).select();
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
