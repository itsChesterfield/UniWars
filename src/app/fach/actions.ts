"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/lib/supabase/types";

export type FachInput = {
  name: string;
  semester: string | null;
  farbe: string | null;
  ects: number | null;
  anwesenheitspflicht: boolean;
  max_fehltage: number | null;
};

export async function createFach(input: FachInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const payload: TablesInsert<"fach"> = {
    user_id: user.id,
    name: input.name,
    semester: input.semester,
    farbe: input.farbe,
    ects: input.ects,
    anwesenheitspflicht: input.anwesenheitspflicht,
    max_fehltage: input.anwesenheitspflicht ? input.max_fehltage : null,
  };

  const { data, error } = await supabase
    .from("fach")
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/");
  return data;
}

export async function updateFach(id: string, input: FachInput) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fach")
    .update({
      name: input.name,
      semester: input.semester,
      farbe: input.farbe,
      ects: input.ects,
      anwesenheitspflicht: input.anwesenheitspflicht,
      max_fehltage: input.anwesenheitspflicht ? input.max_fehltage : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/");
  return data;
}

export async function archiveFach(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("fach").update({ aktiv: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
