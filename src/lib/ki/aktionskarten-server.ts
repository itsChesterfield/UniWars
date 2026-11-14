// KI-12/KI-05: Aktionskarten ausführen – erst nach Klick des Nutzers (KI-ALL-01).
// Ruft die BESTEHENDEN Server Actions auf; gemeinsam für Assistent und Tagesvorschläge.
import "server-only";
import { createDeadline } from "@/app/deadline/actions";
import { createTodo } from "@/app/todo/actions";
import { notizAnlegen, notizSpeichern } from "@/app/(hubs)/notizen/actions";
import { vorschlaegeUebernehmen } from "@/app/(hubs)/notizen/ki-actions";
import { karteBauen, type Aktionskarte } from "@/lib/ki/assistent";
import { KiEingabe } from "@/lib/ki/fehler";
import type { Supabase } from "@/lib/ki/server";
import { umfeldLaden } from "@/lib/ki/werkzeuge/vorschlagen";

export type KartenAenderung = {
  titel?: string;
  faellig_am?: string;
  fach_id?: string | null;
  prioritaet?: string;
  inhalt?: string;
  karten?: { vorderseite: string; rueckseite: string }[];
};

/** Bearbeitete Werte mit denselben Regeln prüfen wie den Vorschlag. */
export async function karteMitAenderung(supabase: Supabase, karte: Aktionskarte, aenderung: KartenAenderung | null): Promise<Aktionskarte> {
  if (karte.status !== "offen") throw new KiEingabe(karte.status === "uebernommen" ? "Dieser Vorschlag wurde schon übernommen." : "Dieser Vorschlag wurde verworfen.");
  if (!aenderung) return karte;
  const umfeld = { ...(await umfeldLaden(supabase)), jetzt: new Date() };
  const basis: Record<string, unknown> = { ...karte, fach: karte.typ === "stapel_lernen" ? undefined : ((karte as { fach_id?: string | null }).fach_id ?? undefined) };
  const args: Record<string, unknown> = { ...basis, ...aenderung };
  if (aenderung.fach_id !== undefined) args.fach = aenderung.fach_id ?? undefined;
  if (karte.typ === "karteikarten") args.stapel = karte.stapel_id ?? karte.stapel_name;
  if (karte.typ === "stapel_lernen") args.stapel = karte.stapel_id;
  return { id: karte.id, status: "offen", ...karteBauen(karte.typ, args, umfeld) } as Aktionskarte;
}

/** Karte ausführen; liefert die ID des Ergebnisses und wohin die Oberfläche verlinkt. */
export async function karteAusfuehren(supabase: Supabase, k: Aktionskarte): Promise<{ ergebnisId: string | null; link: string | null }> {
  switch (k.typ) {
    case "deadline": {
      const neu = await createDeadline({ titel: k.titel, fach_id: k.fach_id, faellig_am: k.faellig_am, typ: k.deadline_typ, kategorie: "NORMAL" });
      const id = neu?.[0]?.id ?? null;
      return { ergebnisId: id, link: id ? `/?detail=deadline:${id}` : "/" };
    }
    case "todo": {
      const neu = await createTodo({ titel: k.titel, fach_id: k.fach_id, prioritaet: k.prioritaet });
      return { ergebnisId: neu.id, link: `/?detail=todo:${neu.id}` };
    }
    case "notiz": {
      const neu = await notizAnlegen(k.fach_id);
      await notizSpeichern(neu.id, { titel: k.titel, inhalt: k.inhalt });
      await supabase.from("notiz").update({ ki_erzeugt: true }).eq("id", neu.id);
      return { ergebnisId: neu.id, link: `/notizen?id=${neu.id}` };
    }
    case "karteikarten": {
      const ziel = k.stapel_id ? { stapelId: k.stapel_id } : { neuerStapel: { name: k.stapel_name, fachId: k.fach_id } };
      const a = await vorschlaegeUebernehmen(ziel, k.karten);
      if (!a.ok) throw new KiEingabe(a.fehler);
      return { ergebnisId: a.daten.stapelId, link: `/karteikarten/${a.daten.stapelId}` };
    }
    case "lernsession":
      return { ergebnisId: null, link: k.fach_id ? `/work-station?fach=${k.fach_id}` : "/work-station" };
    case "stapel_lernen":
      return { ergebnisId: k.stapel_id, link: `/karteikarten/${k.stapel_id}/lernen` };
  }
}
