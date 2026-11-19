"use server";

import { fachZuordnungenSpeichern } from "./zuordnung-actions";
import { fachZuordnungen, istMaterialId } from "@/lib/dateiablage/material";
import { after } from "next/server";
import { pdfIndexieren } from "@/lib/pdf-reader/index-server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import {
  freierName,
  speicherName,
  umbenannt,
  uploadPruefen,
  SPEICHER_LIMIT_BYTES,
} from "@/lib/dateiablage/dateien";
import { dateiBestimmen, LinkFehler, linkNormalisieren } from "@/lib/dateiablage/link-import";
import { linkHerunterladen } from "@/lib/dateiablage/link-laden";
import { webLinkUrl } from "@/lib/dateiablage/weblink";
import type { Tables, TablesInsert } from "@/lib/supabase/types";

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

async function belegterSpeicher(supabase: Supabase, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("material_speicherbelegung");
  if (!error) return Number(data ?? 0);
  if (error.code === "PGRST202" || error.code === "42883") {
    const alt = await supabase.from("datei").select("groesse").eq("user_id", userId);
    if (!alt.error) return (alt.data ?? []).reduce((summe, d) => summe + Number(d.groesse), 0);
  }
  throw new Error("Der Speicherstand konnte nicht geladen werden.");
}

async function namenImOrdner(supabase: Supabase, userId: string, fachId: string | null, ohneId?: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("material_dateinamen", { p_fach: fachId, p_ohne: ohneId ?? null });
  if (!error) return data ?? [];
  if (error.code === "PGRST202" || error.code === "42883") {
    const abfrage = supabase.from("datei").select("id, name").eq("user_id", userId);
    const alt = await (fachId ? abfrage.eq("fach_id", fachId) : abfrage.is("fach_id", null));
    if (!alt.error) return (alt.data ?? []).filter((d) => d.id !== ohneId).map((d) => d.name);
  }
  throw new Error("Die Dateinamen konnten nicht geladen werden.");
}

async function fachPruefen(supabase: Supabase, userId: string, fachId: string | null) {
  if (fachId === null) return;
  if (!istMaterialId(fachId)) throw new Error("Ungültiges Fach.");
  const { data } = await supabase.from("fach").select("id").eq("id", fachId).eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Ungültiges Fach.");
}

async function dateiAmSpeicherpfad(supabase: Supabase, userId: string, pfad: string) {
  const { data, error } = await supabase.from("datei").select("*").eq("user_id", userId).eq("speicher_pfad", pfad).maybeSingle();
  if (error) throw new Error("Die Datei konnte nicht geprüft werden.");
  return data;
}

export type UploadTicket = { pfad: string; signedUrl: string; name: string; mime: string };

