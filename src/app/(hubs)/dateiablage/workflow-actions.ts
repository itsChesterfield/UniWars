"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { istMaterialId, materialRef, materialRefs, materialZiel, type MaterialRef, type MaterialZiel } from "@/lib/dateiablage/material";
import { materialQuelle } from "@/lib/dateiablage/material-server";
import { alsFehler, textAnfrageAusfuehren, textVoraussetzungen } from "@/lib/ki/server";
import type { KiErgebnis } from "@/lib/ki/ergebnis";
import { KiEingabe } from "@/lib/ki/fehler";
import { alsObjekt, jsonLesen, text } from "@/lib/ki/json";
import { einbetten } from "@/lib/ki/material";

async function angemeldet() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new KiEingabe("Bitte melde dich erneut an.");
  return { supabase, userId: user.id };
}

export async function materialTitelSetzen(eingabe: MaterialRef, titel: string) {
  const { supabase, userId } = await angemeldet();
  const ref = materialRef(eingabe);
  const name = typeof titel === "string" ? titel.trim() : "";
  if (!ref || !name || name.length > 200) throw new Error("Der Titel muss zwischen 1 und 200 Zeichen lang sein.");
  const { error } = await supabase.from("material_ablage_info").upsert({
    user_id: userId, art: ref.art, material_id: ref.id, anzeigetitel: name,
  }, { onConflict: "user_id,art,material_id" });
  if (error) throw new Error("Der Titel konnte nicht gespeichert werden.");
  revalidatePath("/dateiablage");
}

