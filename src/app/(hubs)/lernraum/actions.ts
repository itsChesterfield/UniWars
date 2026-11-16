"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { KiEingabe, KiKeineDaten } from "@/lib/ki/fehler";
import { alsFehler, kiNutzer, textAnfrageAusfuehren, textVoraussetzungen, type KiErgebnis } from "@/lib/ki/server";
import {
  belegeAlsWikilinks,
  kartenLesen,
  kontextBauen,
  MAX_KONTEXT_GANZ,
  profilAnpassen,
  profilLesen,
  quizLesen,
  STUDIO,
  studioPrompt,
  ueberblickLesen,
  ueberblickPrompt,
  istStudioArt,
  type Karte,
  type Lernprofil,
  type QuizFrage,
  type Rueckmeldung,
  type StudioArt,
  type Ueberblick,
} from "@/lib/ki/lernraum";
import { quellenListe, quellenTexte } from "@/lib/ki/lernraum-server";
import type { Json } from "@/lib/supabase/types";

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

async function raumLaden(supabase: Awaited<ReturnType<typeof nutzer>>["supabase"], lernraumId: string) {
  const { data } = await supabase.from("lernraum").select("id, fach_id, fach(name)").eq("id", lernraumId).maybeSingle();
  if (!data) throw new KiEingabe("Lernraum nicht gefunden.");
  return { id: data.id, fachId: data.fach_id, fach: (data.fach as { name: string } | null)?.name ?? "Fach" };
}

// ---------------------------------------------------------------------------
// Quellen
// ---------------------------------------------------------------------------

/** Quelle an/aus (Fach-Quellen) bzw. dazunehmen/entfernen (fachfremde) */
export async function quelleSetzen(lernraumId: string, art: "pdf" | "notiz", id: string, aktion: "an" | "aus" | "dazu" | "entfernen") {
  const { supabase, userId } = await nutzer();
  const spalte = art === "pdf" ? "datei_id" : "notiz_id";
  await supabase.from("lernraum_quelle").delete().eq("lernraum_id", lernraumId).eq(spalte, id);
  if (aktion === "aus" || aktion === "dazu") {
    const { error } = await supabase
      .from("lernraum_quelle")
      .insert({
        user_id: userId,
        lernraum_id: lernraumId,
        datei_id: art === "pdf" ? id : null,
        notiz_id: art === "notiz" ? id : null,
        status: aktion === "aus" ? "aus" : "extra",
      });
    if (error) throw new Error(error.message);
  }
}

/** PDF-Text speichern (der Browser liest die Seiten mit pdf.js und schickt sie in Blöcken) */
export async function quelleSeitenSpeichern(dateiId: string, seiten: { seite: number; text: string }[], ersterBlock: boolean) {
  const { supabase, userId } = await nutzer();
  if (!Array.isArray(seiten) || seiten.length > 80) throw new Error("Zu viele Seiten auf einmal.");
  const { data: datei } = await supabase.from("datei").select("id, mime_typ").eq("id", dateiId).maybeSingle();
  if (!datei || datei.mime_typ !== "application/pdf") throw new Error("PDF nicht gefunden.");
  if (ersterBlock) await supabase.from("quelle_seite").delete().eq("datei_id", dateiId);
  const zeilen = seiten
    .filter((s) => Number.isInteger(s.seite) && s.seite >= 1 && typeof s.text === "string")
    .map((s) => ({ datei_id: dateiId, user_id: userId, seite: s.seite, text: s.text.replace(/\s+/g, " ").trim().slice(0, 30000) }));
  if (zeilen.length) {
    const { error } = await supabase.from("quelle_seite").upsert(zeilen, { onConflict: "datei_id,seite" });
    if (error) throw new Error(error.message);
  }
}

