import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { anzahlFaellig } from "@/lib/karteikarten/leitner";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { StapelUebersicht, type StapelKachel } from "@/components/karteikarten/stapel-uebersicht";

export const metadata = { title: "Karteikarten · UniWars" };

export default async function KarteikartenSeite() {
  const supabase = await createClient();
  const [{ data: stapel, error }, { data: karten }, { data: faecher }] = await Promise.all([
    supabase.from("kk_stapel").select("*").order("geaendert_am", { ascending: false }),
    supabase.from("kk_karte").select("stapel_id, naechste_abfrage"),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Karteikarten" />
        <EinrichtungHinweis hub="Karteikarten" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  const kacheln: StapelKachel[] = (stapel ?? []).map((s) => {
    const eigene = (karten ?? []).filter((k) => k.stapel_id === s.id);
    return { ...s, anzahl: eigene.length, faellig: anzahlFaellig(eigene) };
  });

  return (
    <Suspense fallback={null}>
      <StapelUebersicht stapel={kacheln} faecher={faecher ?? []} />
    </Suspense>
  );
}
