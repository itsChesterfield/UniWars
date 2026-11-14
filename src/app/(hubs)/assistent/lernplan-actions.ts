"use server";

import { revalidatePath } from "next/cache";
import { agentLauf } from "@/lib/ki/agent";
import { kiAnfrageStream, kiKonfiguriert } from "@/lib/ki/anbieter";
import { karteAusfuehren, karteMitAenderung, type KartenAenderung } from "@/lib/ki/aktionskarten-server";
import { datumText, type Aktionskarte, type KartenStatus } from "@/lib/ki/assistent";
import { KiEingabe, KiFehler } from "@/lib/ki/fehler";
import { hatDaten, lernplanPrompt, LERNPLAN_WERKZEUGE, mitGrund, tagesvorschlaegeLesen, type Lagebild, type Tagesvorschlag } from "@/lib/ki/lernplan";
import { alsFehler, kiNutzer, nutzungAbschliessen, textBuchen, textEingewilligt, type KiErgebnis, type Supabase } from "@/lib/ki/server";
import { lesewerkzeuge } from "@/lib/ki/werkzeuge/lesen";
import { umfeldLaden, vorschlagswerkzeuge } from "@/lib/ki/werkzeuge/vorschlagen";
import type { Json } from "@/lib/supabase/types";
import { berlinDatum } from "@/lib/zeit";

/** Ein Lauf, der länger „läuft“, gilt als abgebrochen und darf neu starten. */
const LAUF_VERALTET_MS = 2 * 60_000;

export type TagesStand =
  | { status: "aus"; grund: "konfiguration" | "einwilligung" }
  | { status: "leer" }
  | { status: "laeuft" }
  | { status: "fehler"; fehler: string }
  | { status: "fertig"; vorschlaege: Tagesvorschlag[]; neuMoeglich: boolean; neuErzeugt: boolean };

type Zeile = { id: string; status: string; vorschlaege: Json; neu_erstellt: boolean; geaendert_am: string };

function plusTage(jetzt: Date, tage: number): string {
  return berlinDatum(new Date(jetzt.getTime() + tage * 86_400_000));
}

/** Dieselben Lese-Werkzeuge wie der Assistent (8.3), direkt aufgerufen und gebündelt. */
async function lagebildLaden(supabase: Supabase, jetzt: Date): Promise<Lagebild> {
  const w = new Map(lesewerkzeuge(supabase, jetzt).map((x) => [x.name, x]));
  const rufen = (name: string, args: Record<string, unknown> = {}) => w.get(name)!.ausfuehren(args) as Promise<Record<string, unknown>>;
  const heute = berlinDatum(jetzt);
  const [faecher, pruefungen, deadlines, todos, karten, stundenplan, lernzeit] = await Promise.all([
    rufen("faecher_auflisten"),
    rufen("pruefungen_lesen", { von: heute, bis: plusTage(jetzt, 21) }),
    rufen("deadlines_lesen", { von: heute, bis: plusTage(jetzt, 7) }),
    rufen("todos_lesen"),
    rufen("karteikarten_status"),
    rufen("stundenplan_lesen", { von: heute, bis: heute }),
    rufen("lernzeit_lesen"),
  ]);
  return {
    faecher: (faecher.faecher as unknown[]) ?? [],
    pruefungen: (pruefungen.pruefungen as unknown[]) ?? [],
    deadlines: (deadlines.deadlines as unknown[]) ?? [],
    todos_offen: ((todos.todos as { titel: string; fach: string | null; faellig: string | null }[]) ?? []).slice(0, 20).map(({ titel, fach, faellig }) => ({ titel, fach, faellig })),
    stapel: (karten.stapel as Lagebild["stapel"]) ?? [],
    stundenplan_heute: (stundenplan.termine as unknown[]) ?? [],
    lernzeit_7_tage: lernzeit as Lagebild["lernzeit_7_tage"],
  };
}

function fertig(z: Pick<Zeile, "vorschlaege" | "neu_erstellt">, neuErzeugt = false): TagesStand {
  return { status: "fertig", vorschlaege: tagesvorschlaegeLesen(z.vorschlaege), neuMoeglich: !z.neu_erstellt, neuErzeugt };
}

