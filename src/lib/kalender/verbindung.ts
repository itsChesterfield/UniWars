import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/types";
import { entschluesseln, verschluesseln } from "@/lib/kalender/krypto";
import { GoogleFehler, tokenErneuern } from "@/lib/kalender/google";

export type Verbindung = Tables<"kalender_verbindung">;
type Client = SupabaseClient<Database>;

export class VerbindungUngueltig extends Error {}

export async function verbindungLaden(supabase: Client, userId: string): Promise<Verbindung | null> {
  const { data, error } = await supabase
    .from("kalender_verbindung")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function gueltigerAccessToken(supabase: Client, verbindung: Verbindung): Promise<string> {
  const ablauf = verbindung.access_token_ablauf ? new Date(verbindung.access_token_ablauf).getTime() : 0;
  if (verbindung.access_token && ablauf - Date.now() > 60_000) {
    return entschluesseln(verbindung.access_token);
  }

  try {
    const antwort = await tokenErneuern(entschluesseln(verbindung.refresh_token));
    const neuerAblauf = new Date(Date.now() + antwort.expires_in * 1000).toISOString();
    await supabase
      .from("kalender_verbindung")
      .update({ access_token: verschluesseln(antwort.access_token), access_token_ablauf: neuerAblauf })
      .eq("user_id", verbindung.user_id);
    return antwort.access_token;
  } catch (err) {
    // Nutzer hat den Zugriff in seinem Google-Konto entzogen: Verbindung aufräumen.
    if (err instanceof GoogleFehler && err.code === "invalid_grant") {
      await supabase.from("kalender_eintrag").delete().eq("user_id", verbindung.user_id);
      await supabase.from("kalender_verbindung").delete().eq("user_id", verbindung.user_id);
      throw new VerbindungUngueltig("Die Google-Verbindung wurde widerrufen.");
    }
    throw err;
  }
}
