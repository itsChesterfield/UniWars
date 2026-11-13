import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { DokumentListe } from "@/components/textverarbeitung/dokument-liste";

export const metadata = { title: "Textverarbeitung · UniWars" };

export default async function TextverarbeitungSeite() {
  const supabase = await createClient();
  const [{ data: dokumente, error }, { data: faecher }] = await Promise.all([
    supabase.from("dokument").select("id, titel, fach_id, woerter, geaendert_am").order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Textverarbeitung" />
        <EinrichtungHinweis hub="Die Textverarbeitung" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  return (
    <Suspense fallback={null}>
      <DokumentListe dokumente={dokumente ?? []} faecher={faecher ?? []} />
    </Suspense>
  );
}
