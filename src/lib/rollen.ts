import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminErfordern, rollenAusZeilen, type Rolle } from "@/lib/rollen-kern";

export type { Rolle };

/**
 * Rolle des angemeldeten Nutzers.
 * Ohne vorherigen getUser()-Aufruf: Die Datenbank prüft das JWT selbst, auth.uid() ist
 * ohne Anmeldung null und die Funktion liefert dann 'user'. Bei einem Fehler ebenfalls 'user'.
 * React cache() gilt nur für die Dauer eines Requests.
 */
export const aktuelleRolle = cache(async (): Promise<Rolle> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aktuelle_rolle");
  if (error || !data) return "user";
  return data as Rolle;
});

/** Rollen vieler Nutzer mit einer einzigen Abfrage; fehlende IDs bekommen 'user'. */
export async function rollenVon(
  userIds: string[],
  supabase?: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, Rolle>> {
  if (userIds.length === 0) return new Map();
  const client = supabase ?? (await createClient());
  const { data } = await client.from("user_roles").select("user_id, role").in("user_id", userIds);
  return rollenAusZeilen((data ?? []) as { user_id: string; role: Rolle }[], userIds);
}

/**
 * Angemeldeter Nutzer, geprüft über getUser() (nie getSession()).
 * cache(): Layout und Seite unter /admin teilen sich innerhalb eines Requests einen Aufruf.
 */
const angemeldeterNutzer = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Guard für Admin-Seiten: leitet um statt zu werfen. */
export async function requireAdmin(): Promise<{ userId: string }> {
  const user = await angemeldeterNutzer();
  if (!user) redirect("/login");
  const rolle = await aktuelleRolle();
  if (rolle !== "admin") redirect("/");
  return { userId: user.id };
}

/** Guard für Server Actions und Route Handler: wirft, leitet nicht um. */
export async function requireAdminAction(): Promise<{ userId: string }> {
  const user = await angemeldeterNutzer();
  const rolle = user ? await aktuelleRolle() : null;
  return adminErfordern(rolle, user?.id ?? null);
}
