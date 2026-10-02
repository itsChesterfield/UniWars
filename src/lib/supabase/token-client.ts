import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Für Arbeit nach der Antwort (after()), wo keine Cookies mehr gelesen werden dürfen:
// gleiche RLS-Rechte wie der Nutzer, über dessen Access-Token.
export function createClientMitToken(accessToken: string) {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export type TokenClient = ReturnType<typeof createClientMitToken>;
