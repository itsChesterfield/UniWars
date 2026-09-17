"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/types";

export async function setTheme(theme: Enums<"theme">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { error } = await supabase.from("settings").update({ theme }).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}

export async function setSichtbareWidgets(widgets: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const { error } = await supabase
    .from("settings")
    .update({ sichtbare_widgets: widgets })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
