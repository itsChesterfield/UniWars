import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type TeamUpdate = Omit<Database["public"]["Tables"]["team_update"]["Row"], "merge_sha">;

export const teamUpdateZugriff = cache(async () => {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client.from("team_update_mitglied")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  return data ? client : null;
});

export async function teamUpdatesLaden(client: NonNullable<Awaited<ReturnType<typeof teamUpdateZugriff>>>, nurUngelesen: boolean, vor?: string) {
  let abfrage = client.from("team_update").select("pr, titel, punkte, aktualisiert_am, aktiv, team_update_gelesen(pr)")
    .order("aktualisiert_am", { ascending: false }).order("pr", { ascending: false }).limit(21);
  if (nurUngelesen) abfrage = abfrage.eq("aktiv", true).is("team_update_gelesen", null);
  if (vor) {
    const [datum, pr] = vor.split("/");
    abfrage = abfrage.or(`aktualisiert_am.lt.${datum},and(aktualisiert_am.eq.${datum},pr.lt.${pr})`);
  }
  const { data, error } = await abfrage;
  if (error) throw new Error("Team-Updates konnten nicht geladen werden.");
  const updates = data.slice(0, 20).map((update) => ({
    pr: update.pr,
    titel: update.titel,
    punkte: update.punkte,
    aktualisiert_am: update.aktualisiert_am,
    aktiv: update.aktiv,
  }));
  const letzter = updates.at(-1);
  return {
    updates,
    weiter: data.length > 20 && letzter ? `${letzter.aktualisiert_am}/${letzter.pr}` : null,
  };
}
