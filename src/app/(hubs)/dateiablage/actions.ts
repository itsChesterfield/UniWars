"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  freierName,
  speicherName,
  umbenannt,
  uploadPruefen,
  SPEICHER_LIMIT_BYTES,
} from "@/lib/dateiablage/dateien";
import { dateiBestimmen, LinkFehler, linkNormalisieren } from "@/lib/dateiablage/link-import";
import { linkHerunterladen } from "@/lib/dateiablage/link-laden";
import type { Tables } from "@/lib/supabase/types";

export type Datei = Tables<"datei">;

const BUCKET = "dateiablage";

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

type Supabase = Awaited<ReturnType<typeof nutzer>>["supabase"];

async function belegterSpeicher(supabase: Supabase): Promise<number> {
  const { data, error } = await supabase.from("datei").select("groesse");
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((summe, d) => summe + Number(d.groesse), 0);
}

async function namenImOrdner(supabase: Supabase, fachId: string | null, ohneId?: string): Promise<string[]> {
  let abfrage = supabase.from("datei").select("id, name");
  abfrage = fachId ? abfrage.eq("fach_id", fachId) : abfrage.is("fach_id", null);
  const { data } = await abfrage;
  return (data ?? []).filter((d) => d.id !== ohneId).map((d) => d.name);
}

export type UploadTicket = { pfad: string; signedUrl: string; name: string; mime: string };

