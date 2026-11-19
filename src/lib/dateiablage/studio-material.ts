import "server-only";

import type { Supabase } from "@/lib/ki/server";
import type { LernQuelle } from "@/lib/ki/lernraum";
import { berlinDatum } from "@/lib/zeit";
import { fachZuordnungen, materialRef, type MaterialRef } from "./material";
import { hubMaterialLaden, materialQuelle } from "./material-server";
import { aktuelleMaterialfolge, fachAusStofffrage } from "./aktueller-stoff";
import { pdfTextFuerStudio } from "@/lib/pdf-reader/index-server";

const key = (r: MaterialRef) => `${r.art}:${r.id}`;

export async function materialFuerStudio(supabase: Supabase, refs: MaterialRef[]) {
  const gelesen = await Promise.all(refs.map((ref) => materialQuelle(supabase, ref, Math.min(100, Math.ceil(240 / refs.length)))));
  const quellen: LernQuelle[] = [];
  const fehlend: string[] = [];
  let pdfLeseproben = 0;
  for (const q of gelesen) {
    if (!q) continue;
    let abschnitte = q.abschnitte.filter((teil) => teil.text.trim());
    if (!abschnitte.length && q.istPdf && pdfLeseproben < 2) {
      pdfLeseproben++;
      abschnitte = await pdfTextFuerStudio(supabase, q.id).catch(() => []);
    }
    if (!abschnitte.length) { fehlend.push(q.titel); continue; }
    quellen.push({ nr: quellen.length + 1, art: q.istPdf ? "pdf" : "notiz", id: q.id, titel: q.titel, href: q.href, materialArt: q.art, abschnitte });
  }
  return { quellen, fehlend, bevorzugt: quellen.map((q) => ({ quelle: q.nr, seiten: [q.abschnitte[0].seite] })) };
}

export async function crashkursFach(supabase: Supabase, frage: string, ausgewaehlt?: string | null, offenesFach?: string | null) {
  const { data } = await supabase.from("fach").select("id, name");
  const faecher = data ?? [];
  return faecher.find((f) => f.id === ausgewaehlt)
    ?? fachAusStofffrage(frage, faecher)
    ?? faecher.find((f) => f.id === offenesFach)
    ?? null;
}

export async function crashkursMaterial(supabase: Supabase, fachId: string, jetzt: Date) {
  const [{ data: vorlesungen }, { data: dateien }, material, { data: zuordnungen }] = await Promise.all([
    supabase.from("stundenplan_eintrag").select("id").eq("fach_id", fachId),
    supabase.from("datei").select("id, fach_id, erstellt_am"),
    hubMaterialLaden(supabase),
    supabase.from("material_ablage_fach").select("art, material_id, fach_id, ausgeblendet").eq("fach_id", fachId),
  ]);
  const werte = [
    ...(dateien ?? []).map((d) => ({ ref: { art: "datei" as const, id: d.id }, fachId: d.fach_id, zeit: d.erstellt_am })),
    ...material.map((m) => ({ ref: { art: m.art, id: m.id }, fachId: m.fachId, zeit: m.erstelltAm })),
  ];
  const fachMaterial = werte.filter((m) => fachZuordnungen(m.fachId, (zuordnungen ?? []).filter((z) => z.art === m.ref.art && z.material_id === m.ref.id)).includes(fachId));
  const bekannt = new Set(werte.map((v) => key(v.ref)));
  const ids = (vorlesungen ?? []).map((v) => v.id);
  const [termine, mitschriften] = ids.length ? await Promise.all([
    supabase.from("material_verknuepfung").select("art, material_id, termin_datum").eq("ziel_art", "vorlesung").in("ziel_id", ids).order("termin_datum", { ascending: false }).limit(150),
    supabase.from("notiz").select("id, vorlesung_datum").in("stundenplan_eintrag_id", ids).order("vorlesung_datum", { ascending: false }).limit(100),
  ]) : [{ data: [] }, { data: [] }];
  const explizit = (termine.data ?? []).flatMap((t) => {
    const ref = materialRef({ art: t.art, id: t.material_id });
    return ref && t.termin_datum && bekannt.has(key(ref)) ? [{ datum: t.termin_datum, material: ref }] : [];
  });
  return aktuelleMaterialfolge(
    [...explizit, ...(mitschriften.data ?? []).flatMap((n) => n.vorlesung_datum ? [{ datum: n.vorlesung_datum, material: { art: "notiz" as const, id: n.id } }] : [])],
    fachMaterial.map((m) => ({ zeit: m.zeit, material: m.ref })), berlinDatum(jetzt), key,
  );
}
