"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums, TablesInsert } from "@/lib/supabase/types";

export type StundenplanInput = {
  fach_id: string;
  tag: Enums<"wochentag">;
  start_zeit: string;
  end_zeit: string;
  raum: string | null;
  dozent: string | null;
};

export async function createStundenplanEintrag(input: StundenplanInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const payload: TablesInsert<"stundenplan_eintrag"> = {
    user_id: user.id,
    fach_id: input.fach_id,
    tag: input.tag,
    start_zeit: input.start_zeit,
    end_zeit: input.end_zeit,
    raum: input.raum,
    dozent: input.dozent,
  };

  const { data, error } = await supabase
    .from("stundenplan_eintrag")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/");
  return data;
}

export async function updateStundenplanEintrag(id: string, input: StundenplanInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stundenplan_eintrag")
    .update({
      fach_id: input.fach_id,
      tag: input.tag,
      start_zeit: input.start_zeit,
      end_zeit: input.end_zeit,
      raum: input.raum,
      dozent: input.dozent,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/");
  return data;
}

export async function deleteStundenplanEintrag(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stundenplan_eintrag").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