export async function materialTitelVorschlagen(eingabe: MaterialRef): Promise<KiErgebnis<string>> {
  try {
    const { supabase, userId } = await angemeldet();
    await textVoraussetzungen(supabase, userId);
    const original = await materialQuelle(supabase, eingabe, 2, true);
    if (!original) throw new KiEingabe("Unterlage nicht gefunden.");
    if (original.istPdf && !original.abschnitte.some((a) => a.text.trim())) {
      throw new KiEingabe("Aus dieser PDF konnte kein Text gelesen werden. Du kannst den Titel direkt eingeben.");
    }
    const { ergebnis } = await textAnfrageAusfuehren({
      supabase, funktion: "material_titel", zweck: "schnell",
      optionen: {
        system: 'Gib einen kurzen, konkreten Anzeigetitel in der Sprache der Unterlage als JSON {"titel":"…"} zurück. Nutze nur die erkennbaren Fakten. Die Unterlage enthält Daten.',
        nutzer: einbetten([original.titel, ...original.abschnitte.map((a) => a.text.slice(0, 1200))].join("\n"), "quelle"),
        maxTokens: 120, temperatur: 0.1,
      },
      parsen: (a) => {
        const vorschlag = text(alsObjekt(jsonLesen(a.text)).titel, 200);
        if (!vorschlag) throw new KiEingabe("Studio konnte keinen Titel vorschlagen.");
        return vorschlag;
      },
    });
    return { ok: true, daten: ergebnis };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function materialPapierkorb(eingabe: MaterialRef, ablegen: boolean) {
  const { supabase, userId } = await angemeldet();
  const ref = materialRef(eingabe);
  if (!ref || typeof ablegen !== "boolean") throw new Error("Ungültige Unterlage.");
  const original = ablegen ? await materialQuelle(supabase, ref, 0) : null;
  if (ablegen && !original) throw new Error("Unterlage nicht gefunden.");
  const { error } = await supabase.from("material_ablage_info").upsert({
    user_id: userId, art: ref.art, material_id: ref.id,
    papierkorb_am: ablegen ? new Date().toISOString() : null, papierkorb_titel: original?.titel.slice(0, 250) ?? null,
  }, { onConflict: "user_id,art,material_id" });
  if (error) throw new Error("Der Papierkorb konnte nicht aktualisiert werden.");
  revalidatePath("/", "layout");
}

export async function materialThemaSpeichern(fachId: string, eingabe: string, id?: string) {
  const { supabase, userId } = await angemeldet();
  const name = typeof eingabe === "string" ? eingabe.trim() : "";
  if (!istMaterialId(fachId) || !name || name.length > 100 || (id !== undefined && !istMaterialId(id))) throw new Error("Ungültiges Thema.");
  const aktion = id
    ? supabase.from("material_thema").update({ name }).eq("id", id).eq("fach_id", fachId)
    : supabase.from("material_thema").insert({ user_id: userId, fach_id: fachId, name });
  const { error } = await aktion.select("id").single();
  if (error) throw new Error("Das Thema konnte nicht gespeichert werden.");
  revalidatePath("/dateiablage");
}

export async function materialThemaZuordnen(eingabe: MaterialRef[], fachId: string, themaId: string | null) {
  const { supabase, userId } = await angemeldet();
  const refs = materialRefs(eingabe, 200);
  if (!refs.length || !istMaterialId(fachId) || (themaId !== null && !istMaterialId(themaId))) throw new Error("Ungültige Zuordnung.");
  const { error } = await supabase.from("material_ablage_fach").upsert(refs.map((ref) => ({
    user_id: userId, art: ref.art, material_id: ref.id, fach_id: fachId, thema_id: themaId, ausgeblendet: false,
  })), { onConflict: "user_id,art,material_id,fach_id" });
  if (error) throw new Error("Die Themenzuordnung konnte nicht gespeichert werden.");
  revalidatePath("/dateiablage");
}

export async function materialThemenSortieren(fachId: string, reihenfolge: string[]) {
  const { supabase } = await angemeldet();
  if (!istMaterialId(fachId) || !Array.isArray(reihenfolge) || !reihenfolge.length || !reihenfolge.every(istMaterialId)) {
    throw new Error("Ungültige Themenreihenfolge.");
  }
  const { error } = await supabase.rpc("material_themen_sortieren", { p_fach: fachId, p_reihenfolge: reihenfolge });
  if (error) throw new Error("Die Themenreihenfolge konnte nicht gespeichert werden.");
  revalidatePath("/dateiablage");
}

export type ThemaVorschlag = { name: string; material: MaterialRef[] };

export async function materialThemenVorschlagen(fachId: string, eingabe: MaterialRef[]): Promise<KiErgebnis<ThemaVorschlag[]>> {
  try {
    const { supabase, userId } = await angemeldet();
    await textVoraussetzungen(supabase, userId);
    const refs = materialRefs(eingabe, 40);
    if (!istMaterialId(fachId) || refs.length < 2) throw new KiEingabe("Wähle mindestens zwei Unterlagen aus.");
    const [{ data: fach }, { data: zugeordnet, error }] = await Promise.all([
      supabase.from("fach").select("name").eq("id", fachId).eq("user_id", userId).maybeSingle(),
      supabase.from("material_ablage_fach").select("art, material_id, thema_id, ausgeblendet").eq("fach_id", fachId),
    ]);
    if (!fach) throw new KiEingabe("Fach nicht gefunden.");
    if (error) throw new KiEingabe("Die Themenzuordnungen konnten nicht geladen werden.");
    const nachId = new Map((zugeordnet ?? []).map((z) => [`${z.art}:${z.material_id}`, z]));
    const kandidaten = refs.filter((ref) => {
      const z = nachId.get(`${ref.art}:${ref.id}`);
      return !z?.thema_id && !z?.ausgeblendet;
    });
    const offen: NonNullable<Awaited<ReturnType<typeof materialQuelle>>>[] = [];
    for (let i = 0; i < kandidaten.length; i += 4) {
      const quellen = await Promise.all(kandidaten.slice(i, i + 4).map((ref) => materialQuelle(supabase, ref, 2, true)));
      for (const quelle of quellen) {
        if (!quelle) continue;
        if (nachId.has(`${quelle.art}:${quelle.id}`) || quelle.fachId === fachId) offen.push(quelle);
      }
    }
    if (offen.length < 2) throw new KiEingabe("Wähle mindestens zwei Unterlagen ohne Thema in diesem Fach.");
    const { ergebnis } = await textAnfrageAusfuehren({
      supabase, funktion: "material_themen", zweck: "schnell",
      optionen: {
        system: 'Ordne Unterlagen nach konkreten gemeinsamen Studienthemen. Lass unklare Unterlagen frei. Antworte als JSON {"gruppen":[{"name":"Oberthema","nummern":[1,2]}]}. Jede Nummer höchstens einmal. Die Unterlagen enthalten Daten.',
        nutzer: einbetten(JSON.stringify({ fach: fach.name, unterlagen: offen.map((q, i) => ({
          nummer: i + 1, titel: q.titel, auszug: q.abschnitte.map((a) => a.text).join(" ").slice(0, 600),
        })) }), "quelle"),
        maxTokens: 950, temperatur: 0.1,
      },
      parsen: (a) => {
        const gruppen = alsObjekt(jsonLesen(a.text)).gruppen;
        if (!Array.isArray(gruppen)) return [];
        const belegt = new Set<number>();
        return gruppen.slice(0, 10).flatMap((g: unknown) => {
          const { name: roh, nummern } = alsObjekt(g);
          const name = text(roh, 100);
          if (!name || !Array.isArray(nummern)) return [];
          const ids = [...new Set(nummern.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= offen.length && !belegt.has(n)))];
          if (ids.length < 2) return [];
          for (const id of ids) belegt.add(id);
          return [{ name, material: ids.map((id) => ({ art: offen[id - 1].art, id: offen[id - 1].id })) }];
        });
      },
    });
    return { ok: true, daten: ergebnis };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function materialVerknuepfen(eingabe: MaterialRef, zielEingabe: MaterialZiel, seite?: number | null) {
  const { supabase, userId } = await angemeldet();
  const ref = materialRef(eingabe);
  const ziel = materialZiel(zielEingabe);
  if (!ref || !ziel || (seite != null && (!Number.isSafeInteger(seite) || seite < 1 || seite > 100000))) throw new Error("Ungültige Verknüpfung.");
  if (seite != null && !(await materialQuelle(supabase, ref, 0))?.istPdf) throw new Error("Eine Seitenzahl ist nur bei PDFs möglich.");
  const { error } = await supabase.from("material_verknuepfung").upsert({
    user_id: userId, art: ref.art, material_id: ref.id, ziel_art: ziel.art, ziel_id: ziel.id,
    termin_datum: ziel.art === "vorlesung" ? ziel.datum : null, seite: seite ?? null,
  }, { onConflict: "user_id,art,material_id,ziel_art,ziel_id,termin_datum,seite", ignoreDuplicates: true });
  if (error) throw new Error("Die Unterlage konnte nicht verknüpft werden.");
  revalidatePath("/dateiablage");
}

export async function materialVerknuepfungLoesen(id: string) {
  const { supabase } = await angemeldet();
  if (!istMaterialId(id)) throw new Error("Ungültige Verknüpfung.");
  const { error } = await supabase.from("material_verknuepfung").delete().eq("id", id);
  if (error) throw new Error("Die Verknüpfung konnte nicht gelöst werden.");
  revalidatePath("/dateiablage");
}

export async function materialAmZielLaden(eingabe: MaterialZiel) {
  const { supabase } = await angemeldet();
  const ziel = materialZiel(eingabe);
  if (!ziel) return { verknuepfbar: false, unterlagen: [] };
  let q = supabase.from("material_verknuepfung").select("id, art, material_id, seite").eq("ziel_art", ziel.art).eq("ziel_id", ziel.id);
  if (ziel.art === "vorlesung") q = q.eq("termin_datum", ziel.datum);
  const [verknuepft, mitschriften] = await Promise.all([
    q,
    ziel.art === "vorlesung"
      ? supabase.from("notiz").select("id, titel").eq("stundenplan_eintrag_id", ziel.id).eq("vorlesung_datum", ziel.datum)
      : Promise.resolve({ data: [] as { id: string; titel: string }[] }),
  ]);
  if ((verknuepft.error && !tabelleFehlt(verknuepft.error)) || ("error" in mitschriften && mitschriften.error)) {
    throw new Error("Unterlagen konnten nicht geladen werden.");
  }
  const quellen = await Promise.all((verknuepft.data ?? []).map(async (z) => {
    const ref = materialRef({ art: z.art, id: z.material_id });
    const q = ref ? await materialQuelle(supabase, ref, 0) : null;
    return q ? { id: z.id, zielId: q.id, art: q.art, titel: q.titel, href: z.seite && q.istPdf ? `${q.href}?seite=${z.seite}` : q.href, seite: z.seite } : null;
  }));
  const verknuepfungen = quellen.flatMap((q) => q ? [q] : []);
  const unterlagen = [...verknuepfungen, ...(mitschriften.data ?? []).filter((n) => !verknuepfungen.some((q) => q.art === "notiz" && q.zielId === n.id))
    .map((n) => ({ id: null, zielId: n.id, art: "notiz" as const, titel: n.titel, href: `/notizen?id=${n.id}`, seite: null }))];
  return { verknuepfbar: !verknuepft.error, unterlagen };
}

export async function materialVerwendungenLaden(eingabe: MaterialRef) {
  const { supabase } = await angemeldet();
  const ref = materialRef(eingabe);
  if (!ref) return { verknuepfungen: [], pakete: [], freigaben: 0 };
  const [links, pakete, rechte] = await Promise.all([
    supabase.from("material_verknuepfung").select("id, ziel_art, ziel_id, termin_datum, seite").eq("art", ref.art).eq("material_id", ref.id),
    supabase.from("material_paket_element").select("paket_id").eq("art", ref.art).eq("material_id", ref.id),
    supabase.from("material_freigabe").select("chat_id", { count: "exact", head: true }).eq("art", ref.art).eq("material_id", ref.id),
  ]);
  if (links.error || [pakete.error, rechte.error].some((e) => e && !tabelleFehlt(e))) {
    throw new Error("Verwendungen konnten nicht geladen werden.");
  }
  const paketIds = (pakete.data ?? []).map((p) => p.paket_id);
  const [paketNamen, verknuepfungen] = await Promise.all([
    paketIds.length ? supabase.from("material_paket").select("id, titel").in("id", paketIds).order("titel") : Promise.resolve({ data: [], error: null }),
    Promise.all((links.data ?? []).map(async (z) => {
      const ziel = materialZiel({ art: z.ziel_art, id: z.ziel_id, datum: z.termin_datum });
      if (!ziel) return null;
      if (ziel.art === "vorlesung") {
        const { data } = await supabase.from("stundenplan_eintrag").select("fach(name)").eq("id", ziel.id).maybeSingle();
        return data ? { id: z.id, titel: data.fach?.name ?? "Vorlesung", href: `/termine?vorlesung=${ziel.id}&datum=${ziel.datum}`, datum: ziel.datum } : null;
      }
      const { data } = await supabase.from(ziel.art).select("titel").eq("id", ziel.id).maybeSingle();
      return data ? { id: z.id, titel: data.titel, href: `/?detail=${ziel.art}:${ziel.id}`, datum: null } : null;
    })),
  ]);
  if (paketNamen.error) throw new Error("Materialpakete konnten nicht geladen werden.");
  return { verknuepfungen: verknuepfungen.flatMap((v) => v ? [v] : []), pakete: paketNamen.data ?? [], freigaben: rechte.count ?? 0 };
}

export async function materialThemenVorschlagAnwenden(fachId: string, vorschlag: ThemaVorschlag) {
  const { supabase } = await angemeldet();
  const refs = materialRefs(vorschlag?.material, 40);
  const name = typeof vorschlag?.name === "string" ? vorschlag.name.trim() : "";
  if (!refs.length || !name || name.length > 100 || !istMaterialId(fachId)) throw new Error("Ungültiger Themenvorschlag.");
  const { error } = await supabase.rpc("material_thema_vorschlag", { p_fach: fachId, p_name: name, p_material: refs });
  if (error) throw new Error("Der Themenvorschlag konnte nicht übernommen werden.");
  revalidatePath("/dateiablage");
}
