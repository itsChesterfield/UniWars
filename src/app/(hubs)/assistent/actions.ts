"use server";

import { revalidatePath } from "next/cache";
import { karteAusfuehren, karteMitAenderung, type KartenAenderung } from "@/lib/ki/aktionskarten-server";
import { werkzeugDatenLesen, type Aktionskarte, type KartenStatus } from "@/lib/ki/assistent";
import { KiEingabe } from "@/lib/ki/fehler";
import { alsFehler, chatStatus, kiNutzer, type KiErgebnis, type Supabase, type TextStatus } from "@/lib/ki/server";
import type { Json } from "@/lib/supabase/types";
import { studioDatenLesen, type StudioDaten } from "@/lib/ki/studio";
import { belegeAlsWikilinks } from "@/lib/ki/lernraum";
import { deleteDeadline } from "@/app/deadline/actions";
import { deleteTodo, toggleTodoErledigt } from "@/app/todo/actions";
import { deletePruefung } from "@/app/pruefung/actions";
import { notizLoeschen, notizSpeichern } from "@/app/(hubs)/notizen/actions";

/**
 * KI-12: Unterhaltungen des Assistenten (laden, löschen) und Aktionskarten (übernehmen, verwerfen).
 * Übernehmen ruft die BESTEHENDEN Server Actions auf; der Status steht danach an der Nachricht.
 */

export type UnterhaltungEintrag = { id: string; titel: string; geaendert_am: string };
export type AssistentNachricht = {
  id: string;
  rolle: "nutzer" | "assistent";
  inhalt: string;
  karten: Aktionskarte[];
  /** UniVerse Studio: Erledigtes (mit Rückgängig), Blöcke (Lernmaterial, Quiz, Web), Quellen der Belege */
  studio?: StudioDaten;
  erstellt_am: string;
};

