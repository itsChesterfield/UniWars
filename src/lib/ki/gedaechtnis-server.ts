// Persönliches Modell (server-only): Gedächtnis laden, nutzen, dazulernen, pflegen.
import "server-only";
import { kiAnfrage } from "@/lib/ki/anbieter";
import type { Supabase } from "@/lib/ki/server";
import type { Gemerkt } from "@/lib/ki/studio";
import {
  beherrschungNeu,
  eintraegeLesen,
  kompetenzText,
  kontextText,
  lernErgebnisLesen,
  lernPrompt,
  lohntSichLernen,
  MAX_AKTIV,
  rhythmusText,
  zusammenfassenLesen,
  zusammenfassenPrompt,
  type Bereich,
  type Eintrag,
  type Quelle,
  type ThemaStand,
} from "@/lib/ki/gedaechtnis";

export async function gedaechtnisLaden(supabase: Supabase): Promise<Eintrag[]> {
  const { data } = await supabase
    .from("ki_gedaechtnis")
    .select("id, bereich, inhalt, quelle, sicherheit, status, fest, zuletzt_genutzt, erstellt_am")
    .neq("status", "verworfen")
    .order("erstellt_am", { ascending: false })
    .limit(300);
  return eintraegeLesen(data ?? []);
}

export async function lernenAn(supabase: Supabase, userId: string): Promise<boolean> {
  const { data } = await supabase.from("settings").select("ki_gedaechtnis_an").eq("user_id", userId).maybeSingle();
  return data?.ki_gedaechtnis_an !== false;
}

export async function themaStandLaden(supabase: Supabase, fachId?: string | null): Promise<ThemaStand[]> {
  let abfrage = supabase.from("ki_thema_stand").select("thema, beherrschung, versuche, fehlerbild, fach:fach_id(name)").order("aktualisiert_am", { ascending: false }).limit(80);
  if (fachId) abfrage = abfrage.eq("fach_id", fachId);
  const { data } = await abfrage;
  return (data ?? []).map((t) => ({
    thema: t.thema,
    fach: (t.fach as { name?: string } | null)?.name ?? null,
    beherrschung: t.beherrschung,
    versuche: t.versuche,
    fehlerbild: t.fehlerbild,
  }));
}

/**
 * „Über die Person“ für eine Antwort: Gedächtnis (nach Gewicht und Bezug zur Frage),
 * Wissensstand und Lernrhythmus. Markiert die genutzten Einträge (hält sie frisch).
 */
export async function persoenlichKontext(supabase: Supabase, frage: string, fachId?: string | null): Promise<string> {
  const seit = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [eintraege, stand, { data: sitzungen }] = await Promise.all([
    gedaechtnisLaden(supabase),
    themaStandLaden(supabase, fachId),
    supabase.from("lern_session").select("start, dauer_minuten").gte("start", seit).limit(300),
  ]);
  const k = kontextText(eintraege, frage, new Date());
  const kompetenz = kompetenzText(stand);
  const rhythmus = rhythmusText(sitzungen ?? []);
  if (k.ids.length) {
    void supabase
      .from("ki_gedaechtnis")
      .update({ zuletzt_genutzt: new Date().toISOString() })
      .in("id", k.ids)
      .then(() => undefined);
  }
  return [k.text, kompetenz ? `Wissensstand:\n${kompetenz}` : "", rhythmus ? `Rhythmus (aus Lernsitzungen): ${rhythmus}` : ""].filter(Boolean).join("\n");
}

/**
 * Aus einer Nachricht der Person dazulernen (kleines Modell). Liefert, was gemerkt,
 * geändert oder vergessen wurde – für den Chip unter der Antwort.
 */
export async function ausGespraechLernen(
  supabase: Supabase,
  userId: string,
  eingabe: { nachricht: string; vorherigeAntwort: string | null; nachrichtId: string | null },
): Promise<Gemerkt[]> {
  if (!lohntSichLernen(eingabe.nachricht)) return [];
  if (!(await lernenAn(supabase, userId))) return [];
  const bekannt = await gedaechtnisLaden(supabase);
  const p = lernPrompt(bekannt, eingabe.nachricht, eingabe.vorherigeAntwort);
  const a = await kiAnfrage({ system: p.system, nutzer: p.nutzer, json: true, temperatur: 0, maxTokens: 400, timeoutMs: 12_000 }, "schnell");
  const ergebnis = lernErgebnisLesen(a.text, bekannt);
  const gemerkt: Gemerkt[] = [];

  if (ergebnis.neu.length) {
    const { data } = await supabase
      .from("ki_gedaechtnis")
      .insert(
        ergebnis.neu.map((n) => ({
          user_id: userId,
          bereich: n.bereich,
          inhalt: n.inhalt,
          quelle: "gespraech" as const,
          sicherheit: n.sicherheit,
          status: n.status,
          fest: n.fest,
          nachricht_id: eingabe.nachrichtId,
        })),
      )
      .select("id, inhalt, status");
    for (const d of data ?? []) gemerkt.push({ id: d.id, inhalt: d.inhalt, status: d.status === "vorschlag" ? "vorschlag" : "aktiv", art: "neu" });
  }
  for (const r of ergebnis.ersetzen) {
    const { error } = await supabase.from("ki_gedaechtnis").update({ inhalt: r.inhalt, sicherheit: 0.9, quelle: "gespraech", status: "aktiv" }).eq("id", r.id);
    if (!error) gemerkt.push({ id: r.id, inhalt: r.inhalt, status: "aktiv", art: "geaendert" });
  }
  for (const id of ergebnis.vergessen) {
    const e = bekannt.find((x) => x.id === id);
    const { error } = await supabase.from("ki_gedaechtnis").update({ status: "verworfen" }).eq("id", id);
    if (!error && e) gemerkt.push({ id, inhalt: e.inhalt, status: "aktiv", art: "vergessen" });
  }
  return gemerkt;
}