/** Überblick über eine Quelle (Zusammenfassung, Themen, Vorschlagsfragen) – zwischengespeichert */
export async function quelleUeberblick(lernraumId: string, art: "pdf" | "notiz", id: string): Promise<KiErgebnis<Ueberblick>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const raum = await raumLaden(supabase, lernraumId);
    const liste = await quellenListe(supabase, raum.id, raum.fachId);
    const eintrag = liste.find((q) => q.art === art && q.id === id);
    if (!eintrag) throw new KiEingabe("Quelle nicht gefunden.");
    const stand = `${eintrag.geaendertAm}|${eintrag.seiten}`;
    const spalte = art === "pdf" ? "datei_id" : "notiz_id";
    const { data: gespeichert } = await supabase.from("quelle_ueberblick").select("stand, inhalt").eq(spalte, id).maybeSingle();
    if (gespeichert?.stand === stand) {
      const u = gespeichert.inhalt as unknown as Ueberblick;
      if (u?.zusammenfassung) return { ok: true, daten: u };
    }
    await textVoraussetzungen(supabase, userId);
    const [quelle] = await quellenTexte(supabase, [{ ...eintrag, aktiv: true }]);
    const inhalt = quelle.abschnitte.map((a) => (art === "pdf" ? `[S. ${a.seite}] ${a.text}` : a.text)).join("\n").slice(0, 120_000);
    if (inhalt.trim().length < 50) throw new KiKeineDaten(art === "pdf" ? "Diese PDF ist noch nicht eingelesen oder enthält keinen Text." : "Die Notiz ist zu kurz.");
    const p = ueberblickPrompt(eintrag.titel, inhalt);
    const { ergebnis } = await textAnfrageAusfuehren({
      supabase,
      funktion: "lernraum_ueberblick",
      zweck: "stark",
      optionen: { system: p.system, nutzer: p.nutzer, json: true, temperatur: 0.2, maxTokens: 900, timeoutMs: 60_000 },
      parsen: (a) => {
        const u = ueberblickLesen(a.text);
        if (!u) throw new KiKeineDaten("Der Überblick konnte nicht erstellt werden.");
        return u;
      },
    });
    await supabase.from("quelle_ueberblick").delete().eq(spalte, id);
    await supabase.from("quelle_ueberblick").insert({
      user_id: userId,
      datei_id: art === "pdf" ? id : null,
      notiz_id: art === "notiz" ? id : null,
      stand,
      inhalt: ergebnis as unknown as Json,
    });
    return { ok: true, daten: ergebnis };
  } catch (err) {
    return alsFehler(err);
  }
}

// ---------------------------------------------------------------------------
// Studio: Lernzettel, FAQ, Briefing, Zeitleiste, Quiz, Karteikarten
// ---------------------------------------------------------------------------

export type StudioErgebnis =
  | { art: Exclude<StudioArt, "quiz" | "karteikarten">; markdown: string; quellen: { nr: number; art: "pdf" | "notiz"; id: string; titel: string }[] }
  | { art: "quiz"; fragen: QuizFrage[]; quellen: { nr: number; art: "pdf" | "notiz"; id: string; titel: string }[] }
  | { art: "karteikarten"; karten: Karte[]; quellen: { nr: number; art: "pdf" | "notiz"; id: string; titel: string }[] };

