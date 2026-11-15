import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { anzahlFaellig } from "@/lib/karteikarten/wiederholung";
import { vorschlaegeBerechnen } from "@/lib/karteikarten/vorschlaege";
import { berlinDatum, berlinUhrzeit, berlinWochentag } from "@/lib/zeit";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { StapelUebersicht, type StapelKachel } from "@/components/karteikarten/stapel-uebersicht";

export const metadata = { title: "Karteikarten · UniWars" };

export default async function KarteikartenSeite() {
  const supabase = await createClient();
  const [{ data: stapel, error }, { data: karten }, { data: faecher }, { data: pruefungen }, { data: vorlesungen }] = await Promise.all([
    supabase.from("kk_stapel").select("*").order("geaendert_am", { ascending: false }),
    supabase.from("kk_karte").select("stapel_id, naechste_abfrage"),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("pruefung").select("fach_id, datum, titel").eq("status", "ANSTEHEND"),
    supabase.from("stundenplan_eintrag").select("fach_id, tag, start_zeit"),
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

  // Vorschläge: fällige Wiederholungen + bevorstehende Prüfungen/Vorlesungen der Fächer
  const jetzt = new Date();
  const vorschlaege = vorschlaegeBerechnen(
    kacheln,
    (pruefungen ?? []).map((p) => ({ ...p, datum: berlinDatum(new Date(p.datum)) })),
    vorlesungen ?? [],
    { datum: berlinDatum(jetzt), tag: berlinWochentag(jetzt), uhr: berlinUhrzeit(jetzt) },
  ).map((v) => ({ stapelId: v.stapel.id, gruende: v.gruende }));

  return (
    <Suspense fallback={null}>
      <StapelUebersicht stapel={kacheln} faecher={faecher ?? []} vorschlaege={vorschlaege} />
    </Suspense>
  );
}
