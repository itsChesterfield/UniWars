"use server";

import { createClient } from "@/lib/supabase/server";

/** PDF-04 / PDF-05: Lesezeichen und zuletzt gelesene Seite merken. */
export async function pdfStandSpeichern(dateiId: string, stand: { letzteSeite?: number; lesezeichen?: number[] }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const zeile: { datei_id: string; user_id: string; letzte_seite?: number; lesezeichen?: number[] } = {
    datei_id: dateiId,
    user_id: user.id,
  };
  if (stand.letzteSeite !== undefined) zeile.letzte_seite = Math.max(1, Math.floor(stand.letzteSeite));
  if (stand.lesezeichen !== undefined) {
    zeile.lesezeichen = [...new Set(stand.lesezeichen.map((s) => Math.floor(s)).filter((s) => s >= 1))].sort((a, b) => a - b).slice(0, 500);
  }
  const { error } = await supabase.from("pdf_stand").upsert(zeile, { onConflict: "datei_id" });
  if (error) throw new Error(error.message);
}
