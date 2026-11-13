import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { TabellenListe } from "@/components/tabellen/tabellen-liste";

export const metadata = { title: "Tabellen · UniWars" };

export default async function TabellenSeite() {
  const supabase = await createClient();
  const [{ data: tabellen, error }, { data: faecher }] = await Promise.all([
    supabase.from("tabelle").select("id, titel, fach_id, geaendert_am").order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Tabellen" />
        <EinrichtungHinweis hub="Tabellen" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  return (
    <Suspense fallback={null}>
      <TabellenListe tabellen={tabellen ?? []} faecher={faecher ?? []} />
    </Suspense>
  );
}
