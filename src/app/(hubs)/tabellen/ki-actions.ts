"use server";

import { KiEingabe } from "@/lib/ki/fehler";
import { formelPromptBauen, formelVorschlagParsen, type FormelVorschlag } from "@/lib/ki/formel";
import { alsFehler, kiNutzer, textAnfrageAusfuehren, textVoraussetzungen, type KiErgebnis } from "@/lib/ki/server";
import { adresse, datenLesen, zerlegen } from "@/lib/tabellen/formeln";

/**
 * KI-10: Formel vorschlagen. Die Tabelle lädt der Server selbst (RLS) – an die KI gehen
 * nur die Spaltenüberschriften aus Zeile 1, keine Zellinhalte.
 */
export async function formelVorschlagen(tabelleId: string, zielZelle: string, beschreibung: string): Promise<KiErgebnis<FormelVorschlag & { verbleibendHeute: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);
    const { data } = await supabase.from("tabelle").select("daten").eq("id", tabelleId).maybeSingle();
    if (!data) throw new KiEingabe("Tabelle nicht gefunden.");
    const tabelle = datenLesen(data.daten);
    const ziel = String(zielZelle ?? "").toUpperCase();
    if (!zerlegen(ziel)) throw new KiEingabe("Wähle zuerst eine Zelle aus.");
    const kopfzeile = Array.from({ length: tabelle.spalten }, (_, s) => {
      const w = tabelle.zellen[adresse(s, 0)]?.w ?? "";
      return w.startsWith("=") ? "" : w;
    });
    const kontext = { kopfzeile, spalten: tabelle.spalten, zeilen: tabelle.zeilen, ziel };
    const prompt = formelPromptBauen(typeof beschreibung === "string" ? beschreibung : "", kontext);
    const { ergebnis, verbleibend } = await textAnfrageAusfuehren({
      supabase,
      funktion: "formel",
      optionen: { system: prompt.system, nutzer: prompt.nutzer, json: true, temperatur: 0, maxTokens: 300 },
      parsen: (a) => formelVorschlagParsen(a.text, kontext),
    });
    return { ok: true, daten: { ...ergebnis, verbleibendHeute: verbleibend } };
  } catch (err) {
    return alsFehler(err);
  }
}
