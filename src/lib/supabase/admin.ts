import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Supabase mit Secret Key (umgeht RLS) – nur für Schreibvorgänge, die Nutzer nicht selbst
 * auslösen dürfen, z. B. „Uni-Mail bestätigt“. Nie im Browser verwenden.
 */
export function adminKonfiguriert(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function adminClient() {
  if (!adminKonfiguriert()) throw new Error("SUPABASE_SECRET_KEY fehlt");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
