import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { PraesentationsListe } from "@/components/praesentationen/praesentations-liste";

export const metadata = { title: "Präsentationen · UniWars" };

export default async function PraesentationenSeite() {
  const supabase = await createClient();
  const [{ data: liste, error }, { data: faecher }] = await Promise.all([
    supabase.from("praesentation").select("id, titel, fach_id, geaendert_am, folien").order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Präsentationen" />
        <EinrichtungHinweis hub="Präsentationen" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  const eintraege = (liste ?? []).map(({ folien, ...p }) => {
    const anzahl = Array.isArray(folien) ? folien.length : 0;
    return { ...p, info: `${anzahl} ${anzahl === 1 ? "Folie" : "Folien"}` };
  });

  return (
    <Suspense fallback={null}>
      <PraesentationsListe eintraege={eintraege} faecher={faecher ?? []} />
    </Suspense>
  );
}
