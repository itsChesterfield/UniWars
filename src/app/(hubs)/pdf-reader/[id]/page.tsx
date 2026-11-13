import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { PdfReader } from "@/components/pdf-reader/pdf-reader";
import { alsRechtecke, istFarbe } from "@/lib/pdf-reader/markierungen";
import { kiKonfiguriert } from "@/lib/ki/anbieter";

export default async function PdfAnsehenSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: datei, error }, { data: stand }, { data: markierungen }] = await Promise.all([
    supabase.from("datei").select("id, name, mime_typ, speicher_pfad").eq("id", id).maybeSingle(),
    supabase.from("pdf_stand").select("letzte_seite, lesezeichen").eq("datei_id", id).maybeSingle(),
    // Fehlt die Tabelle noch, bleibt die Liste einfach leer
    supabase.from("pdf_markierung").select("id, seite, farbe, rechtecke, text, notiz").eq("datei_id", id).order("seite").order("erstellt_am"),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="PDF Reader" />
        <EinrichtungHinweis hub="Der PDF Reader" />
      </>
    );
  }
  if (error?.code === "22P02") notFound();
  if (error) throw new Error(error.message);
  if (!datei || datei.mime_typ !== "application/pdf") notFound();

  const { data: link, error: linkFehler } = await supabase.storage.from("dateiablage").createSignedUrl(datei.speicher_pfad, 3600);
  if (linkFehler) throw new Error(linkFehler.message);

  return (
    <PdfReader
      key={datei.id}
      datei={{ id: datei.id, name: datei.name }}
      url={link.signedUrl}
      startSeite={stand?.letzte_seite ?? 1}
      startLesezeichen={stand?.lesezeichen ?? []}
      kiVerfuegbar={kiKonfiguriert()}
      startMarkierungen={(markierungen ?? []).map((m) => ({
        ...m,
        farbe: istFarbe(m.farbe) ? m.farbe : "GELB",
        rechtecke: alsRechtecke(m.rechtecke),
      }))}
    />
  );
}
