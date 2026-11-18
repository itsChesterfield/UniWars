import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminErfordern, rollenAusZeilen, type Rolle } from "@/lib/rollen-kern";

export type { Rolle };

/**
 * Rolle des angemeldeten Nutzers (Paket 1, Plan Abschnitt 1.3).
 * Ohne angemeldeten Nutzer null. React cache() gilt nur für die Dauer eines Requests.
 */
export const aktuelleRolle = cache(async (): Promise<Rolle | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("aktuelle_rolle");
  return (data as Rolle) ?? "user";
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

/** Guard für Admin-Seiten: leitet um statt zu werfen. */
export async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const rolle = await aktuelleRolle();
  if (rolle !== "admin") redirect("/");
  return { userId: user.id };
}

/** Guard für Server Actions und Route Handler: wirft, leitet nicht um. */
export async function requireAdminAction(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const rolle = user ? await aktuelleRolle() : null;
  return adminErfordern(rolle, user?.id ?? null);
}