/** DAT-02 Schritt 1: prüfen und eine signierte Upload-Adresse holen (Upload läuft direkt zum Storage). */
export async function uploadVorbereiten(eingabe: { name: string; groesse: number; fachId: string | null }): Promise<UploadTicket> {
  const { supabase, userId } = await nutzer();
  const pruefung = uploadPruefen(eingabe.name, eingabe.groesse, await belegterSpeicher(supabase));
  if (!pruefung.ok) throw new Error(pruefung.fehler);

  const name = freierName(eingabe.name.trim(), await namenImOrdner(supabase, eingabe.fachId));
  const pfad = `${userId}/${eingabe.fachId ?? "allgemein"}/${crypto.randomUUID()}-${speicherName(name)}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(pfad);
  if (error) throw new Error(error.message);
  return { pfad, signedUrl: data.signedUrl, name, mime: pruefung.mime };
}

/** Tatsächliche Größe im Storage (nicht der Angabe des Browsers vertrauen). */
async function hochgeladeneGroesse(supabase: Supabase, pfad: string): Promise<number | null> {
  const { data: info } = await supabase.storage.from(BUCKET).info(pfad);
  if (info?.size !== undefined && info.size !== null) return Number(info.size);
  // Fallback über die Ordnerliste
  const trenner = pfad.lastIndexOf("/");
  const { data: liste } = await supabase.storage
    .from(BUCKET)
    .list(pfad.slice(0, trenner), { search: pfad.slice(trenner + 1), limit: 1 });
  const eintrag = liste?.find((o) => o.name === pfad.slice(trenner + 1));
  const groesse = (eintrag?.metadata as { size?: number } | undefined)?.size;
  return typeof groesse === "number" ? groesse : null;
}

/** DAT-02 Schritt 2: hochgeladene Datei eintragen. */
export async function uploadAbschliessen(eingabe: { pfad: string; name: string; fachId: string | null }): Promise<Datei> {
  const { supabase, userId } = await nutzer();
  if (!eingabe.pfad.startsWith(`${userId}/`)) throw new Error("Ungültiger Pfad");

  const groesse = await hochgeladeneGroesse(supabase, eingabe.pfad);
  if (groesse === null) throw new Error("Upload nicht gefunden – bitte erneut versuchen.");
  const pruefung = uploadPruefen(eingabe.name, groesse, 0);
  if (!pruefung.ok) {
    await supabase.storage.from(BUCKET).remove([eingabe.pfad]);
    throw new Error(pruefung.fehler);
  }

  return dateiEintragen(supabase, userId, { pfad: eingabe.pfad, name: eingabe.name, fachId: eingabe.fachId, groesse, mime: pruefung.mime });
}

/** Datei-Eintrag anlegen; bei gleichem Namen (parallel) den nächsten freien nehmen. */
async function dateiEintragen(
  supabase: Supabase,
  userId: string,
  eingabe: { pfad: string; name: string; fachId: string | null; groesse: number; mime: string },
): Promise<Datei> {
  let name = eingabe.name;
  for (let versuch = 0; versuch < 5; versuch++) {
    const { data, error } = await supabase
      .from("datei")
      .insert({
        user_id: userId,
        fach_id: eingabe.fachId || null,
        name,
        groesse: eingabe.groesse,
        mime_typ: eingabe.mime,
        speicher_pfad: eingabe.pfad,
      })
      .select()
      .single();
    if (!error) {
      revalidatePath("/dateiablage");
      return data;
    }
    if (error.code === "23505") {
      name = freierName(name, await namenImOrdner(supabase, eingabe.fachId));
      continue;
    }
    await supabase.storage.from(BUCKET).remove([eingabe.pfad]);
    if (error.message.includes("SPEICHER_VOLL")) throw new Error("Dein Speicherplatz ist voll (2 GB).");
    throw new Error(error.message);
  }
  await supabase.storage.from(BUCKET).remove([eingabe.pfad]);
  throw new Error("Name konnte nicht vergeben werden.");
}

export type LinkImport = { ok: true; datei: Datei } | { ok: false; fehler: string };

/**
 * Datei über einen Link importieren: Der Server lädt sie herunter (öffentliche Links,
 * höchstens 25 MB) und legt sie im Ordner ab. Fehler kommen als Wert zurück.
 */
export async function ausLinkImportieren(eingabe: { link: string; fachId: string | null }): Promise<LinkImport> {
  try {
    const { supabase, userId } = await nutzer();
    const url = linkNormalisieren(eingabe.link);
    if (!url) return { ok: false, fehler: "Das ist kein gültiger Link. Kopiere die Adresse aus der Adresszeile deines Browsers (beginnt mit https://)." };

    const geladen = await linkHerunterladen(url);
    const { name: vorschlag, mime } = dateiBestimmen(geladen);
    const pruefung = uploadPruefen(vorschlag, geladen.bytes.length, await belegterSpeicher(supabase));
    if (!pruefung.ok) return { ok: false, fehler: pruefung.fehler };

    const name = freierName(vorschlag, await namenImOrdner(supabase, eingabe.fachId));
    const pfad = `${userId}/${eingabe.fachId ?? "allgemein"}/${crypto.randomUUID()}-${speicherName(name)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(pfad, geladen.bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(error.message);
    const datei = await dateiEintragen(supabase, userId, { pfad, name, fachId: eingabe.fachId, groesse: geladen.bytes.length, mime });
    return { ok: true, datei };
  } catch (err) {
    if (err instanceof LinkFehler) return { ok: false, fehler: err.message };
    if (err instanceof Error && err.message.includes("Speicherplatz")) return { ok: false, fehler: err.message };
    console.error("[dateiablage] Link-Import", err instanceof Error ? err.message : err);
    return { ok: false, fehler: "Der Import hat nicht geklappt. Versuch es noch einmal." };
  }
}

/** Upload abgebrochen: Objekt wieder entfernen. */
export async function uploadVerwerfen(pfad: string) {
  const { supabase, userId } = await nutzer();
  if (!pfad.startsWith(`${userId}/`)) return;
  await supabase.storage.from(BUCKET).remove([pfad]);
}

/** DAT-05 */
export async function dateiUmbenennen(id: string, eingabe: string): Promise<Datei> {
  const { supabase } = await nutzer();
  const { data: datei, error: ladeFehler } = await supabase.from("datei").select("*").eq("id", id).single();
  if (ladeFehler) throw new Error(ladeFehler.message);
  const neu = umbenannt(datei.name, eingabe);
  if (!neu) throw new Error("Der Name darf nicht leer sein.");
  if ((await namenImOrdner(supabase, datei.fach_id, id)).some((n) => n.toLowerCase() === neu.toLowerCase())) {
    throw new Error("In diesem Ordner gibt es schon eine Datei mit diesem Namen.");
  }
  const { data, error } = await supabase.from("datei").update({ name: neu }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  revalidatePath("/dateiablage");
  return data;
}

/** DAT-06: Name wird bei Bedarf automatisch eindeutig gemacht. */
export async function dateiVerschieben(id: string, fachId: string | null): Promise<Datei> {
  const { supabase } = await nutzer();
  const { data: datei, error: ladeFehler } = await supabase.from("datei").select("*").eq("id", id).single();
  if (ladeFehler) throw new Error(ladeFehler.message);
  const name = freierName(datei.name, await namenImOrdner(supabase, fachId, id));
  const { data, error } = await supabase
    .from("datei")
    .update({ fach_id: fachId || null, name })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dateiablage");
  return data;
}

/** DAT-08: Hinweis vor dem Löschen. */
export async function dateiVerwendung(id: string): Promise<{ anhaenge: number; quellen: number }> {
  const { supabase } = await nutzer();
  const [{ count: anhaenge }, { count: quellen }] = await Promise.all([
    supabase.from("anhang").select("id", { count: "exact", head: true }).eq("datei_id", id),
    supabase.from("literatur_quelle").select("id", { count: "exact", head: true }).eq("datei_id", id),
  ]);
  return { anhaenge: anhaenge ?? 0, quellen: quellen ?? 0 };
}

/** DAT-08: aus Storage und Datenbank entfernen. */
export async function dateiLoeschen(id: string) {
  const { supabase } = await nutzer();
  const { data: datei, error: ladeFehler } = await supabase.from("datei").select("speicher_pfad").eq("id", id).single();
  if (ladeFehler) throw new Error(ladeFehler.message);
  const { error } = await supabase.from("datei").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(BUCKET).remove([datei.speicher_pfad]);
  revalidatePath("/dateiablage");
  revalidatePath("/");
}

/** DAT-04 / DAT-07: kurzlebiger Link zum Ansehen oder Herunterladen. */
export async function dateiLink(id: string, herunterladen = false): Promise<string> {
  const { supabase } = await nutzer();
  const { data: datei, error: ladeFehler } = await supabase.from("datei").select("name, speicher_pfad").eq("id", id).single();
  if (ladeFehler) throw new Error(ladeFehler.message);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(datei.speicher_pfad, 600, herunterladen ? { download: datei.name } : undefined);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function speicherStand(): Promise<{ belegt: number; limit: number }> {
  const { supabase } = await nutzer();
  return { belegt: await belegterSpeicher(supabase), limit: SPEICHER_LIMIT_BYTES };
}