/** Ausdrücklich merken („Merk dir …“): sofort aktiv, auch Sensibles (die Person hat es selbst gewollt) */
export async function merken(supabase: Supabase, userId: string, bereich: Bereich, inhalt: string, quelle: Quelle = "ausdruecklich", fest = false) {
  const bekannt = await gedaechtnisLaden(supabase);
  const doppelt = bekannt.find((e) => e.bereich === bereich && e.inhalt.toLowerCase() === inhalt.toLowerCase());
  if (doppelt) return doppelt.id;
  const { data, error } = await supabase
    .from("ki_gedaechtnis")
    .insert({ user_id: userId, bereich, inhalt: inhalt.slice(0, 300), quelle, sicherheit: 1, status: "aktiv", fest })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** Zu viele aktive Einträge → Ähnliches zusammenführen (im Hintergrund) */
export async function zusammenfassenWennNoetig(supabase: Supabase): Promise<void> {
  const aktiv = (await gedaechtnisLaden(supabase)).filter((e) => e.status === "aktiv");
  if (aktiv.length <= MAX_AKTIV) return;
  const p = zusammenfassenPrompt(aktiv);
  const a = await kiAnfrage({ system: p.system, nutzer: p.nutzer, json: true, temperatur: 0, maxTokens: 1500, timeoutMs: 30_000 }, "schnell");
  for (const g of zusammenfassenLesen(a.text, aktiv)) {
    const [erste, ...rest] = g.ids;
    await supabase.from("ki_gedaechtnis").update({ inhalt: g.inhalt }).eq("id", erste);
    await supabase.from("ki_gedaechtnis").update({ status: "verworfen" }).in("id", rest);
  }
}

/**
 * Lernen aus Ergebnissen: Quiz-Antworten bzw. Karteikarten-Bewertungen je Thema
 * in den Kompetenzstand übernehmen; das letzte Fehlerbild bleibt bis zur Besserung stehen.
 */
export async function themenAktualisieren(
  supabase: Supabase,
  userId: string,
  fachId: string | null,
  ergebnisse: { thema: string; punkte: number; fehler?: string | null }[],
): Promise<void> {
  const proThema = new Map<string, { summe: number; anzahl: number; fehler: string | null }>();
  for (const e of ergebnisse) {
    const thema = e.thema.trim().slice(0, 80);
    if (!thema) continue;
    const t = proThema.get(thema) ?? { summe: 0, anzahl: 0, fehler: null };
    t.summe += e.punkte;
    t.anzahl += 1;
    if (e.punkte < 1 && e.fehler) t.fehler = e.fehler.slice(0, 280);
    proThema.set(thema, t);
  }
  for (const [thema, t] of proThema) {
    let abfrage = supabase.from("ki_thema_stand").select("id, beherrschung, versuche, fehlerbild").eq("thema", thema);
    abfrage = fachId ? abfrage.eq("fach_id", fachId) : abfrage.is("fach_id", null);
    const { data: alt } = await abfrage.maybeSingle();
    const neu = beherrschungNeu(alt ? { beherrschung: alt.beherrschung, versuche: alt.versuche } : null, t.summe / t.anzahl);
    const fehlerbild = neu.beherrschung >= 0.75 ? null : t.fehler ? `Fehler zuletzt bei: ${t.fehler}` : (alt?.fehlerbild ?? null);
    if (alt) {
      await supabase.from("ki_thema_stand").update({ ...neu, fehlerbild, aktualisiert_am: new Date().toISOString() }).eq("id", alt.id);
    } else {
      await supabase.from("ki_thema_stand").insert({ user_id: userId, fach_id: fachId, thema, ...neu, fehlerbild });
    }
  }
}
