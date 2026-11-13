import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { Literaturverwaltung } from "@/components/literatur/literaturverwaltung";

export const metadata = { title: "Literaturverwaltung · UniWars" };

export default async function LiteraturSeite() {
  const supabase = await createClient();
  const [{ data: quellen, error }, { data: faecher }, { data: pdfs }] = await Promise.all([
    supabase.from("quelle").select("*").order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("datei").select("id, name").eq("mime_typ", "application/pdf").order("name", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Literaturverwaltung" />
        <EinrichtungHinweis hub="Die Literaturverwaltung" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  return (
    <Suspense fallback={null}>
      <Literaturverwaltung initialQuellen={quellen ?? []} faecher={faecher ?? []} pdfs={pdfs ?? []} />
    </Suspense>
  );
}
