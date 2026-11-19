import { Suspense } from "react";
import { hubFachzuordnungen } from "@/lib/dateiablage/material";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { Einrichtung } from "@/components/zustand";
import { WhiteboardListe } from "@/components/whiteboard/whiteboard-liste";

export const metadata = { title: "Whiteboard · UniVerse" };

export default async function WhiteboardSeite() {
  const supabase = await createClient();
  const [{ data: liste, error }, { data: faecher }, { data: zuordnungen }] = await Promise.all([
    supabase.from("whiteboard").select("id, name, fach_id, geaendert_am").order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("material_ablage_fach").select("art, material_id, fach_id, ausgeblendet").eq("art", "whiteboard"),
  ]);

  if (tabelleFehlt(error)) {
    return <Einrichtung bereich="Das Whiteboard" />;
  }
  if (error) throw new Error(error.message);

  return (
    <Suspense fallback={null}>
      <WhiteboardListe eintraege={hubFachzuordnungen(liste ?? [], zuordnungen ?? []).map(({ name, ...w }) => ({ ...w, titel: name }))} faecher={faecher ?? []} />
    </Suspense>
  );
}
