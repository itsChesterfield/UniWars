"use server";

import { revalidatePath } from "next/cache";
import { alsFehler, kiNutzer, type KiErgebnis } from "@/lib/ki/server";
import { gedaechtnisLaden, merken } from "@/lib/ki/gedaechtnis-server";
import { istBereich, kennenlernenEintraege, kennenlernenStatus, rueckblick, type Eintrag } from "@/lib/ki/gedaechtnis";
import { profilAnpassen, profilLesen, type Rueckmeldung } from "@/lib/ki/lernraum";
import type { Json } from "@/lib/supabase/types";

const PFAD = "/einstellungen/gedaechtnis";

export async function gedaechtnisStatusSetzen(id: string, status: "aktiv" | "verworfen"): Promise<{ ok: boolean }> {
  const { supabase } = await kiNutzer();
  const { error } = await supabase.from("ki_gedaechtnis").update({ status, ...(status === "aktiv" ? { sicherheit: 1 } : {}) }).eq("id", id);
  revalidatePath(PFAD);
  return { ok: !error };
}

export async function gedaechtnisBearbeiten(id: string, inhalt: string): Promise<{ ok: boolean }> {
  const t = inhalt.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!t) return { ok: false };
  const { supabase } = await kiNutzer();
  const { error } = await supabase.from("ki_gedaechtnis").update({ inhalt: t, quelle: "ausdruecklich", sicherheit: 1, status: "aktiv" }).eq("id", id);
  revalidatePath(PFAD);
  return { ok: !error };
}

export async function gedaechtnisLoeschen(id: string): Promise<{ ok: boolean }> {
  const { supabase } = await kiNutzer();
  const { error } = await supabase.from("ki_gedaechtnis").delete().eq("id", id);
  revalidatePath(PFAD);
  return { ok: !error };
}

