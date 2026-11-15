import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Signierter Link zum Profilbild (privater Bucket), gültig für eine Stunde. */
export async function profilbildUrl(supabase: Supabase, pfad: string | null | undefined): Promise<string | null> {
  if (!pfad) return null;
  const { data } = await supabase.storage.from("profilbild").createSignedUrl(pfad, 3600);
  return data?.signedUrl ?? null;
}
