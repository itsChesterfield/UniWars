"use server";

import { materialPapierkorb } from "@/app/(hubs)/dateiablage/workflow-actions";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { materialZiel } from "@/lib/dateiablage/material";
import { berlinDatum, berlinWochentag, datumDeutsch } from "@/lib/zeit";
import type { Tables } from "@/lib/supabase/types";
import { istPdfName, linksUmbenennen, wikilinksFinden } from "@/lib/notizen/wikilinks";
import { vorlageInhalt, type VorlageId } from "@/lib/notizen/vorlagen";

export type Notiz = Tables<"notiz">;

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

type Supabase = Awaited<ReturnType<typeof nutzer>>["supabase"];

/**
 * Verlinkungen einer Notiz aus ihrem Text neu aufbauen ([[Notiz]], [[Skript.pdf#S12]]).
 * Notizen werden über den Titel gefunden, PDFs über den Dateinamen.
 */
async function linksAbgleichen(supabase: Supabase, userId: string, notizId: string, inhalt: string) {
  const links = wikilinksFinden(inhalt);
  const { error: loeschFehler } = await supabase.from("notiz_link").delete().eq("von_notiz_id", notizId);
  if (loeschFehler) {
    console.error("[notiz_link] löschen", loeschFehler.message);
    return;
  }
  if (links.length === 0) return;
  const [{ data: notizen }, { data: pdfs }] = await Promise.all([
    supabase.from("notiz").select("id, titel"),
    supabase.from("datei").select("id, name").eq("mime_typ", "application/pdf"),
  ]);
  const zeilen: { user_id: string; von_notiz_id: string; ziel_notiz_id?: string; ziel_datei_id?: string; seite: number | null }[] = [];
  for (const l of links) {
    const name = l.name.toLowerCase();
    if (istPdfName(l.name)) {
      const pdf = (pdfs ?? []).find((p) => p.name.toLowerCase() === name);
      if (pdf) zeilen.push({ user_id: userId, von_notiz_id: notizId, ziel_datei_id: pdf.id, seite: l.seite });
    } else {
      const ziel = (notizen ?? []).find((n) => n.titel.trim().toLowerCase() === name);
      if (ziel && ziel.id !== notizId) zeilen.push({ user_id: userId, von_notiz_id: notizId, ziel_notiz_id: ziel.id, seite: null });
    }
  }
  if (zeilen.length) {
    const { error } = await supabase.from("notiz_link").insert(zeilen);
    if (error) console.error("[notiz_link] speichern", error.message);
  }
}

/** NOT-01 – leer oder aus einer Vorlage */
export async function notizAnlegen(fachId: string | null, vorlage: VorlageId = "leer", titel?: string): Promise<Notiz> {
  const { supabase, userId } = await nutzer();
  const start = vorlageInhalt(vorlage);
  const { data, error } = await supabase
    .from("notiz")
    .insert({ user_id: userId, fach_id: fachId || null, titel: (titel ?? start.titel).slice(0, 300), inhalt: start.inhalt })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/notizen");
  return data;
}

