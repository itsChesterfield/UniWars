"use server";

import { kiAnfrage, kiKonfiguriert } from "@/lib/ki/anbieter";
import { kiNutzer, textEingewilligt, type Supabase } from "@/lib/ki/server";
import { persoenlichKontext } from "@/lib/ki/gedaechtnis-server";
import { anwenden, briefingLesen, briefingPrompt, standardGruss, tageszeit, ueberschriftenFuer, vorschlaegeBerechnen, type KiBriefing, type Lage, type Vorschlag } from "@/lib/ki/briefing";
import { PERSOENLICHKEITEN, profilLesen } from "@/lib/ki/lernraum";
import { berlinDatum, berlinMitternacht, berlinUhrzeit, berlinWochentag } from "@/lib/zeit";
import type { Json } from "@/lib/supabase/types";

const WOCHENTAG_NAME: Record<string, string> = { MO: "Montag", DI: "Dienstag", MI: "Mittwoch", DO: "Donnerstag", FR: "Freitag", SA: "Samstag", SO: "Sonntag" };

export type Briefing = {
  gruss: string;
  /** Begrüßung und Gründe stammen von der KI (sonst aus den Daten) */
  vonKi: boolean;
  /** KI-Text kann (noch) erzeugt werden */
  kiMoeglich: boolean;
  vorschlaege: Vorschlag[];
  /** Überschriften zur Auswahl (bei jedem Öffnen eine andere) */
  ueberschriften: string[];
};

type Speicher = { typ: "briefing"; texte: Record<string, { sig: string; ki: KiBriefing }> };

async function lageLaden(supabase: Supabase, userId: string, email: string | undefined): Promise<{ lage: Lage; profil: unknown }> {
  const jetzt = new Date();
  const heute = berlinDatum(jetzt);
  const tag = berlinWochentag(jetzt);
  const in3Tagen = new Date(jetzt.getTime() + 3 * 86_400_000).toISOString();
  const in21Tagen = new Date(jetzt.getTime() + 21 * 86_400_000).toISOString();
  const gesternStart = berlinMitternacht(heute, -1).toISOString();
  const heuteStart = berlinMitternacht(heute).toISOString();
  const uhr = berlinUhrzeit(jetzt);

  const [{ data: settings }, { data: faecher }, { data: stunden }, { data: deadlines }, { data: pruefungen }, { data: karten }, { data: schwach }, { count: todos }, { data: sitzungen }] =
    await Promise.all([
      supabase.from("settings").select("username, streak_count, ki_profil").eq("user_id", userId).maybeSingle(),
      supabase.from("fach").select("id, name"),
      supabase.from("stundenplan_eintrag").select("fach_id, start_zeit, end_zeit, raum").eq("tag", tag).order("start_zeit"),
      supabase.from("deadline").select("id, titel, faellig_am, fach_id").eq("erledigt", false).gte("faellig_am", jetzt.toISOString()).lte("faellig_am", in3Tagen).order("faellig_am").limit(10),
      supabase.from("pruefung").select("id, titel, datum, fach_id").eq("status", "ANSTEHEND").gte("datum", heuteStart).lte("datum", in21Tagen).order("datum").limit(5),
      supabase.from("kk_karte").select("stapel_id, stapel:stapel_id(name)").lte("naechste_abfrage", jetzt.toISOString()).limit(1000),
      supabase.from("ki_thema_stand").select("thema, fach_id").lt("beherrschung", 0.45).order("beherrschung").limit(3),
      supabase.from("todo").select("id", { count: "exact", head: true }).eq("erledigt", false).is("parent_id", null),
      supabase.from("lern_session").select("dauer_minuten").gte("start", gesternStart).lt("start", heuteStart),
    ]);
  const fachName = (id: string | null | undefined) => (faecher ?? []).find((f) => f.id === id)?.name ?? null;
  const proStapel = new Map<string, { name: string; anzahl: number }>();
  for (const k of karten ?? []) {
    const s = proStapel.get(k.stapel_id) ?? { name: (k.stapel as { name?: string } | null)?.name ?? "Karteikarten", anzahl: 0 };
    s.anzahl++;
    proStapel.set(k.stapel_id, s);
  }
  const name = (settings?.username || email?.split("@")[0] || "").split(/[\s._-]/)[0];
  return {
    profil: settings?.ki_profil,
    lage: {
      name: name ? name.charAt(0).toUpperCase() + name.slice(1) : "",
      stunde: Number(uhr.slice(0, 2)),
      wochentagName: WOCHENTAG_NAME[tag] ?? "",
      vorlesungen: (stunden ?? [])
        .filter((s) => s.end_zeit.slice(0, 5) > uhr)
        .map((s) => ({ fach: fachName(s.fach_id) ?? "Vorlesung", start: s.start_zeit, ende: s.end_zeit, raum: s.raum })),
      deadlines: (deadlines ?? []).map((d) => ({ id: d.id, titel: d.titel, faellig_am: d.faellig_am, fach: fachName(d.fach_id), stundenBis: (new Date(d.faellig_am).getTime() - jetzt.getTime()) / 3_600_000 })),
      pruefungen: (pruefungen ?? []).map((p) => ({
        id: p.id,
        titel: p.titel,
        fach: fachName(p.fach_id),
        tageBis: Math.max(0, Math.round((berlinMitternacht(berlinDatum(new Date(p.datum))).getTime() - berlinMitternacht(heute).getTime()) / 86_400_000)),
      })),
      karten: [...proStapel.entries()].map(([stapelId, s]) => ({ stapelId, ...s })),
      schwach: (schwach ?? []).map((s) => ({ thema: s.thema, fach: fachName(s.fach_id), fachId: s.fach_id })),
      todosOffen: todos ?? 0,
      lernzeitGestern: (sitzungen ?? []).reduce((n, s) => n + s.dauer_minuten, 0),
      streak: settings?.streak_count ?? 0,
    },
  };
}