const FEHLER_TEXT = "Heute hat es mit den Vorschlägen nicht geklappt.";

/**
 * KI-05: Vorschläge für heute. Einmal pro Tag beim ersten Öffnen des Dashboards erzeugt
 * (kein Cronjob), danach aus `ki_tagesvorschlag` wiederverwendet.
 * `neu`: „Neu erstellen“ (einmal pro Tag) oder nach einem Fehler erneut versuchen.
 */
export async function tagesvorschlaege(modus: "laden" | "neu" = "laden"): Promise<KiErgebnis<TagesStand>> {
  try {
    const { supabase, userId } = await kiNutzer();
    if (!kiKonfiguriert()) return { ok: true, daten: { status: "aus", grund: "konfiguration" } };
    if (!(await textEingewilligt(supabase, userId))) return { ok: true, daten: { status: "aus", grund: "einwilligung" } };

    const jetzt = new Date();
    const datum = berlinDatum(jetzt);
    const { data: vorhanden } = await supabase
      .from("ki_tagesvorschlag")
      .select("id, status, vorschlaege, neu_erstellt, geaendert_am")
      .eq("datum", datum)
      .maybeSingle();

    let id: string;
    let neuErstellt = false;
    if (vorhanden) {
      const z = vorhanden as Zeile;
      const veraltet = Date.now() - new Date(z.geaendert_am).getTime() > LAUF_VERALTET_MS;
      if (z.status === "laeuft" && !veraltet) return { ok: true, daten: { status: "laeuft" } };
      if (modus === "laden") {
        if (z.status === "fertig") return { ok: true, daten: fertig(z) };
        if (z.status === "fehler") return { ok: true, daten: { status: "fehler", fehler: FEHLER_TEXT } };
      } else if (z.status === "fertig" && z.neu_erstellt) {
        throw new KiEingabe("Du kannst die Vorschläge nur einmal am Tag neu erstellen.");
      }
      neuErstellt = z.neu_erstellt || (modus === "neu" && z.status === "fertig");
      // Bedingt übernehmen: Gewinnt ein zweiter Tab, wartet dieser hier nur.
      const { data: uebernommen } = await supabase
        .from("ki_tagesvorschlag")
        .update({ status: "laeuft", neu_erstellt: neuErstellt })
        .eq("id", z.id)
        .eq("geaendert_am", z.geaendert_am)
        .select("id");
      if (!uebernommen?.length) return { ok: true, daten: { status: "laeuft" } };
      id = z.id;
    } else {
      // Datensparsamkeit: Vorschläge vergangener Tage werden nicht mehr gebraucht
      await supabase.from("ki_tagesvorschlag").delete().lt("datum", datum);
      const { data: neu, error } = await supabase.from("ki_tagesvorschlag").insert({ user_id: userId, datum, status: "laeuft" }).select("id").single();
      if (error || !neu) {
        if (error?.code === "23505") return { ok: true, daten: { status: "laeuft" } };
        throw new Error(error?.message ?? "Anlegen fehlgeschlagen");
      }
      id = neu.id;
    }

    try {
      const lage = await lagebildLaden(supabase, jetzt);
      if (!hatDaten(lage)) {
        // Neuer Nutzer: kein KI-Aufruf, feste Karte in der Oberfläche
        await supabase.from("ki_tagesvorschlag").delete().eq("id", id);
        return { ok: true, daten: { status: "leer" } };
      }

      const buchung = await textBuchen(supabase, "ki05");
      const umfeld = await umfeldLaden(supabase);
      const karten: Aktionskarte[] = [];
      const gruende = new Map<string, string>();
      const erlaubt = new Set<string>(LERNPLAN_WERKZEUGE);
      const werkzeuge = vorschlagswerkzeuge({ ...umfeld, jetzt }, karten)
        .filter((w) => erlaubt.has(w.name))
        .map((w) => mitGrund(w, karten, gruende));
      const prompt = lernplanPrompt(lage, datumText(jetzt.toISOString(), false));

      let tokens = { tokensEin: 0, tokensAus: 0 };
      let fehler: KiFehler | null = null;
      try {
        for await (const e of agentLauf({
          rufen: (o) => kiAnfrageStream(o, "chat"),
          optionen: { maxTokens: 900, temperatur: 0.3 },
          nachrichten: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.nutzer },
          ],
          werkzeuge,
          maxRunden: 2,
        })) {
          if (e.typ === "fehler") fehler = e.fehler;
          else if (e.typ === "ende") tokens = { tokensEin: e.tokensEin, tokensAus: e.tokensAus };
        }
      } finally {
        await nutzungAbschliessen(supabase, buchung.nutzungId, { ...tokens, erfolgreich: karten.length > 0 || !fehler });
      }
      // Vorschläge, die schon da sind, zählen auch, wenn das Modell danach noch weiter wollte
      if (fehler && karten.length === 0) throw fehler;

      const vorschlaege: Tagesvorschlag[] = karten.map((karte) => ({ grund: gruende.get(karte.id) ?? "", karte }));
      await supabase
        .from("ki_tagesvorschlag")
        .update({ status: "fertig", vorschlaege: vorschlaege as unknown as Json })
        .eq("id", id);
      return { ok: true, daten: fertig({ vorschlaege: vorschlaege as unknown as Json, neu_erstellt: neuErstellt }, true) };
    } catch (err) {
      await supabase.from("ki_tagesvorschlag").update({ status: "fehler" }).eq("id", id);
      throw err;
    }
  } catch (err) {
    return alsFehler(err);
  }
}

