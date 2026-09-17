"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums, TablesInsert } from "@/lib/supabase/types";

export type TodoInput = {
  titel: string;
  fach_id: string | null;
  prioritaet: Enums<"prioritaet">;
};

export async function createTodo(input: TodoInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const payload: TablesInsert<"todo"> = {
    user_id: user.id,
    fach_id: input.fach_id,
    titel: input.titel,
    prioritaet: input.prioritaet,
  };

  const { data, error } = await supabase.from("todo").insert(payload).select().single();
  if (error) throw new Error(error.message);

  revalidatePath("/");
  return data;
}

export async function updateTodo(id: string, input: TodoInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("todo")
    .update({ fach_id: input.fach_id, titel: input.titel, prioritaet: input.prioritaet })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function toggleTodoErledigt(id: string, erledigt: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("todo").update({ erledigt }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function deleteTodo(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("todo").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