const signatur = (v: Vorschlag[]) => v.map((x) => x.id).sort().join("|");

async function speicherLesen(supabase: Supabase): Promise<{ id: string | null; speicher: Speicher }> {
  const { data } = await supabase.from("ki_tagesvorschlag").select("id, vorschlaege").eq("datum", berlinDatum(new Date())).maybeSingle();
  const roh = (data?.vorschlaege ?? null) as Partial<Speicher> | null;
  return { id: data?.id ?? null, speicher: roh && roh.typ === "briefing" && roh.texte ? (roh as Speicher) : { typ: "briefing", texte: {} } };
}

/** Begrüßung + Vorschläge für heute – sofort aus den Daten, mit KI-Text falls schon erzeugt */
export async function tagesbriefing(): Promise<Briefing | null> {
  try {
    const { supabase, userId } = await kiNutzer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { lage } = await lageLaden(supabase, userId, user?.email);
    const vorschlaege = vorschlaegeBerechnen(lage);
    const zeit = tageszeit(lage.stunde);
    const { speicher } = await speicherLesen(supabase);
    const gespeichert = speicher.texte[zeit];
    const passt = gespeichert && gespeichert.sig === signatur(vorschlaege);
    const kiErlaubt = kiKonfiguriert() && (await textEingewilligt(supabase, userId));
    return {
      gruss: passt ? gespeichert.ki.gruss : standardGruss(lage),
      vonKi: Boolean(passt),
      kiMoeglich: kiErlaubt && !passt,
      vorschlaege: anwenden(vorschlaege, passt ? gespeichert.ki : null),
      ueberschriften: passt && (gespeichert.ki.ueberschriften?.length ?? 0) >= 3 ? gespeichert.ki.ueberschriften : ueberschriftenFuer(lage),
    };
  } catch {
    return null;
  }
}

/** KI schreibt Begrüßung und Gründe (kleines, schnelles Modell); wird je Tageszeit gespeichert */
export async function tagesbriefingKi(): Promise<Briefing | null> {
  try {
    const { supabase, userId } = await kiNutzer();
    if (!kiKonfiguriert() || !(await textEingewilligt(supabase, userId))) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { lage, profil } = await lageLaden(supabase, userId, user?.email);
    const vorschlaege = vorschlaegeBerechnen(lage);
    const ueberPerson = await persoenlichKontext(supabase, vorschlaege.map((v) => v.titel).join(" ")).catch(() => "");
    const p = briefingPrompt(lage, vorschlaege, ueberPerson, PERSOENLICHKEITEN[profilLesen(profil).persoenlichkeit].anweisung);
    const a = await kiAnfrage({ system: p.system, nutzer: p.nutzer, json: true, temperatur: 0.7, maxTokens: 500, timeoutMs: 15_000 }, "schnell");
    const ki = briefingLesen(a.text, vorschlaege);
    if (!ki) return null;
    const zeit = tageszeit(lage.stunde);
    const { id, speicher } = await speicherLesen(supabase);
    const neu: Speicher = { typ: "briefing", texte: { ...speicher.texte, [zeit]: { sig: signatur(vorschlaege), ki } } };
    if (id) await supabase.from("ki_tagesvorschlag").update({ vorschlaege: neu as unknown as Json, status: "fertig" }).eq("id", id);
    else {
      // Alte Tage aufräumen, heutigen Eintrag anlegen
      await supabase.from("ki_tagesvorschlag").delete().lt("datum", berlinDatum(new Date()));
      await supabase.from("ki_tagesvorschlag").insert({ user_id: userId, datum: berlinDatum(new Date()), status: "fertig", vorschlaege: neu as unknown as Json });
    }
    return { gruss: ki.gruss, vonKi: true, kiMoeglich: false, vorschlaege: anwenden(vorschlaege, ki), ueberschriften: ki.ueberschriften.length >= 3 ? ki.ueberschriften : ueberschriftenFuer(lage) };
  } catch {
    return null;
  }
}