/** NOT-08: Mitschrift zur laufenden Vorlesung – pro Vorlesung und Tag nur eine. */
export async function mitschriftAnlegen(stundenplanEintragId: string, terminDatum?: string): Promise<Notiz> {
  const { supabase, userId } = await nutzer();
  const heute = terminDatum ?? berlinDatum();
  if (!materialZiel({ art: "vorlesung", id: stundenplanEintragId, datum: heute })) throw new Error("Ungültiger Vorlesungstermin.");

  const { data: vorhanden } = await supabase
    .from("notiz")
    .select("*")
    .eq("stundenplan_eintrag_id", stundenplanEintragId)
    .eq("vorlesung_datum", heute)
    .limit(1)
    .maybeSingle();
  if (vorhanden) return vorhanden;

  const { data: eintrag, error: eintragFehler } = await supabase
    .from("stundenplan_eintrag")
    .select("id, tag, fach_id, fach(name)")
    .eq("id", stundenplanEintragId)
    .single();
  if (eintragFehler || berlinWochentag(new Date(`${heute}T12:00:00Z`)) !== eintrag.tag) throw new Error("Vorlesungstermin nicht gefunden.");
  const fachName = (eintrag.fach as { name: string } | null)?.name ?? "Vorlesung";

  const { data, error } = await supabase
    .from("notiz")
    .insert({
      user_id: userId,
      fach_id: eintrag.fach_id,
      titel: `Mitschrift ${fachName}, ${datumDeutsch(`${heute}T12:00:00Z`)}`,
      stundenplan_eintrag_id: eintrag.id,
      vorlesung_datum: heute,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/notizen");
  return data;
}

export type SpeicherErgebnis = {
  geaendertAm: string;
  /** Andere Notizen, deren Links nach einer Umbenennung angepasst wurden */
  angepasst: { id: string; inhalt: string }[];
};

/** NOT-02 / ALL-08: Autospeichern von Titel und Text – inkl. Verlinkungen. */
export async function notizSpeichern(id: string, aenderung: { titel?: string; inhalt?: string }): Promise<SpeicherErgebnis> {
  const { supabase, userId } = await nutzer();
  const update: { titel?: string; inhalt?: string } = {};
  if (typeof aenderung.titel === "string") update.titel = aenderung.titel.slice(0, 300);
  if (typeof aenderung.inhalt === "string") update.inhalt = aenderung.inhalt;

  // Vor dem Umbenennen den alten Titel merken – Links in anderen Notizen ziehen mit
  let alterTitel: string | null = null;
  if (update.titel !== undefined) {
    const { data: vorher } = await supabase.from("notiz").select("titel").eq("id", id).maybeSingle();
    alterTitel = vorher?.titel ?? null;
  }

  const { data, error } = await supabase.from("notiz").update(update).eq("id", id).select("geaendert_am").single();
  if (error) throw new Error(error.message);

  if (update.inhalt !== undefined) await linksAbgleichen(supabase, userId, id, update.inhalt);

  const angepasst: { id: string; inhalt: string }[] = [];
  if (alterTitel && update.titel && alterTitel.trim() && alterTitel.trim() !== update.titel.trim()) {
    const { data: verweise } = await supabase.from("notiz_link").select("von_notiz_id").eq("ziel_notiz_id", id);
    const quellen = [...new Set((verweise ?? []).map((v) => v.von_notiz_id))];
    if (quellen.length) {
      const { data: texte } = await supabase.from("notiz").select("id, inhalt").in("id", quellen);
      for (const t of texte ?? []) {
        const neu = linksUmbenennen(t.inhalt, alterTitel, update.titel);
        if (neu === t.inhalt) continue;
        const { error: e } = await supabase.from("notiz").update({ inhalt: neu }).eq("id", t.id);
        if (!e) angepasst.push({ id: t.id, inhalt: neu });
      }
    }
  }
  return { geaendertAm: data.geaendert_am, angepasst };
}

/** NOT-05 */
export async function notizAnpinnen(id: string, angepinnt: boolean) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("notiz").update({ angepinnt }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** NOT-06 */
export async function notizFachSetzen(id: string, fachId: string | null) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("notiz").update({ fach_id: fachId || null }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** NOT-07 */
export async function notizLoeschen(id: string) {
  await materialPapierkorb({ art: "notiz", id }, true);
  revalidatePath("/notizen");
}

/** Neue Notiz direkt aus dem PDF Reader – mit der PDF verknüpft und im Fach der PDF. */
export async function notizZuPdfAnlegen(dateiId: string): Promise<Notiz> {
  const { supabase, userId } = await nutzer();
  const { data: datei, error: dateiFehler } = await supabase.from("datei").select("id, name, fach_id, mime_typ").eq("id", dateiId).single();
  if (dateiFehler) throw new Error(dateiFehler.message);
  if (datei.mime_typ !== "application/pdf") throw new Error("Keine PDF.");
  const { data, error } = await supabase
    .from("notiz")
    .insert({
      user_id: userId,
      fach_id: datei.fach_id,
      titel: `Notizen zu ${datei.name.replace(/\.pdf$/i, "")}`.slice(0, 300),
      // Die Verbindung zur PDF ist ein normaler Link im Text – wie jeder andere
      inhalt: `Bezug: [[${datei.name}]]\n\n`,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await linksAbgleichen(supabase, userId, data.id, data.inhalt);
  revalidatePath("/notizen");
  revalidatePath(`/pdf-reader/${dateiId}`);
  return data;
}
