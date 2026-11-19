"use server";

import { materialPapierkorb } from "@/app/(hubs)/dateiablage/workflow-actions";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { persoenlichKontext, themenAktualisieren } from "@/lib/ki/gedaechtnis-server";
import { KiEingabe } from "@/lib/ki/fehler";
import { alsFehler, kiNutzer, type KiErgebnis } from "@/lib/ki/server";
import { materialLaden, mitBuchung, quizErzeugen, type QuellAuswahl, type QuellInfo } from "@/lib/ki/quiz-server";
import {
  alsKarte,
  bewertungLesen,
  bewertungPrompt,
  einstellungenLesen,
  fragenLesen,
  schwaechen,
  versuchAntwortenLesen,
  type Bewertung,
  type QuizFrage,
} from "@/lib/ki/quiz";
import type { Json } from "@/lib/supabase/types";

function auswahlPruefen(roh: unknown): QuellAuswahl[] {
  return (Array.isArray(roh) ? roh : [])
    .filter((q): q is QuellAuswahl => !!q && typeof q === "object" && ((q as QuellAuswahl).art === "pdf" || (q as QuellAuswahl).art === "notiz") && typeof (q as QuellAuswahl).id === "string")
    .slice(0, 30);
}

/** Neues Quiz aus PDFs/Notizen oder einem ganzen Fach (stärkstes Modell) */
export async function quizErstellen(eingabe: {
  quellen: QuellAuswahl[];
  fachId: string | null;
  einstellungen: unknown;
  titel?: string;
}): Promise<KiErgebnis<{ id: string }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const einstellungen = einstellungenLesen(eingabe.einstellungen);
    const fachId = typeof eingabe.fachId === "string" && eingabe.fachId ? eingabe.fachId : null;
    const ergebnis = await mitBuchung(supabase, userId, "quiz", "stark", async (anfrage) => {
      const material = await materialLaden(supabase, userId, auswahlPruefen(eingabe.quellen), fachId);
      const persoenlich = await persoenlichKontext(supabase, material.fachName ?? "", fachId).catch(() => "");
      const quiz = await quizErzeugen(anfrage, material, einstellungen, [], persoenlich);
      return { ...quiz, info: material.info, fachName: material.fachName };
    });
    const titel = (eingabe.titel?.trim() || ergebnis.titel || (ergebnis.fachName ? `Quiz ${ergebnis.fachName}` : "Quiz")).slice(0, 200);
    const { data, error } = await supabase
      .from("quiz")
      .insert({
        user_id: userId,
        titel,
        fach_id: fachId,
        quellen: ergebnis.info as unknown as Json,
        fragen: ergebnis.fragen as unknown as Json,
        einstellungen: einstellungen as unknown as Json,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    revalidatePath("/karteikarten");
    return { ok: true, daten: { id: data.id } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Adaptiv: neue Fragen zu den Themen, bei denen zuletzt Fehler passiert sind */
export async function quizSchwaechenErweitern(quizId: string): Promise<KiErgebnis<{ neu: QuizFrage[] }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const [{ data: quiz }, { data: versuche }] = await Promise.all([
      supabase.from("quiz").select("id, fach_id, quellen, fragen, einstellungen").eq("id", quizId).maybeSingle(),
      supabase.from("quiz_versuch").select("antworten").eq("quiz_id", quizId).order("erstellt_am", { ascending: false }).limit(5),
    ]);
    if (!quiz) throw new KiEingabe("Quiz nicht gefunden.");
    const fragen = fragenLesen(quiz.fragen);
    const { themen } = schwaechen(fragen, (versuche ?? []).map((v) => ({ antworten: versuchAntwortenLesen(v.antworten) })));
    if (!themen.length) throw new KiEingabe("Du hast noch keine Schwächen – mach erst einen Durchgang.");
    const quellen = ((quiz.quellen ?? []) as unknown as QuellInfo[]).map((q) => ({ art: q.art, id: q.id }));
    const einstellungen = { ...einstellungenLesen(quiz.einstellungen), anzahl: 6 };
    const neu = await mitBuchung(supabase, userId, "quiz", "stark", async (anfrage) => {
      const material = await materialLaden(supabase, userId, quellen, quiz.fach_id);
      const persoenlich = await persoenlichKontext(supabase, themen.join(" "), quiz.fach_id).catch(() => "");
      return (await quizErzeugen(anfrage, material, einstellungen, themen, persoenlich)).fragen;
    });
    const { error } = await supabase
      .from("quiz")
      .update({ fragen: [...fragen, ...neu].slice(0, 120) as unknown as Json })
      .eq("id", quizId);
    if (error) throw new Error(error.message);
    return { ok: true, daten: { neu } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Freie Antwort von der KI bewerten lassen (schnelles Modell) */
export async function freiBewerten(quizId: string, frageId: string, antwort: string): Promise<KiErgebnis<Bewertung>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const text = String(antwort ?? "").trim();
    if (!text) return { ok: true, daten: { punkte: 0, richtig: false, feedback: "Keine Antwort – schau dir die Musterlösung an." } };
    const { data: quiz } = await supabase.from("quiz").select("fragen").eq("id", quizId).maybeSingle();
    const frage = fragenLesen(quiz?.fragen).find((f) => f.id === frageId);
    if (!frage || frage.typ !== "frei") throw new KiEingabe("Frage nicht gefunden.");
    const bewertung = await mitBuchung(supabase, userId, "quiz_bewertung", "chat", async (anfrage) => {
      const p = bewertungPrompt(frage, text);
      const a = await anfrage({ system: p.system, nutzer: p.nutzer, json: true, temperatur: 0, maxTokens: 600, timeoutMs: 30_000 });
      return bewertungLesen(a.text);
    });
    return { ok: true, daten: bewertung };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function versuchSpeichern(
  quizId: string,
  modus: "alle" | "schwaechen",
  antworten: { frageId: string; punkte: number; antwort?: unknown }[],
): Promise<{ ok: boolean }> {
  const { supabase, userId } = await kiNutzer();
  const sauber = versuchAntwortenLesen(antworten).slice(0, 150);
  const punkte = sauber.reduce((n, a) => n + a.punkte, 0);
  const { error } = await supabase
    .from("quiz_versuch")
    .insert({ user_id: userId, quiz_id: quizId, modus, antworten: sauber as unknown as Json, punkte, max_punkte: sauber.length });
  if (!error) await supabase.from("quiz").update({ geaendert_am: new Date().toISOString() }).eq("id", quizId);
  // Persönliches Modell: Ergebnisse je Thema in den Wissensstand übernehmen (nach der Antwort)
  if (!error && sauber.length) {
    after(async () => {
      const { data: quiz } = await supabase.from("quiz").select("fach_id, fragen").eq("id", quizId).maybeSingle();
      if (!quiz) return;
      const fragen = fragenLesen(quiz.fragen);
      const ergebnisse = sauber.flatMap((a) => {
        const f = fragen.find((x) => x.id === a.frageId);
        return f ? [{ thema: f.thema, punkte: a.punkte, fehler: a.punkte < 1 ? f.frage.slice(0, 160) : null }] : [];
      });
      await themenAktualisieren(supabase, userId, quiz.fach_id, ergebnisse).catch(() => undefined);
    });
  }
  revalidatePath("/karteikarten");
  return { ok: !error };
}

/** Falsch beantwortete Fragen als Karteikarten-Stapel speichern – so landen Schwächen im Wiederholungssystem */
export async function falscheAlsKarten(quizId: string, frageIds: string[]): Promise<KiErgebnis<{ stapelId: string }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const { data: quiz } = await supabase.from("quiz").select("titel, fach_id, fragen").eq("id", quizId).maybeSingle();
    if (!quiz) throw new KiEingabe("Quiz nicht gefunden.");
    const fragen = fragenLesen(quiz.fragen).filter((f) => frageIds.includes(f.id)).slice(0, 60);
    if (!fragen.length) throw new KiEingabe("Keine Fragen ausgewählt.");
    const { data: stapel, error } = await supabase
      .from("kk_stapel")
      .insert({ user_id: userId, name: `Schwächen: ${quiz.titel}`.slice(0, 120), fach_id: quiz.fach_id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: kartenFehler } = await supabase.from("kk_karte").insert(
      fragen.map((f) => {
        const k = alsKarte(f);
        return { user_id: userId, stapel_id: stapel.id, vorderseite: k.vorderseite.slice(0, 2000), rueckseite: k.rueckseite.slice(0, 5000), ki_erzeugt: true };
      }),
    );
    if (kartenFehler) throw new Error(kartenFehler.message);
    revalidatePath("/karteikarten");
    return { ok: true, daten: { stapelId: stapel.id } };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function quizUmbenennen(id: string, titel: string): Promise<{ ok: boolean }> {
  const { supabase } = await kiNutzer();
  const t = titel.trim().slice(0, 200);
  if (!t) return { ok: false };
  const { error } = await supabase.from("quiz").update({ titel: t }).eq("id", id);
  revalidatePath("/karteikarten");
  return { ok: !error };
}

export async function quizLoeschen(id: string): Promise<{ ok: boolean }> {
  try {
    await materialPapierkorb({ art: "quiz", id }, true);
    return { ok: true };
  } catch { return { ok: false }; }
}