async function heutigeKarte(supabase: Supabase, karteId: string) {
  const { data } = await supabase
    .from("ki_tagesvorschlag")
    .select("id, vorschlaege")
    .eq("datum", berlinDatum(new Date()))
    .eq("status", "fertig")
    .maybeSingle();
  const vorschlaege = tagesvorschlaegeLesen(data?.vorschlaege);
  const eintrag = vorschlaege.find((v) => v.karte.id === karteId);
  if (!data || !eintrag) throw new KiEingabe("Dieser Vorschlag ist nicht mehr aktuell.");
  return { id: data.id, vorschlaege, karte: eintrag.karte };
}

async function karteSetzen(supabase: Supabase, zeileId: string, vorschlaege: Tagesvorschlag[], karte: Aktionskarte, status: KartenStatus, ergebnisId: string | null) {
  const neu = vorschlaege.map((v) => (v.karte.id === karte.id ? { ...v, karte: { ...karte, status, ...(ergebnisId ? { ergebnisId } : {}) } } : v));
  const { error } = await supabase
    .from("ki_tagesvorschlag")
    .update({ vorschlaege: neu as unknown as Json })
    .eq("id", zeileId);
  if (error) throw new Error(error.message);
}

/** „Starten“ / „Übernehmen“: erst jetzt wird etwas angelegt (KI-ALL-01). */
export async function tagesKarteUebernehmen(
  karteId: string,
  aenderung: KartenAenderung | null = null,
): Promise<KiErgebnis<{ karte: Aktionskarte; link: string | null }>> {
  try {
    const { supabase } = await kiNutzer();
    const { id, vorschlaege, karte } = await heutigeKarte(supabase, karteId);
    const k = await karteMitAenderung(supabase, karte, aenderung);
    const { ergebnisId, link } = await karteAusfuehren(supabase, k);
    await karteSetzen(supabase, id, vorschlaege, k, "uebernommen", ergebnisId);
    revalidatePath("/");
    return { ok: true, daten: { karte: { ...k, status: "uebernommen", ergebnisId }, link } };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function tagesKarteAusblenden(karteId: string): Promise<KiErgebnis<null>> {
  try {
    const { supabase } = await kiNutzer();
    const { id, vorschlaege, karte } = await heutigeKarte(supabase, karteId);
    if (karte.status === "offen") await karteSetzen(supabase, id, vorschlaege, karte, "verworfen", null);
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}
