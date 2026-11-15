import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";
import { PdfListe, type PdfEintrag } from "@/components/pdf-reader/pdf-liste";

export const metadata = { title: "PDF Reader · UniWars" };

/** PDF-01: Liste aller PDFs aus der Dateiablage. */
export default async function PdfReaderSeite() {
  const supabase = await createClient();
  const [{ data: pdfs, error }, { data: staende }, { data: faecher }, { data: ordner }] = await Promise.all([
    supabase
      .from("datei")
      .select("id, name, groesse, fach_id, pdf_ordner_id, erstellt_am")
      .eq("mime_typ", "application/pdf")
      .order("erstellt_am", { ascending: false }),
    supabase.from("pdf_stand").select("datei_id, letzte_seite, geaendert_am"),
    supabase.from("fach").select("id, name, farbe"),
    // Fehlt die Tabelle noch, gibt es eben (noch) keine Ordner
    supabase.from("pdf_ordner").select("id, name"),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="PDF Reader" />
        <EinrichtungHinweis hub="Der PDF Reader" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  const stand = new Map((staende ?? []).map((s) => [s.datei_id, s]));
  const liste = [...(pdfs ?? [])].sort((a, b) =>
    (stand.get(b.id)?.geaendert_am ?? b.erstellt_am).localeCompare(stand.get(a.id)?.geaendert_am ?? a.erstellt_am),
  );

  const eintraege: PdfEintrag[] = liste.map((d) => {
    const fach = (faecher ?? []).find((f) => f.id === d.fach_id);
    return {
      id: d.id,
      name: d.name,
      groesse: Number(d.groesse),
      ordnerId: d.pdf_ordner_id,
      fach: fach ? { name: fach.name, farbe: fach.farbe } : null,
      letzteSeite: stand.get(d.id)?.letzte_seite ?? null,
    };
  });

  return (
    <>
      <HubKopf
        titel="PDF Reader"
        untertitel="Skripte und Folien direkt in UniWars lesen und in Ordnern sortieren. Neue PDFs lädst du über die Dateiablage hoch."
        aktionen={
          <Link href="/dateiablage" className="btng">
            Zur Dateiablage
          </Link>
        }
      />
      {liste.length === 0 ? (
        <LeererZustand
          icon="📕"
          text="Noch keine PDFs. Lade ein Skript in der Dateiablage hoch – danach kannst du es hier lesen."
          aktion={
            <Link href="/dateiablage" className="btnp hub-leer-knopf">
              ⤒ PDF hochladen
            </Link>
          }
        />
      ) : (
        <Suspense fallback={null}>
          <PdfListe startPdfs={eintraege} startOrdner={ordner ?? []} />
        </Suspense>
      )}
    </>
  );
}
