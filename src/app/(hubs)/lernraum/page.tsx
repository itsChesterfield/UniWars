import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { EinrichtungHinweis, HubKopf, LeererZustand } from "@/components/hubs/hub-bausteine";

export const metadata = { title: "Lernraum · UniVerse" };

/** Lernraum: ein Raum pro Fach – Quellen sind die PDFs und Notizen des Fachs. */
export default async function LernraumUebersicht() {
  const supabase = await createClient();
  const [{ data: faecher }, { data: pdfs }, { data: notizen }, { data: raeume, error }] = await Promise.all([
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("datei").select("fach_id").eq("mime_typ", "application/pdf"),
    supabase.from("notiz").select("fach_id"),
    supabase.from("lernraum").select("fach_id, geaendert_am"),
  ]);
  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Lernraum" />
        <EinrichtungHinweis hub="Der Lernraum" />
      </>
    );
  }
  const zaehlen = (liste: { fach_id: string | null }[] | null, id: string) => (liste ?? []).filter((x) => x.fach_id === id).length;

  return (
    <>
      <HubKopf
        titel="Lernraum"
        untertitel="Wie NotebookLM: Pro Fach eine KI, die aus deinen Skripten und Notizen antwortet, jede Aussage belegt und dir Lernzettel, Quiz und Karteikarten baut."
      />
      {(faecher ?? []).length === 0 ? (
        <LeererZustand icon="🎓" text="Leg zuerst ein Fach an – jedes Fach bekommt automatisch einen Lernraum." aktion={<Link href="/faecher" className="btnp hub-leer-knopf">Fächer verwalten</Link>} />
      ) : (
        <div className="lr-raster">
          {(faecher ?? []).map((f) => {
            const p = zaehlen(pdfs, f.id);
            const n = zaehlen(notizen, f.id);
            const zuletzt = (raeume ?? []).find((r) => r.fach_id === f.id)?.geaendert_am;
            return (
              <Link key={f.id} href={`/lernraum/${f.id}`} className="card lr-kachel" style={{ borderTopColor: f.farbe ?? undefined }}>
                <span className="lr-kachel-name">
                  <span className="dot" style={{ background: f.farbe ?? "#94a3b8" }} /> {f.name}
                </span>
                <span className="muted">
                  {p} {p === 1 ? "PDF" : "PDFs"} · {n} {n === 1 ? "Notiz" : "Notizen"}
                </span>
                <span className="faint lr-klein">{zuletzt ? `Zuletzt: ${new Date(zuletzt).toLocaleDateString("de-DE")}` : "Noch nicht geöffnet"}</span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
