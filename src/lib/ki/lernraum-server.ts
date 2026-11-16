// Lernraum: Quellen eines Fachs laden (server-only, mit dem Supabase-Client des Nutzers → RLS).
import "server-only";
import type { Supabase } from "@/lib/ki/server";
import { notizAbschnitte, type LernQuelle } from "@/lib/ki/lernraum";

export type QuellenEintrag = {
  art: "pdf" | "notiz";
  id: string;
  titel: string;
  /** aus dem Fach (automatisch) oder fachfremd dazugenommen */
  herkunft: "fach" | "extra";
  aktiv: boolean;
  /** PDFs: Anzahl eingelesener Seiten (0 = noch nicht eingelesen) */
  seiten: number;
  geaendertAm: string;
};

/** Lernraum zum Fach holen oder anlegen */
export async function lernraumSichern(supabase: Supabase, userId: string, fachId: string): Promise<string> {
  const { data: vorhanden } = await supabase.from("lernraum").select("id").eq("fach_id", fachId).maybeSingle();
  if (vorhanden) return vorhanden.id;
  const { data, error } = await supabase.from("lernraum").upsert({ user_id: userId, fach_id: fachId }, { onConflict: "user_id,fach_id" }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** Alle Quellen eines Lernraums mit Status (für die Seitenleiste) */
export async function quellenListe(supabase: Supabase, lernraumId: string, fachId: string): Promise<QuellenEintrag[]> {
  const [{ data: pdfs }, { data: notizen }, { data: abweichungen }] = await Promise.all([
    supabase.from("datei").select("id, name, geaendert_am").eq("fach_id", fachId).eq("mime_typ", "application/pdf"),
    supabase.from("notiz").select("id, titel, geaendert_am").eq("fach_id", fachId),
    supabase.from("lernraum_quelle").select("datei_id, notiz_id, status").eq("lernraum_id", lernraumId),
  ]);
  const aus = new Set((abweichungen ?? []).filter((a) => a.status === "aus").map((a) => a.datei_id ?? a.notiz_id));
  const extraPdfIds = (abweichungen ?? []).filter((a) => a.status === "extra" && a.datei_id).map((a) => a.datei_id!);
  const extraNotizIds = (abweichungen ?? []).filter((a) => a.status === "extra" && a.notiz_id).map((a) => a.notiz_id!);
  const [{ data: extraPdfs }, { data: extraNotizen }] = await Promise.all([
    extraPdfIds.length
      ? supabase.from("datei").select("id, name, geaendert_am").in("id", extraPdfIds)
      : Promise.resolve({ data: [] as { id: string; name: string; geaendert_am: string }[] }),
    extraNotizIds.length
      ? supabase.from("notiz").select("id, titel, geaendert_am").in("id", extraNotizIds)
      : Promise.resolve({ data: [] as { id: string; titel: string; geaendert_am: string }[] }),
  ]);

  const allePdfs = [...(pdfs ?? []).map((p) => ({ ...p, herkunft: "fach" as const })), ...(extraPdfs ?? []).map((p) => ({ ...p, herkunft: "extra" as const }))];
  const pdfIds = allePdfs.map((p) => p.id);
  const seitenZahl = new Map<string, number>();
  if (pdfIds.length) {
    const { data: seiten } = await supabase.from("quelle_seite").select("datei_id").in("datei_id", pdfIds);
    for (const s of seiten ?? []) seitenZahl.set(s.datei_id, (seitenZahl.get(s.datei_id) ?? 0) + 1);
  }

  return [
    ...allePdfs.map((p) => ({
      art: "pdf" as const,
      id: p.id,
      titel: p.name,
      herkunft: p.herkunft,
      aktiv: !aus.has(p.id),
      seiten: seitenZahl.get(p.id) ?? 0,
      geaendertAm: p.geaendert_am,
    })),
    ...[...(notizen ?? []).map((n) => ({ ...n, herkunft: "fach" as const })), ...(extraNotizen ?? []).map((n) => ({ ...n, herkunft: "extra" as const }))].map((n) => ({
      art: "notiz" as const,
      id: n.id,
      titel: n.titel || "Unbenannte Notiz",
      herkunft: n.herkunft,
      aktiv: !aus.has(n.id),
      seiten: 0,
      geaendertAm: n.geaendert_am,
    })),
  ];
}

/** Texte der aktiven Quellen (nummeriert Q1, Q2 … in fester Reihenfolge) */
export async function quellenTexte(supabase: Supabase, liste: QuellenEintrag[]): Promise<LernQuelle[]> {
  const aktiv = liste.filter((q) => q.aktiv);
  const pdfIds = aktiv.filter((q) => q.art === "pdf").map((q) => q.id);
  const notizIds = aktiv.filter((q) => q.art === "notiz").map((q) => q.id);
  const [{ data: seiten }, { data: notizen }] = await Promise.all([
    pdfIds.length
      ? supabase.from("quelle_seite").select("datei_id, seite, text").in("datei_id", pdfIds).order("seite")
      : Promise.resolve({ data: [] as { datei_id: string; seite: number; text: string }[] }),
    notizIds.length ? supabase.from("notiz").select("id, inhalt").in("id", notizIds) : Promise.resolve({ data: [] as { id: string; inhalt: string }[] }),
  ]);
  return aktiv.map((q, i) => ({
    nr: i + 1,
    art: q.art,
    id: q.id,
    titel: q.titel,
    abschnitte:
      q.art === "pdf"
        ? (seiten ?? []).filter((s) => s.datei_id === q.id).map((s) => ({ seite: s.seite, text: s.text }))
        : notizAbschnitte((notizen ?? []).find((n) => n.id === q.id)?.inhalt ?? ""),
  }));
}
