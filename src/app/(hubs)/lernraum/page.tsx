import type { CSSProperties } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { Icon } from "@/components/nav-icon";
import { Einrichtung, Zustand } from "@/components/zustand";
import { PfeilText } from "@/components/bewegung/pfeil-text";
import { Bereichskopf } from "@/components/hubs/bereichskopf";

export const metadata = { title: "Lernraum · UniVerse" };

/** Lernraum: ein Raum pro Fach – Quellen sind die PDFs und Notizen des Fachs. */
export default async function LernraumUebersicht() {
  const supabase = await createClient();
  const [{ data: faecher, error: fachFehler }, { data: pdfs }, { data: notizen }, { data: raeume, error }] = await Promise.all([
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("datei").select("fach_id").eq("mime_typ", "application/pdf"),
    supabase.from("notiz").select("fach_id"),
    supabase.from("lernraum").select("fach_id, geaendert_am"),
  ]);
  if (tabelleFehlt(error)) return <Einrichtung bereich="Der Lernraum" />;
  if (error || fachFehler) throw new Error((error ?? fachFehler)?.message);
  const zaehlen = (liste: { fach_id: string | null }[] | null, id: string) => (liste ?? []).filter((x) => x.fach_id === id).length;
  const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

  return (
    <>
      <Bereichskopf
        titel="Lernraum"
        zahl={(faecher ?? []).length || undefined}
        einheit={(faecher ?? []).length === 1 ? "Raum, einer pro Fach" : "Räume, einer pro Fach"}
        untertitel="Studio antwortet aus deinen Skripten und Notizen, belegt jede Aussage und baut dir Lernzettel, Quiz und Karteikarten."
      />
      {(faecher ?? []).length === 0 ? (
        <Zustand
          art="leer"
          icon="lernraum"
          titel="Noch keine Fächer."
          aktion={
            <Link href="/faecher" className="knopf neben klein">
              <Icon name="plus" groesse={16} />
              Fach anlegen
            </Link>
          }
        >
          Jedes Fach bekommt automatisch einen Lernraum mit seinen PDFs und Notizen als Quellen.
        </Zustand>
      ) : (
        <ul className="entry-list">
          {(faecher ?? []).map((f) => {
            const zuletzt = (raeume ?? []).find((r) => r.fach_id === f.id)?.geaendert_am;
            return (
              <li key={f.id} className="entry-row fach-zeile">
                <span className="fach-farbe" style={{ "--c": f.farbe ?? "var(--text-3)" } as CSSProperties} aria-hidden />
                <div className="entry-info">
                  <Link href={`/lernraum/${f.id}`} className="entry-title kk-name">
                    {f.name}
                  </Link>
                  <span className="entry-meta">
                    {mehrzahl(zaehlen(pdfs, f.id), "PDF", "PDFs")}, {mehrzahl(zaehlen(notizen, f.id), "Notiz", "Notizen")},{" "}
                    {zuletzt ? `zuletzt am ${new Date(zuletzt).toLocaleDateString("de-DE")}` : "noch nicht geöffnet"}
                  </span>
                </div>
                <Link href={`/lernraum/${f.id}`} className="knopf neben klein">
                  <PfeilText>Öffnen</PfeilText>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