/** DAT-02 Schritt 1: prüfen und eine signierte Upload-Adresse holen (Upload läuft direkt zum Storage). */
export async function uploadVorbereiten(eingabe: { name: string; groesse: number; fachId: string | null }): Promise<UploadTicket> {
  const { supabase, userId } = await nutzer();
  if (!eingabe || typeof eingabe.name !== "string" || !Number.isSafeInteger(eingabe.groesse)) throw new Error("Ungültige Datei.");
  await fachPruefen(supabase, userId, eingabe.fachId);
  const pruefung = uploadPruefen(eingabe.name, eingabe.groesse, await belegterSpeicher(supabase, userId));
  if (!pruefung.ok) throw new Error(pruefung.fehler);

  const name = freierName(eingabe.name.trim(), await namenImOrdner(supabase, userId, eingabe.fachId));
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
  if (!eingabe || typeof eingabe.pfad !== "string" || !eingabe.pfad.startsWith(`${userId}/`) || typeof eingabe.name !== "string") {
    throw new Error("Ungültiger Upload.");
  }
  const vorhanden = await dateiAmSpeicherpfad(supabase, userId, eingabe.pfad);
  if (vorhanden) return vorhanden;
  await fachPruefen(supabase, userId, eingabe.fachId);

  const groesse = await hochgeladeneGroesse(supabase, eingabe.pfad);
  if (groesse === null) throw new Error("Upload nicht gefunden. Bitte versuch es noch einmal.");
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
  const istPdf = eingabe.mime === "application/pdf";
  let mitIndexStatus = istPdf;
  for (let versuch = 0; versuch < 5; versuch++) {
    const zeile: TablesInsert<"datei"> = {
      user_id: userId, fach_id: eingabe.fachId, name, groesse: eingabe.groesse,
      mime_typ: eingabe.mime, speicher_pfad: eingabe.pfad,
    };
    const mitStatus: TablesInsert<"datei"> = { ...zeile, pdf_index_status: "wartet" };
    let gespeichert = await supabase.from("datei").insert(mitIndexStatus ? mitStatus : zeile).select().single();
    if (mitIndexStatus && gespeichert.error?.message.includes("pdf_index_status") && ["PGRST204", "42703"].includes(gespeichert.error.code)) {
      mitIndexStatus = false;
      gespeichert = await supabase.from("datei").insert(zeile).select().single();
    }
    const { data, error } = gespeichert;
    if (!error) {
      const datei = { ...data, pdf_index_status: data.pdf_index_status ?? null };
      if (istPdf) {
        after(async () => {
          let status = "fertig";
          try { await pdfIndexieren(supabase, datei); }
          catch {
            status = "fehler";
            console.error("[dateiablage] PDF-Text konnte nicht erfasst werden");
          }
          if (mitIndexStatus) await supabase.from("datei").update({ pdf_index_status: status }).eq("id", datei.id);
          revalidatePath("/dateiablage");
        });
      }
      revalidatePath("/dateiablage");
      return datei;
    }
    if (error.code === "23505") {
      const vorhanden = await dateiAmSpeicherpfad(supabase, userId, eingabe.pfad);
      if (vorhanden) return vorhanden;
      name = freierName(name, await namenImOrdner(supabase, userId, eingabe.fachId));
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
    await fachPruefen(supabase, userId, eingabe.fachId);

    const geladen = await linkHerunterladen(url);
    const { name: vorschlag, mime } = dateiBestimmen(geladen);
    const pruefung = uploadPruefen(vorschlag, geladen.bytes.length, await belegterSpeicher(supabase, userId));
    if (!pruefung.ok) return { ok: false, fehler: pruefung.fehler };

    const name = freierName(vorschlag, await namenImOrdner(supabase, userId, eingabe.fachId));
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

export async function webLinkSpeichern(eingabe: { link: string; fachId: string | null }): Promise<LinkImport> {
  try {
    const { supabase, userId } = await nutzer();
    const url = webLinkUrl(eingabe?.link);
    if (!url) return { ok: false, fehler: "Füge einen gültigen HTTPS- oder HTTP-Link ein." };
    await fachPruefen(supabase, userId, eingabe.fachId);
    const datei = new Blob([url.href], { type: "text/plain" });
    const vorschlag = `${url.hostname.slice(0, 180)}.txt`;
    const [belegt, namen] = await Promise.all([
      belegterSpeicher(supabase, userId),
      namenImOrdner(supabase, userId, eingabe.fachId),
    ]);
    const pruefung = uploadPruefen(vorschlag, datei.size, belegt);
    if (!pruefung.ok) return { ok: false, fehler: pruefung.fehler };
    const name = freierName(vorschlag, namen);
    const pfad = `${userId}/weblinks/${crypto.randomUUID()}.txt`;
    const { error } = await supabase.storage.from(BUCKET).upload(pfad, datei, { contentType: "text/plain", upsert: false });
    if (error) throw new Error("Der Link konnte nicht gespeichert werden.");
    return { ok: true, datei: await dateiEintragen(supabase, userId, { pfad, name, fachId: eingabe.fachId, groesse: datei.size, mime: pruefung.mime }) };
  } catch {
    return { ok: false, fehler: "Der Link konnte nicht gespeichert werden. Bitte versuch es noch einmal." };
  }
}

/** Upload abgebrochen: Objekt wieder entfernen. */
export async function uploadVerwerfen(pfad: string) {
  const { supabase, userId } = await nutzer();
  if (typeof pfad !== "string" || !pfad.startsWith(`${userId}/`) || await dateiAmSpeicherpfad(supabase, userId, pfad)) return;
  await supabase.storage.from(BUCKET).remove([pfad]);
}

/** DAT-05 */
export async function dateiUmbenennen(id: string, eingabe: string): Promise<Datei> {
  const { supabase } = await nutzer();
  const { data: datei, error: ladeFehler } = await supabase.from("datei").select("*").eq("id", id).single();
  if (ladeFehler) throw new Error(ladeFehler.message);
  const neu = umbenannt(datei.name, eingabe);
  if (!neu) throw new Error("Der Name darf nicht leer sein.");
  if ((await namenImOrdner(supabase, datei.user_id, datei.fach_id, id)).some((n) => n.toLowerCase() === neu.toLowerCase())) {
    throw new Error("In diesem Ordner gibt es schon eine Datei mit diesem Namen.");
  }
  const { data, error } = await supabase.from("datei").update({ name: neu }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  revalidatePath("/dateiablage");
  revalidatePath("/pdf-reader");
  return data;
}

/** DAT-06: Name wird bei Bedarf automatisch eindeutig gemacht. */
export async function dateiVerschieben(id: string, fachId: string | null): Promise<Datei> {
  const { supabase, userId } = await nutzer();
  await fachPruefen(supabase, userId, fachId);
  const { data: datei, error: ladeFehler } = await supabase.from("datei").select("*").eq("id", id).single();
  if (ladeFehler) throw new Error(ladeFehler.message);
  const name = freierName(datei.name, await namenImOrdner(supabase, userId, fachId, id));
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

/** Altes Löschverhalten ausschließlich vor der Einführung des Papierkorbs. */
export async function dateiEndgueltigLoeschen(id: string) {
  const { supabase, userId } = await nutzer();
  if (!istMaterialId(id)) return false;
  const stand = await supabase.from("material_ablage_info").select("art").limit(1);
  if (!stand.error || !["PGRST205", "42P01"].includes(stand.error.code)) return false;
  const { data, error } = await supabase.from("datei").delete().eq("id", id).eq("user_id", userId).select("speicher_pfad").maybeSingle();
  if (error || !data) return false;
  if (data.speicher_pfad.startsWith(`${userId}/`)) {
    const entfernt = await supabase.storage.from(BUCKET).remove([data.speicher_pfad]);
    if (entfernt.error) console.error("[dateiablage] Storage-Bereinigung nach Löschung fehlgeschlagen", entfernt.error.name);
  }
  revalidatePath("/dateiablage");
  revalidatePath("/");
  return true;
}

export async function dateiLink(id: string, herunterladen = false): Promise<string> {
  const { supabase } = await nutzer();
  if (!istMaterialId(id)) throw new Error("Datei nicht gefunden.");
  const { data, error } = await supabase.from("datei").select("id").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Datei nicht gefunden.");
  return `/dateiablage/inhalt/${id}${herunterladen ? "?download=1" : ""}`;
}

export async function speicherStand(): Promise<{ belegt: number; limit: number }> {
  const { supabase, userId } = await nutzer();
  return { belegt: await belegterSpeicher(supabase, userId), limit: SPEICHER_LIMIT_BYTES };
}

export async function chatDateiUebernehmen(nachrichtId: string, fachId: string | null, kopie = false): Promise<
  | { status: "abgelegt" | "bereits_abgelegt"; id: string; fachId: string | null }
  | { status: "update_noetig" }
> {
  const { supabase, userId } = await nutzer();
  if (!istMaterialId(nachrichtId) || (fachId !== null && !istMaterialId(fachId)) ||
      typeof kopie !== "boolean" || (kopie && fachId !== null)) throw new Error("Ungültige Auswahl.");
  const [nachricht] = await Promise.all([
    supabase.from("chat_nachricht").select("anhang, geloescht").eq("id", nachrichtId).maybeSingle(),
    fachPruefen(supabase, userId, fachId),
  ]);
  const anhang = nachricht.data?.anhang as { typ?: string; id?: string; titel?: string; pfad?: string } | null;
  if (nachricht.error || nachricht.data?.geloescht || anhang?.typ !== "datei" ||
      typeof anhang.pfad !== "string" || typeof anhang.titel !== "string") throw new Error("Der Anhang ist nicht verfügbar.");

  const original = istMaterialId(anhang.id)
    ? await supabase.from("datei").select("id, fach_id").eq("id", anhang.id)
        .eq("speicher_pfad", anhang.pfad).eq("user_id", userId).maybeSingle()
    : null;
  if (original?.error) throw new Error("Der Anhang konnte nicht geprüft werden.");
  if (original?.data && !kopie) {
    const datei = original.data;
    const extra = await supabase.from("material_ablage_fach").select("art, material_id, fach_id, ausgeblendet")
      .eq("art", "datei").eq("material_id", datei.id).eq("user_id", userId);
    if (extra.error && !tabelleFehlt(extra.error)) throw new Error("Der Ablageort konnte nicht geprüft werden.");
    const faecher = fachZuordnungen(datei.fach_id, extra.data ?? []);
    if (fachId === null || faecher.includes(fachId)) {
      return { status: "bereits_abgelegt", id: datei.id, fachId: fachId ?? faecher[0] ?? null };
    }
    if (extra.error) return { status: "update_noetig" };
    await fachZuordnungenSpeichern([{ art: "datei", material_id: datei.id, fach_id: fachId, ausgeblendet: false }]);
    return { status: "abgelegt", id: datei.id, fachId };
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(anhang.pfad);
  if (error || !data) throw new Error("Der Anhang konnte nicht geladen werden.");
  const pruefung = uploadPruefen(anhang.titel, data.size, await belegterSpeicher(supabase, userId));
  if (!pruefung.ok) throw new Error(pruefung.fehler);
  const name = freierName(anhang.titel, await namenImOrdner(supabase, userId, fachId));
  const pfad = `${userId}/chat/${crypto.randomUUID()}-${speicherName(name)}`;
  const { error: uploadFehler } = await supabase.storage.from(BUCKET).upload(pfad, data, { contentType: pruefung.mime });
  if (uploadFehler) throw new Error("Der Anhang konnte nicht abgelegt werden.");
  const datei = await dateiEintragen(supabase, userId, { pfad, name, fachId, groesse: data.size, mime: pruefung.mime });
  return { status: "abgelegt", id: datei.id, fachId };
}

export async function ablageFaecherLaden() {
  const { supabase, userId } = await nutzer();
  const { data, error } = await supabase.from("fach").select("id, name").eq("user_id", userId).order("name");
  if (error) throw new Error("Die Fächer konnten nicht geladen werden.");
  return data ?? [];
}

export async function pdfIndexStatusLaden(ids: string[]) {
  const { supabase } = await nutzer();
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 80 || !ids.every(istMaterialId)) return [];
  const { data, error } = await supabase.from("datei").select("id, pdf_index_status").in("id", ids);
  if (error) throw new Error("Suchstatus konnte nicht geladen werden.");
  return data ?? [];
}
