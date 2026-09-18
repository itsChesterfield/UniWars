"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums, TablesInsert } from "@/lib/supabase/types";

export type TodoInput = {
  titel: string;
  fach_id: string | null;
  prioritaet: Enums<"prioritaet">;
  /** Gesetzt, wenn dies ein Unterpunkt eines anderen Todos ist. */
  parentId?: string | null;
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
    parent_id: input.parentId ?? null,
  };

  const { data, error } = await supabase.from("todo").insert(payload).select().single();
  if (error) throw new Error(error.message);

  revalidatePath("/");
  return data;
}

export async function createUnterpunkte(parentId: string, fachId: string | null, titel: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const payload: TablesInsert<"todo">[] = titel.map((t) => ({
    user_id: user.id,
    fach_id: fachId,
    titel: t,
    prioritaet: "MITTEL",
    parent_id: parentId,
  }));

  const { data, error } = await supabase.from("todo").insert(payload).select();
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
