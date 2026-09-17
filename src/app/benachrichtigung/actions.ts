"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markiereBenachrichtigungGelesen(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("benachrichtigung").update({ gelesen: true }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
