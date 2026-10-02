"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { belegteZeiten, googleApi, googleKonfiguriert, tokenWiderrufen, type BelegtBlock } from "@/lib/kalender/google";
import { entschluesseln } from "@/lib/kalender/krypto";
import { gueltigerAccessToken, verbindungLaden, VerbindungUngueltig } from "@/lib/kalender/verbindung";
import { vollAbgleich } from "@/lib/kalender/abgleich";
import { STANDARD_DAUER } from "@/lib/kalender/dauer";

async function nutzer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, userId: user.id };
}

export async function kalenderTrennen() {
  const { supabase, userId } = await nutzer();
  const verbindung = await verbindungLaden(supabase, userId);
  if (!verbindung) return;

  try {
    const accessToken = await gueltigerAccessToken(supabase, verbindung);
    if (verbindung.kalender_id) {
      await googleApi(accessToken, "DELETE", `/calendars/${encodeURIComponent(verbindung.kalender_id)}`).catch(
        () => undefined,
      );
    }
    await tokenWiderrufen(entschluesseln(verbindung.refresh_token));
  } catch (err) {
    if (!(err instanceof VerbindungUngueltig)) console.error("Google-Trennung unvollständig", err);
  }

  await supabase.from("kalender_eintrag").delete().eq("user_id", userId);
  await supabase.from("kalender_verbindung").delete().eq("user_id", userId);
  revalidatePath("/");
}

export async function kalenderJetztAbgleichen() {
  const { supabase, userId } = await nutzer();
  await vollAbgleich(supabase, userId);
}

export type BelegtAntwort = { verbunden: boolean; bloecke: BelegtBlock[] };

export async function belegtZeitenLaden(vonIso: string, bisIso: string): Promise<BelegtAntwort> {
  if (!googleKonfiguriert()) return { verbunden: false, bloecke: [] };
  const { supabase, userId } = await nutzer();
  const verbindung = await verbindungLaden(supabase, userId);
  if (!verbindung) return { verbunden: false, bloecke: [] };
  try {
    const accessToken = await gueltigerAccessToken(supabase, verbindung);
    return { verbunden: true, bloecke: await belegteZeiten(accessToken, vonIso, bisIso) };
  } catch (err) {
    if (err instanceof VerbindungUngueltig) return { verbunden: false, bloecke: [] };
    console.error("Belegt-Zeiten laden fehlgeschlagen", err);
    return { verbunden: true, bloecke: [] };
  }
}

export type Konflikt = { quelle: "google" | "uniwars"; titel: string | null; start: string; ende: string };

function ueberschneidet(aStart: number, aEnde: number, bStart: number, bEnde: number) {
  return aStart < bEnde && bStart < aEnde;
}

const WOCHENTAG: Record<number, string> = { 0: "SO", 1: "MO", 2: "DI", 3: "MI", 4: "DO", 5: "FR", 6: "SA" };

// Berliner Wanduhrzeit "HH:MM" eines Zeitpunkts, unabhängig von der Server-Zeitzone.
function berlinerUhrzeit(datum: Date) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false }).format(datum);
}

function berlinerWochentag(datum: Date) {
  const kurz = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", weekday: "short" }).format(datum);
  return WOCHENTAG[["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(kurz)];
}

export async function konfliktePruefen(startIso: string, endeIso: string): Promise<Konflikt[]> {
  const { supabase, userId } = await nutzer();
  const start = new Date(startIso).getTime();
  const ende = new Date(endeIso).getTime();
  if (!(ende > start)) return [];
  const konflikte: Konflikt[] = [];

  const tagesbeginn = new Date(start - 24 * 3600_000).toISOString();
  const tagesende = new Date(ende + 24 * 3600_000).toISOString();
  const [pruefungen, deadlines, stundenplan, faecher] = await Promise.all([
    supabase.from("pruefung").select("titel, datum, dauer_minuten").gte("datum", tagesbeginn).lte("datum", tagesende),
    supabase
      .from("deadline")
      .select("titel, faellig_am, dauer_minuten, typ")
      .in("typ", ["TERMIN", "GRUPPENARBEIT"])
      .gte("faellig_am", tagesbeginn)
      .lte("faellig_am", tagesende),
    supabase.from("stundenplan_eintrag").select("fach_id, tag, start_zeit, end_zeit"),
    supabase.from("fach").select("id, name"),
  ]);

  for (const p of pruefungen.data ?? []) {
    const s = new Date(p.datum).getTime();
    const e = s + (p.dauer_minuten ?? STANDARD_DAUER.PRUEFUNG) * 60_000;
    if (ueberschneidet(start, ende, s, e)) konflikte.push({ quelle: "uniwars", titel: `Prüfung: ${p.titel}`, start: new Date(s).toISOString(), ende: new Date(e).toISOString() });
  }
  for (const d of deadlines.data ?? []) {
    const s = new Date(d.faellig_am).getTime();
    const e = s + (d.dauer_minuten ?? STANDARD_DAUER[d.typ]) * 60_000;
    if (ueberschneidet(start, ende, s, e)) konflikte.push({ quelle: "uniwars", titel: d.titel, start: new Date(s).toISOString(), ende: new Date(e).toISOString() });
  }

  const tag = berlinerWochentag(new Date(start));
  const vonUhr = berlinerUhrzeit(new Date(start));
  const bisUhr = berlinerUhrzeit(new Date(ende));
  for (const e of stundenplan.data ?? []) {
    if (e.tag !== tag) continue;
    if (vonUhr < e.end_zeit.slice(0, 5) && e.start_zeit.slice(0, 5) < bisUhr) {
      const fach = (faecher.data ?? []).find((f) => f.id === e.fach_id)?.name ?? "Vorlesung";
      konflikte.push({ quelle: "uniwars", titel: fach, start: e.start_zeit.slice(0, 5), ende: e.end_zeit.slice(0, 5) });
    }
  }

  if (googleKonfiguriert()) {
    const verbindung = await verbindungLaden(supabase, userId);
    if (verbindung) {
      try {
        const accessToken = await gueltigerAccessToken(supabase, verbindung);
        for (const b of await belegteZeiten(accessToken, startIso, endeIso)) {
          konflikte.push({ quelle: "google", titel: null, start: b.start, ende: b.end });
        }
      } catch (err) {
        if (!(err instanceof VerbindungUngueltig)) console.error("Frei/Belegt-Prüfung fehlgeschlagen", err);
      }
    }
  }

  return konflikte;
}