export async function studioErstellen(lernraumId: string, art: string): Promise<KiErgebnis<StudioErgebnis>> {
  try {
    if (!istStudioArt(art)) throw new KiEingabe("Unbekannte Art.");
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    const raum = await raumLaden(supabase, lernraumId);
    const [liste, { data: settings }] = await Promise.all([
      quellenListe(supabase, raum.id, raum.fachId),
      supabase.from("settings").select("ki_profil").eq("user_id", userId).maybeSingle(),
    ]);
    const quellen = await quellenTexte(supabase, liste);
    if (!quellen.some((q) => q.abschnitte.length)) throw new KiKeineDaten("Im Lernraum sind noch keine Quellen mit Text. Füge PDFs oder Notizen hinzu.");
    const kontext = kontextBauen(quellen, raum.fach, MAX_KONTEXT_GANZ);
    const p = studioPrompt(art, raum.fach, quellen, kontext.text, profilLesen(settings?.ki_profil));
    const infos = quellen.map((q) => ({ nr: q.nr, art: q.art, id: q.id, titel: q.titel }));
    const { ergebnis } = await textAnfrageAusfuehren({
      supabase,
      funktion: `lernraum_${art}`,
      zweck: "stark",
      optionen: { system: p.system, nutzer: p.nutzer, json: STUDIO[art].json, temperatur: 0.3, maxTokens: 4000, timeoutMs: 110_000 },
      parsen: (a): StudioErgebnis => {
        if (art === "quiz") {
          const fragen = quizLesen(a.text);
          if (!fragen.length) throw new KiKeineDaten("Das Quiz konnte nicht erstellt werden. Bitte versuch es noch einmal.");
          return { art, fragen, quellen: infos };
        }
        if (art === "karteikarten") {
          const karten = kartenLesen(a.text);
          if (!karten.length) throw new KiKeineDaten("Die Karteikarten konnten nicht erstellt werden. Bitte versuch es noch einmal.");
          return { art, karten, quellen: infos };
        }
        if (!a.text.trim()) throw new KiKeineDaten("Es kam keine Antwort. Bitte versuch es noch einmal.");
        return { art, markdown: a.text.trim(), quellen: infos };
      },
    });
    return { ok: true, daten: ergebnis };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Karteikarten aus dem Studio als neuen Stapel im Fach speichern */
export async function kartenAlsStapel(lernraumId: string, karten: { vorderseite: string; rueckseite: string }[]): Promise<{ stapelId: string }> {
  const { supabase, userId } = await nutzer();
  const raum = await raumLaden(supabase, lernraumId);
  const gueltig = karten.filter((k) => k.vorderseite?.trim() && k.rueckseite?.trim()).slice(0, 50);
  if (!gueltig.length) throw new Error("Keine Karten.");
  const name = `${raum.fach} – Lernraum ${new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`;
  const { data: stapel, error } = await supabase.from("kk_stapel").insert({ user_id: userId, name, fach_id: raum.fachId }).select("id").single();
  if (error) throw new Error(error.message);
  const { error: kartenFehler } = await supabase.from("kk_karte").insert(
    gueltig.map((k) => ({ user_id: userId, stapel_id: stapel.id, vorderseite: k.vorderseite.slice(0, 2000), rueckseite: k.rueckseite.slice(0, 5000), ki_erzeugt: true })),
  );
  if (kartenFehler) throw new Error(kartenFehler.message);
  revalidatePath("/karteikarten");
  return { stapelId: stapel.id };
}

/** Antwort oder Studio-Ergebnis als Notiz im Fach speichern – Belege werden zu [[Verlinkungen]] */
export async function alsNotizSpeichern(
  lernraumId: string,
  titel: string,
  markdown: string,
  quellen: { nr: number; art: "pdf" | "notiz"; titel: string }[],
): Promise<{ notizId: string }> {
  const { supabase, userId } = await nutzer();
  const raum = await raumLaden(supabase, lernraumId);
  const inhalt = `${belegeAlsWikilinks(markdown, quellen)}\n\n#lernraum`;
  const { data, error } = await supabase
    .from("notiz")
    .insert({ user_id: userId, fach_id: raum.fachId, titel: titel.slice(0, 300), inhalt: inhalt.slice(0, 200_000), ki_erzeugt: true })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/notizen");
  return { notizId: data.id };
}

// ---------------------------------------------------------------------------
// Lernprofil und Verlauf
// ---------------------------------------------------------------------------

export async function lernprofilRueckmeldung(rueckmeldung: Rueckmeldung): Promise<Lernprofil> {
  const { supabase, userId } = await nutzer();
  const { data } = await supabase.from("settings").select("ki_profil").eq("user_id", userId).maybeSingle();
  const neu = profilAnpassen(profilLesen(data?.ki_profil), rueckmeldung);
  await supabase.from("settings").update({ ki_profil: neu as unknown as Json }).eq("user_id", userId);
  return neu;
}

export async function lernprofilSetzen(profil: Lernprofil): Promise<Lernprofil> {
  const { supabase, userId } = await nutzer();
  const sauber = profilLesen(profil);
  await supabase.from("settings").update({ ki_profil: sauber as unknown as Json }).eq("user_id", userId);
  return sauber;
}

export async function verlaufLeeren(lernraumId: string) {
  const { supabase } = await nutzer();
  const { error } = await supabase.from("lernraum_nachricht").delete().eq("lernraum_id", lernraumId);
  if (error) throw new Error(error.message);
}