export async function gedaechtnisHinzufuegen(bereich: string, inhalt: string): Promise<KiErgebnis<{ id: string }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const t = inhalt.replace(/\s+/g, " ").trim();
    if (!istBereich(bereich) || !t) return { ok: false, fehler: "Bitte Bereich und Text angeben.", typ: "eingabe" };
    const id = await merken(supabase, userId, bereich, t);
    revalidatePath(PFAD);
    return { ok: true, daten: { id } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Alles vergessen: Gedächtnis, Wissensstand und Kennenlernen */
export async function gedaechtnisAllesLoeschen(): Promise<{ ok: boolean }> {
  const { supabase, userId } = await kiNutzer();
  const [a, b] = await Promise.all([
    supabase.from("ki_gedaechtnis").delete().eq("user_id", userId),
    supabase.from("ki_thema_stand").delete().eq("user_id", userId),
    supabase.from("settings").update({ ki_kennenlernen: {} }).eq("user_id", userId),
  ]);
  revalidatePath(PFAD);
  return { ok: !a.error && !b.error };
}

export async function gedaechtnisLernenSetzen(an: boolean): Promise<{ ok: boolean }> {
  const { supabase, userId } = await kiNutzer();
  const { error } = await supabase.from("settings").update({ ki_gedaechtnis_an: an }).eq("user_id", userId);
  revalidatePath(PFAD);
  return { ok: !error };
}

// ---------------------------------------------------------------------------
// Kennenlernen
// ---------------------------------------------------------------------------

export type StudioPersoenlich = {
  kennenlernen: "neu" | "auffrischen" | "fertig";
  /** Beim Auffrischen: Ziele und Rahmen, die bestätigt oder geändert werden sollen */
  auffrischen: { id: string; inhalt: string }[];
  /** Neu Gelerntes der letzten 30 Tage (Monatsrückblick) */
  rueckblick: { id: string; inhalt: string }[];
  lernenAn: boolean;
};

export async function studioPersoenlich(): Promise<StudioPersoenlich> {
  const { supabase, userId } = await kiNutzer();
  const [{ data: settings }, eintraege] = await Promise.all([
    supabase.from("settings").select("ki_kennenlernen, ki_gedaechtnis_an").eq("user_id", userId).maybeSingle(),
    gedaechtnisLaden(supabase),
  ]);
  const jetzt = new Date();
  const status = kennenlernenStatus(settings?.ki_kennenlernen, jetzt);
  const kurz = (l: Eintrag[]) => l.map((e) => ({ id: e.id, inhalt: e.inhalt }));
  return {
    kennenlernen: status,
    auffrischen: status === "auffrischen" ? kurz(eintraege.filter((e) => e.status === "aktiv" && (e.bereich === "ziel" || e.bereich === "rahmen")).slice(0, 8)) : [],
    rueckblick: kurz(rueckblick(eintraege, jetzt).slice(0, 12)),
    lernenAn: settings?.ki_gedaechtnis_an !== false,
  };
}

export async function kennenlernenSpeichern(antworten: Record<string, string>): Promise<{ ok: boolean; anzahl: number }> {
  const { supabase, userId } = await kiNutzer();
  const neu = kennenlernenEintraege(antworten);
  if (neu.length) {
    // Alte Kennenlern-Antworten derselben Bereiche ersetzen (z. B. beim Semesterwechsel)
    await supabase
      .from("ki_gedaechtnis")
      .update({ status: "verworfen" })
      .eq("quelle", "kennenlernen")
      .in(
        "bereich",
        neu.map((n) => n.bereich),
      );
    await supabase.from("ki_gedaechtnis").insert(neu.map((n) => ({ user_id: userId, bereich: n.bereich, inhalt: n.inhalt, quelle: "kennenlernen" as const, sicherheit: 1, status: "aktiv" as const, fest: n.fest })));
  }
  await supabase
    .from("settings")
    .update({ ki_kennenlernen: { erledigt_am: new Date().toISOString(), antworten } as unknown as Json })
    .eq("user_id", userId);
  revalidatePath(PFAD);
  return { ok: true, anzahl: neu.length };
}

export async function kennenlernenUeberspringen(): Promise<{ ok: boolean }> {
  const { supabase, userId } = await kiNutzer();
  const { error } = await supabase.from("settings").update({ ki_kennenlernen: { uebersprungen_am: new Date().toISOString() } }).eq("user_id", userId);
  return { ok: !error };
}

/** Semesterwechsel: „Stimmt alles noch“ – Einträge auffrischen, nächste Nachfrage in ~5 Monaten */
export async function kennenlernenBestaetigen(): Promise<{ ok: boolean }> {
  const { supabase, userId } = await kiNutzer();
  const jetzt = new Date().toISOString();
  await supabase.from("ki_gedaechtnis").update({ zuletzt_genutzt: jetzt }).in("bereich", ["ziel", "rahmen"]).eq("status", "aktiv");
  const { data } = await supabase.from("settings").select("ki_kennenlernen").eq("user_id", userId).maybeSingle();
  const alt = (data?.ki_kennenlernen ?? {}) as Record<string, unknown>;
  const { error } = await supabase.from("settings").update({ ki_kennenlernen: { ...alt, erledigt_am: jetzt } as unknown as Json }).eq("user_id", userId);
  return { ok: !error };
}

/** Kennenlernen erneut anbieten (Einstellungen) */
export async function kennenlernenZuruecksetzen(): Promise<{ ok: boolean }> {
  const { supabase, userId } = await kiNutzer();
  const { error } = await supabase.from("settings").update({ ki_kennenlernen: {} }).eq("user_id", userId);
  revalidatePath(PFAD);
  return { ok: !error };
}

// ---------------------------------------------------------------------------
// Rückmeldung unter Antworten → Lernprofil + Gedächtnis
// ---------------------------------------------------------------------------

const RUECKMELDUNG_FAKT: Partial<Record<Rueckmeldung, string>> = {
  einfacher: "möchte Erklärungen einfacher, mit weniger Fachjargon",
  kuerzer: "mag kürzere, knappe Antworten",
  ausfuehrlicher: "mag ausführliche, gründliche Erklärungen",
  beispiele: "lernt am besten mit konkreten Beispielen",
};

export async function studioRueckmeldung(art: Rueckmeldung): Promise<{ ok: boolean }> {
  const { supabase, userId } = await kiNutzer();
  const { data } = await supabase.from("settings").select("ki_profil").eq("user_id", userId).maybeSingle();
  const neu = profilAnpassen(profilLesen(data?.ki_profil), art);
  await supabase.from("settings").update({ ki_profil: neu as unknown as Json }).eq("user_id", userId);
  const fakt = RUECKMELDUNG_FAKT[art];
  if (fakt) {
    // Gegenteilige Einträge (kürzer ↔ ausführlicher) ablösen
    const gegenteil = art === "kuerzer" ? RUECKMELDUNG_FAKT.ausfuehrlicher : art === "ausfuehrlicher" ? RUECKMELDUNG_FAKT.kuerzer : null;
    if (gegenteil) await supabase.from("ki_gedaechtnis").update({ status: "verworfen" }).eq("inhalt", gegenteil);
    await merken(supabase, userId, "lernstil", fakt, "ergebnis");
  }
  return { ok: true };
}