/** Status (Key, Einwilligung, Tageskontingent) und Fächer für die Bearbeiten-Formulare der Karten. */
export async function assistentStart(): Promise<KiErgebnis<{ status: TextStatus; faecher: { id: string; name: string }[]; hauptId: string | null }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const [status, { data: faecher }, { data: haupt }] = await Promise.all([
      chatStatus(supabase, userId),
      supabase.from("fach").select("id, name").eq("aktiv", true).order("name"),
      // UniVerse Studio: ein gemeinsamer Chat – die zuletzt genutzte Unterhaltung
      supabase.from("ki_unterhaltung").select("id").order("geaendert_am", { ascending: false }).limit(1).maybeSingle(),
    ]);
    return { ok: true, daten: { status, faecher: faecher ?? [], hauptId: haupt?.id ?? null } };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function unterhaltungenLaden(): Promise<KiErgebnis<UnterhaltungEintrag[]>> {
  try {
    const { supabase } = await kiNutzer();
    const { data, error } = await supabase.from("ki_unterhaltung").select("id, titel, geaendert_am").order("geaendert_am", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return { ok: true, daten: data ?? [] };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function unterhaltungLaden(id: string): Promise<KiErgebnis<{ titel: string; nachrichten: AssistentNachricht[] }>> {
  try {
    const { supabase } = await kiNutzer();
    const [{ data: u }, { data: n, error }] = await Promise.all([
      supabase.from("ki_unterhaltung").select("titel").eq("id", id).maybeSingle(),
      supabase.from("ki_nachricht").select("id, rolle, inhalt, werkzeug_daten, erstellt_am").eq("unterhaltung_id", id).neq("rolle", "werkzeug").order("erstellt_am", { ascending: false }).limit(60),
    ]);
    if (error) throw new Error(error.message);
    if (!u) throw new KiEingabe("Unterhaltung nicht gefunden.");
    return {
      ok: true,
      daten: {
        titel: u.titel,
        // nur die letzten 60 Nachrichten – der eine Chat wächst sonst endlos und lädt immer länger
        nachrichten: (n ?? []).reverse().map((x) => ({
          id: x.id,
          rolle: x.rolle === "nutzer" ? "nutzer" : "assistent",
          inhalt: x.inhalt,
          karten: werkzeugDatenLesen(x.werkzeug_daten).karten,
          studio: studioDatenLesen(x.werkzeug_daten),
          erstellt_am: x.erstellt_am,
        })),
      },
    };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function unterhaltungLoeschen(id: string): Promise<KiErgebnis<null>> {
  try {
    const { supabase } = await kiNutzer();
    const { error } = await supabase.from("ki_unterhaltung").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/assistent");
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Einstellungen: „Alle KI-Unterhaltungen löschen“ (Nachrichten fallen per Cascade mit weg). */
export async function alleUnterhaltungenLoeschen(): Promise<KiErgebnis<{ anzahl: number }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const { data, error } = await supabase.from("ki_unterhaltung").delete().eq("user_id", userId).select("id");
    if (error) throw new Error(error.message);
    revalidatePath("/assistent");
    return { ok: true, daten: { anzahl: data?.length ?? 0 } };
  } catch (err) {
    return alsFehler(err);
  }
}

async function karteLaden(supabase: Supabase, nachrichtId: string, karteId: string) {
  const { data } = await supabase.from("ki_nachricht").select("id, werkzeug_daten").eq("id", nachrichtId).maybeSingle();
  if (!data) throw new KiEingabe("Nachricht nicht gefunden.");
  const daten = werkzeugDatenLesen(data.werkzeug_daten);
  const karte = daten.karten.find((k) => k.id === karteId);
  if (!karte) throw new KiEingabe("Vorschlag nicht gefunden.");
  return { daten, karte };
}

async function statusSetzen(
  supabase: Supabase,
  nachrichtId: string,
  daten: ReturnType<typeof werkzeugDatenLesen>,
  karte: Aktionskarte,
  status: KartenStatus,
  ergebnisId: string | null,
) {
  const karten = daten.karten.map((k) => (k.id === karte.id ? { ...karte, status, ergebnisId } : k));
  const { error } = await supabase
    .from("ki_nachricht")
    .update({ werkzeug_daten: { ...daten, karten } as unknown as Json })
    .eq("id", nachrichtId);
  if (error) throw new Error(error.message);
}

export type { KartenAenderung } from "@/lib/ki/aktionskarten-server";

/**
 * Aktionskarte übernehmen (KI-ALL-01: erst jetzt wird gespeichert). Bearbeitete Werte werden
 * mit denselben Regeln geprüft wie der Vorschlag. Liefert, wohin die Oberfläche verlinkt.
 */
export async function karteUebernehmen(
  nachrichtId: string,
  karteId: string,
  aenderung: KartenAenderung | null = null,
): Promise<KiErgebnis<{ karte: Aktionskarte; link: string | null }>> {
  try {
    const { supabase } = await kiNutzer();
    const { daten, karte } = await karteLaden(supabase, nachrichtId, karteId);
    const k = await karteMitAenderung(supabase, karte, aenderung);
    const { ergebnisId, link } = await karteAusfuehren(supabase, k);
    await statusSetzen(supabase, nachrichtId, daten, k, "uebernommen", ergebnisId);
    return { ok: true, daten: { karte: { ...k, status: "uebernommen", ergebnisId }, link } };
  } catch (err) {
    return alsFehler(err);
  }
}

export async function karteVerwerfen(nachrichtId: string, karteId: string): Promise<KiErgebnis<null>> {
  try {
    const { supabase } = await kiNutzer();
    const { daten, karte } = await karteLaden(supabase, nachrichtId, karteId);
    if (karte.status !== "offen") return { ok: true, daten: null };
    await statusSetzen(supabase, nachrichtId, daten, karte, "verworfen", null);
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}


// ---------------------------------------------------------------------------
// UniVerse Studio: Rückgängig, Notiz ergänzen, Karteikarten aus dem Chat speichern
// ---------------------------------------------------------------------------

/** Etwas, das die KI ausgeführt hat, zurücknehmen */
export async function erledigtRueckgaengig(nachrichtId: string, eintragId: string): Promise<KiErgebnis<null>> {
  try {
    const { supabase } = await kiNutzer();
    const { data: n } = await supabase.from("ki_nachricht").select("werkzeug_daten").eq("id", nachrichtId).maybeSingle();
    if (!n) throw new KiEingabe("Nachricht nicht gefunden.");
    const roh = (n.werkzeug_daten ?? {}) as Record<string, unknown>;
    const daten = studioDatenLesen(roh);
    const e = daten.erledigt.find((x) => x.id === eintragId);
    if (!e) throw new KiEingabe("Eintrag nicht gefunden.");
    if (e.status === "rueckgaengig") return { ok: true, daten: null };
    if (!e.ziel && e.art !== "notiz_ergaenzt") throw new KiEingabe("Das lässt sich nicht rückgängig machen.");
    switch (e.art) {
      case "deadline":
        await deleteDeadline(e.ziel!);
        break;
      case "todo":
        await deleteTodo(e.ziel!);
        break;
      case "pruefung":
        await deletePruefung(e.ziel!);
        break;
      case "notiz":
        await notizLoeschen(e.ziel!);
        break;
      case "stapel": {
        const { error } = await supabase.from("kk_stapel").delete().eq("id", e.ziel!);
        if (error) throw new Error(error.message);
        break;
      }
      case "quiz": {
        const { error } = await supabase.from("quiz").delete().eq("id", e.ziel!);
        if (error) throw new Error(error.message);
        break;
      }
      case "podcast": {
        const { error } = await supabase.from("podcast").delete().eq("id", e.ziel!);
        if (error) throw new Error(error.message);
        break;
      }
      case "todo_erledigt":
        await toggleTodoErledigt(e.ziel!, false);
        break;
      case "deadline_verschoben": {
        if (!e.vorher) throw new KiEingabe("Das alte Datum ist nicht bekannt.");
        const { error } = await supabase.from("deadline").update({ faellig_am: e.vorher }).eq("id", e.ziel!);
        if (error) throw new Error(error.message);
        break;
      }
      case "notiz_ergaenzt":
        throw new KiEingabe("Eingefügten Text entfernst du direkt in der Notiz (Strg+Z).");
    }
    const erledigt = daten.erledigt.map((x) => (x.id === eintragId ? { ...x, status: "rueckgaengig" as const } : x));
    await supabase.from("ki_nachricht").update({ werkzeug_daten: { ...roh, erledigt } as unknown as Json }).eq("id", nachrichtId);
    revalidatePath("/");
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Text ans Ende einer Notiz hängen (wenn sie gerade nicht im Editor offen ist) */
export async function notizAnhaengen(notizId: string, text: string): Promise<KiErgebnis<null>> {
  try {
    const { supabase } = await kiNutzer();
    const { data } = await supabase.from("notiz").select("inhalt").eq("id", notizId).maybeSingle();
    if (!data) throw new KiEingabe("Notiz nicht gefunden.");
    await notizSpeichern(notizId, { inhalt: `${data.inhalt.trimEnd()}\n\n${text.slice(0, 20_000)}`.trimStart() });
    revalidatePath("/notizen");
    return { ok: true, daten: null };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Karteikarten aus einem Studio-Block als Stapel speichern */
export async function studioKartenSpeichern(nachrichtId: string, blockId: string): Promise<KiErgebnis<{ stapelId: string }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const { data: n } = await supabase.from("ki_nachricht").select("werkzeug_daten").eq("id", nachrichtId).maybeSingle();
    if (!n) throw new KiEingabe("Nachricht nicht gefunden.");
    const roh = (n.werkzeug_daten ?? {}) as Record<string, unknown>;
    const daten = studioDatenLesen(roh);
    const block = daten.bloecke.find((b) => b.id === blockId);
    if (!block || block.typ !== "karten") throw new KiEingabe("Karten nicht gefunden.");
    if (block.stapelId) return { ok: true, daten: { stapelId: block.stapelId } };
    const { data: stapel, error } = await supabase.from("kk_stapel").insert({ user_id: userId, name: block.titel.slice(0, 120), fach_id: block.fachId }).select("id").single();
    if (error) throw new Error(error.message);
    const { error: kartenFehler } = await supabase.from("kk_karte").insert(
      block.karten.slice(0, 50).map((k) => ({ user_id: userId, stapel_id: stapel.id, vorderseite: k.vorderseite.slice(0, 2000), rueckseite: k.rueckseite.slice(0, 5000), ki_erzeugt: true })),
    );
    if (kartenFehler) throw new Error(kartenFehler.message);
    const bloecke = daten.bloecke.map((b) => (b.id === blockId ? { ...b, stapelId: stapel.id } : b));
    await supabase.from("ki_nachricht").update({ werkzeug_daten: { ...roh, bloecke } as unknown as Json }).eq("id", nachrichtId);
    revalidatePath("/karteikarten");
    return { ok: true, daten: { stapelId: stapel.id } };
  } catch (err) {
    return alsFehler(err);
  }
}

/** Lernmaterial aus dem Chat als Notiz speichern – Belege werden zu [[Verlinkungen]] */
export async function studioNotizSpeichern(
  titel: string,
  markdown: string,
  quellen: { nr: number; art: "pdf" | "notiz"; titel: string }[],
): Promise<KiErgebnis<{ notizId: string }>> {
  try {
    const { supabase, userId } = await kiNutzer();
    const inhalt = belegeAlsWikilinks(markdown, quellen).slice(0, 200_000);
    const { data, error } = await supabase.from("notiz").insert({ user_id: userId, titel: titel.slice(0, 300), inhalt, ki_erzeugt: true }).select("id").single();
    if (error) throw new Error(error.message);
    revalidatePath("/notizen");
    return { ok: true, daten: { notizId: data.id } };
  } catch (err) {
    return alsFehler(err);
  }
}
