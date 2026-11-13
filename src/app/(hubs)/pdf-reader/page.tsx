import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { groesseText } from "@/lib/dateiablage/dateien";
import { EinrichtungHinweis, HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";

export const metadata = { title: "PDF Reader · UniWars" };

/** PDF-01: Liste aller PDFs aus der Dateiablage. */
export default async function PdfReaderSeite() {
  const supabase = await createClient();
  const [{ data: pdfs, error }, { data: staende }, { data: faecher }] = await Promise.all([
    supabase.from("datei").select("id, name, groesse, fach_id, erstellt_am").eq("mime_typ", "application/pdf").order("erstellt_am", { ascending: false }),
    supabase.from("pdf_stand").select("datei_id, letzte_seite, geaendert_am"),
    supabase.from("fach").select("id, name, farbe"),
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

  return (
    <>
      <HubKopf
        titel="PDF Reader"
        untertitel="Skripte und Folien direkt in UniWars lesen. Neue PDFs lädst du über die Dateiablage hoch."
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
        <section className="card">
          <ul className="pdf-liste">
            {liste.map((d) => {
              const fach = (faecher ?? []).find((f) => f.id === d.fach_id);
              const s = stand.get(d.id);
              return (
                <li key={d.id}>
                  <Link href={`/pdf-reader/${d.id}`} className="pdf-liste-zeile">
                    <span aria-hidden>📕</span>
                    <span className="pdf-liste-name">{d.name}</span>
                    <span className="muted pdf-liste-fach">
                      {fach ? (
                        <>
                          <span className="dot" style={{ background: fach.farbe ?? "#94a3b8" }} /> {fach.name}
                        </>
                      ) : (
                        "Allgemein"
                      )}
                    </span>
                    <span className="faint mono">{groesseText(Number(d.groesse))}</span>
                    {s && <span className="tag tag-accent">weiter bei S. {s.letzte_seite}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
