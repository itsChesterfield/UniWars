import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { Einrichtung } from "@/components/zustand";
import { Literaturverwaltung } from "@/components/literatur/literaturverwaltung";
import { kiKonfiguriert } from "@/lib/ki/anbieter";

export const metadata = { title: "Literaturverwaltung · UniVerse" };

export default async function LiteraturSeite() {
  const supabase = await createClient();
  const [{ data: quellen, error }, { data: faecher }, { data: pdfs }] = await Promise.all([
    supabase.from("literatur_quelle").select("*").order("geaendert_am", { ascending: false }),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("datei").select("id, name").eq("mime_typ", "application/pdf").order("name", { ascending: true }),
  ]);

  if (tabelleFehlt(error)) {
    return <Einrichtung bereich="Die Literaturverwaltung" />;
  }
  if (error) throw new Error(error.message);

  return (
    <Suspense fallback={null}>
      <Literaturverwaltung initialQuellen={quellen ?? []} faecher={faecher ?? []} pdfs={pdfs ?? []} kiVerfuegbar={kiKonfiguriert()} />
    </Suspense>
  );
}
