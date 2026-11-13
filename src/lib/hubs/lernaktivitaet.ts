import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { pruefeUndAktualisiereStreak } from "@/lib/streak";

// KK-06 / WS-03: Lernaktivität zählt für den Streak.
export async function lernaktivitaetVermerken(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase.from("settings").select("*").eq("user_id", userId).maybeSingle();
  if (data) await pruefeUndAktualisiereStreak(supabase, userId, data);
}
