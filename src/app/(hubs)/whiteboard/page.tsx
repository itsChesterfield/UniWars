import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { WhiteboardListe } from "@/components/whiteboard/whiteboard-liste";

export const metadata = { title: "Whiteboard · UniWars" };

export default async function WhiteboardSeite() {
  const supabase = await createClient();
  const [{ data: liste, error }, { data: faecher }] = await Promise.all([
    supabase.from("whiteboard").select("id, name, fach_id, geaendert_am").order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Whiteboard" />
        <EinrichtungHinweis hub="Das Whiteboard" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  return (
    <Suspense fallback={null}>
      <WhiteboardListe eintraege={(liste ?? []).map(({ name, ...w }) => ({ ...w, titel: name }))} faecher={faecher ?? []} />
    </Suspense>
  );
}
