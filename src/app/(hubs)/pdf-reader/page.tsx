import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { PdfListe, type PdfEintrag, type PdfFach } from "@/components/pdf-reader/pdf-liste";
import { PfeilText } from "@/components/bewegung/pfeil-text";

export const metadata = { title: "PDF Reader · UniVerse" };

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
    supabase.from("fach").select("id, name, farbe, aktiv").order("erstellt_am", { ascending: true }),
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

  const eintraege: PdfEintrag[] = liste.map((d) => ({
    id: d.id,
    name: d.name,
    groesse: Number(d.groesse),
    fachId: d.fach_id,
    ordnerId: d.pdf_ordner_id,
    letzteSeite: stand.get(d.id)?.letzte_seite ?? null,
  }));
  // Jedes aktive Fach ist ein Ordner – archivierte nur, solange noch PDFs darin liegen
  const fachOrdner: PdfFach[] = (faecher ?? [])
    .filter((f) => f.aktiv || eintraege.some((e) => e.fachId === f.id))
    .map((f) => ({ id: f.id, name: f.name, farbe: f.farbe }));

  return (
    <>
      <header className="seitenkopf">
        <div>
          <h1>PDF Reader</h1>
          <p>Skripte und Folien lesen und in Ordnern sortieren. PDFs einfach vom Computer hierher ziehen.</p>
        </div>
        <div className="rechts">
          <Link href="/dateiablage" className="knopf leise">
            <PfeilText>Zur Dateiablage</PfeilText>
          </Link>
        </div>
      </header>
      <Suspense fallback={null}>
        <PdfListe startPdfs={eintraege} startOrdner={ordner ?? []} faecher={fachOrdner} />
      </Suspense>
    </>
  );
}
