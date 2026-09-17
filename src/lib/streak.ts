import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";

type Settings = Tables<"settings">;

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

function gestern(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Läuft einmal pro Tag beim ersten Dashboard-Aufruf: gestern aktiv -> +1,
 * Lücke -> Freeze verbrauchen (falls vorhanden), sonst Streak auf 1 zurücksetzen.
 */
export async function pruefeUndAktualisiereStreak(
  supabase: SupabaseClient<Database>,
  userId: string,
  settings: Settings,
): Promise<Settings> {
  const heuteStr = heute();
  if (settings.streak_last_active === heuteStr) return settings;

  let neuerCount = settings.streak_count;
  let neueFreezes = settings.streak_freezes;

  if (settings.streak_last_active === null || settings.streak_last_active === gestern()) {
    neuerCount += 1;
  } else if (neueFreezes > 0) {
    neueFreezes -= 1;
  } else {
    neuerCount = 1;
  }

  const { data, error } = await supabase
    .from("settings")
    .update({ streak_count: neuerCount, streak_last_active: heuteStr, streak_freezes: neueFreezes })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
