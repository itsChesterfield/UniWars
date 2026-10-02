import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createClientMitToken } from "@/lib/supabase/token-client";
import { googleKonfiguriert } from "@/lib/kalender/google";
import { vollAbgleich } from "@/lib/kalender/abgleich";

// Läuft nach der Antwort, damit Speichern in UniWars nie auf Google warten muss.
export async function kalenderAbgleichAnstossen(supabase: SupabaseClient<Database>) {
  if (!googleKonfiguriert()) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  const { access_token: token, user } = session;

  after(async () => {
    try {
      await vollAbgleich(createClientMitToken(token), user.id);
    } catch (err) {
      console.error("Kalender-Abgleich fehlgeschlagen", err);
    }
  });
}

// Beim Laden des Dashboards höchstens alle 10 Minuten, damit geteilte Einträge
// anderer Mitglieder auch ohne eigene Aktion im Kalender landen.
export function abgleichNachLadenPlanen(accessToken: string, userId: string, zuletztAbgeglichen: string | null) {
  after(async () => {
    const zuletzt = zuletztAbgeglichen ? new Date(zuletztAbgeglichen).getTime() : 0;
    if (Date.now() - zuletzt < 10 * 60_000) return;
    try {
      await vollAbgleich(createClientMitToken(accessToken), userId);
    } catch (err) {
      console.error("Kalender-Abgleich beim Laden fehlgeschlagen", err);
    }
  });
}
