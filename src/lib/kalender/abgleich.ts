import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables } from "@/lib/supabase/types";
import { GoogleFehler, ZEITZONE, googleApi } from "@/lib/kalender/google";
import { hash } from "@/lib/kalender/krypto";
import { STANDARD_DAUER } from "@/lib/kalender/dauer";
import { gueltigerAccessToken, verbindungLaden, type Verbindung } from "@/lib/kalender/verbindung";

type Client = SupabaseClient<Database>;
type QuelleTyp = "deadline" | "pruefung" | "stundenplan" | "todo";

// Google-Farb-IDs (Standardpalette des Kalenders).
const FARBE = {
  pruefung: "11",
  termin: "9",
  gruppenarbeit: "3",
  abgabe: "5",
  todo: "2",
  vorlesung: "7",
  erledigt: "8",
} as const;

type GoogleEvent = {
  summary: string;
  description?: string;
  location?: string;
  colorId: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  recurrence?: string[];
  status: "confirmed";
  transparency?: "transparent";
};

type SollEintrag = { typ: QuelleTyp; id: string; event: GoogleEvent };

const TYP_ZIFFER: Record<QuelleTyp, string> = { deadline: "1", pruefung: "2", stundenplan: "3", todo: "4" };

// Google-Event-IDs erlauben nur 0-9 und a-v; Hex passt. Fest pro Eintrag, damit parallele
// Abgleiche dasselbe Event treffen statt Doppelte anzulegen.
export function eventId(typ: QuelleTyp, quelleId: string): string {
  return `u${TYP_ZIFFER[typ]}${quelleId.replace(/-/g, "")}`;
}

function plusMinuten(iso: string, minuten: number): string {
  return new Date(new Date(iso).getTime() + minuten * 60_000).toISOString();
}

function zeit(iso: string) {
  return { dateTime: new Date(iso).toISOString(), timeZone: ZEITZONE };
}

function beschreibung(...zeilen: (string | null | undefined)[]): string {
  return [...zeilen.filter(Boolean), "", "Eingetragen über UniWars"].join("\n");
}

const WOCHENTAG_INDEX: Record<Enums<"wochentag">, number> = { SO: 0, MO: 1, DI: 2, MI: 3, DO: 4, FR: 5, SA: 6 };
const RRULE_TAG: Record<Enums<"wochentag">, string> = { MO: "MO", DI: "TU", MI: "WE", DO: "TH", FR: "FR", SA: "SA", SO: "SU" };

// Lokale Berliner Uhrzeit des nächsten Termins dieses Wochentags (ab Montag dieser Woche).
function lokalesDatumFuerWochentag(tag: Enums<"wochentag">, uhrzeit: string): string {
  const jetzt = new Date();
  const montag = new Date(jetzt);
  const diff = jetzt.getDay() === 0 ? -6 : 1 - jetzt.getDay();
  montag.setDate(jetzt.getDate() + diff);
  const ziel = new Date(montag);
  const offset = (WOCHENTAG_INDEX[tag] + 6) % 7;
  ziel.setDate(montag.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ziel.getFullYear()}-${pad(ziel.getMonth() + 1)}-${pad(ziel.getDate())}T${uhrzeit.slice(0, 5)}:00`;
}

type FachName = Pick<Tables<"fach">, "id" | "name">;

export function eventFuerPruefung(p: Tables<"pruefung">, faecher: FachName[]): GoogleEvent {
  const fach = faecher.find((f) => f.id === p.fach_id)?.name;
  const erledigt = p.status !== "ANSTEHEND";
  return {
    summary: `${erledigt ? "✓ " : ""}📝 Prüfung: ${p.titel}`,
    description: beschreibung(fach ? `Fach: ${fach}` : null),
    location: p.raum ?? undefined,
    colorId: erledigt ? FARBE.erledigt : FARBE.pruefung,
    start: zeit(p.datum),
    end: zeit(plusMinuten(p.datum, p.dauer_minuten ?? STANDARD_DAUER.PRUEFUNG)),
    status: "confirmed",
  };
}

export function eventFuerDeadline(d: Tables<"deadline">, faecher: FachName[]): GoogleEvent {
  const fach = faecher.find((f) => f.id === d.fach_id)?.name;
  const art =
    d.typ === "TERMIN"
      ? { praefix: "📅 ", farbe: FARBE.termin }
      : d.typ === "GRUPPENARBEIT"
        ? { praefix: "👥 ", farbe: FARBE.gruppenarbeit }
        : { praefix: "⏰ Abgabe: ", farbe: FARBE.abgabe };
  return {
    summary: `${d.erledigt ? "✓ " : ""}${art.praefix}${d.titel}`,
    description: beschreibung(fach ? `Fach: ${fach}` : null),
    colorId: d.erledigt ? FARBE.erledigt : art.farbe,
    start: zeit(d.faellig_am),
    end: zeit(plusMinuten(d.faellig_am, d.dauer_minuten ?? STANDARD_DAUER[d.typ])),
    status: "confirmed",
    // Abgaben blockieren keine Zeit, sie markieren nur einen Zeitpunkt.
    ...(d.typ === "TERMIN" || d.typ === "GRUPPENARBEIT" ? {} : { transparency: "transparent" as const }),
  };
}

export function eventFuerTodo(t: Tables<"todo">, faellig: string, faecher: FachName[]): GoogleEvent {
  const fach = faecher.find((f) => f.id === t.fach_id)?.name;
  return {
    summary: `${t.erledigt ? "✓ " : ""}☑ ${t.titel}`,
    description: beschreibung(fach ? `Fach: ${fach}` : null),
    colorId: t.erledigt ? FARBE.erledigt : FARBE.todo,
    start: zeit(faellig),
    end: zeit(plusMinuten(faellig, 15)),
    status: "confirmed",
    transparency: "transparent",
  };
}

export function eventFuerStundenplan(e: Tables<"stundenplan_eintrag">, faecher: FachName[]): GoogleEvent {
  const fach = faecher.find((f) => f.id === e.fach_id)?.name ?? "Vorlesung";
  return {
    summary: `🎓 ${fach}`,
    description: beschreibung(e.dozent ? `Dozent: ${e.dozent}` : null),
    location: e.raum ?? undefined,
    colorId: FARBE.vorlesung,
    start: { dateTime: lokalesDatumFuerWochentag(e.tag, e.start_zeit), timeZone: ZEITZONE },
    end: { dateTime: lokalesDatumFuerWochentag(e.tag, e.end_zeit), timeZone: ZEITZONE },
    recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${RRULE_TAG[e.tag]}`],
    status: "confirmed",
  };
}

async function sollZustand(supabase: Client): Promise<SollEintrag[]> {
  const [faecher, deadlines, pruefungen, stundenplan, todos] = await Promise.all([
    supabase.from("fach").select("id, name"),
    supabase.from("deadline").select("*"),
    supabase.from("pruefung").select("*"),
    supabase.from("stundenplan_eintrag").select("*"),
    supabase.from("todo").select("*").not("faellig_am", "is", null),
  ]);
  const fehler = faecher.error || deadlines.error || pruefungen.error || stundenplan.error || todos.error;
  if (fehler) throw new Error(fehler.message);

  const f = faecher.data ?? [];
  return [
    ...(pruefungen.data ?? []).map((p) => ({ typ: "pruefung" as const, id: p.id, event: eventFuerPruefung(p, f) })),
    ...(deadlines.data ?? []).map((d) => ({ typ: "deadline" as const, id: d.id, event: eventFuerDeadline(d, f) })),
    ...(stundenplan.data ?? []).map((e) => ({ typ: "stundenplan" as const, id: e.id, event: eventFuerStundenplan(e, f) })),
    ...(todos.data ?? []).map((t) => ({ typ: "todo" as const, id: t.id, event: eventFuerTodo(t, t.faellig_am!, f) })),
  ];
}

export async function uniwarsKalenderAnlegen(accessToken: string): Promise<string> {
  const kalender = await googleApi<{ id: string }>(accessToken, "POST", "/calendars", {
    summary: "UniWars",
    description: "Deadlines, Prüfungen und Termine aus UniWars. Änderungen bitte in UniWars vornehmen.",
    timeZone: ZEITZONE,
  });
  return kalender.id;
}

async function eventSchreiben(accessToken: string, kalenderId: string, id: string, event: GoogleEvent) {
  const basis = `/calendars/${encodeURIComponent(kalenderId)}/events`;
  try {
    await googleApi(accessToken, "PUT", `${basis}/${id}`, event);
  } catch (err) {
    if (!(err instanceof GoogleFehler) || err.status !== 404) throw err;
    try {
      await googleApi(accessToken, "POST", basis, { id, ...event });
    } catch (err2) {
      // Parallel von einem anderen Abgleich angelegt: dann einfach aktualisieren.
      if (err2 instanceof GoogleFehler && err2.status === 409) {
        await googleApi(accessToken, "PUT", `${basis}/${id}`, event);
      } else {
        throw err2;
      }
    }
  }
}

async function eventLoeschen(accessToken: string, kalenderId: string, id: string) {
  try {
    await googleApi(accessToken, "DELETE", `/calendars/${encodeURIComponent(kalenderId)}/events/${id}`);
  } catch (err) {
    if (!(err instanceof GoogleFehler) || (err.status !== 404 && err.status !== 410)) throw err;
  }
}

async function abgleichDurchfuehren(supabase: Client, verbindung: Verbindung, accessToken: string) {
  const kalenderId = verbindung.kalender_id!;
  const [soll, istAntwort] = await Promise.all([
    sollZustand(supabase),
    supabase.from("kalender_eintrag").select("*").eq("user_id", verbindung.user_id),
  ]);
  if (istAntwort.error) throw new Error(istAntwort.error.message);

  const ist = new Map((istAntwort.data ?? []).map((e) => [`${e.quelle_typ}:${e.quelle_id}`, e]));
  const sollSchluessel = new Set<string>();

  for (const eintrag of soll) {
    const schluessel = `${eintrag.typ}:${eintrag.id}`;
    sollSchluessel.add(schluessel);
    const inhaltHash = hash(JSON.stringify(eintrag.event));
    if (ist.get(schluessel)?.inhalt_hash === inhaltHash) continue;

    const id = eventId(eintrag.typ, eintrag.id);
    await eventSchreiben(accessToken, kalenderId, id, eintrag.event);
    await supabase.from("kalender_eintrag").upsert({
      user_id: verbindung.user_id,
      quelle_typ: eintrag.typ,
      quelle_id: eintrag.id,
      google_event_id: id,
      inhalt_hash: inhaltHash,
    });
  }

  for (const [schluessel, eintrag] of ist) {
    if (sollSchluessel.has(schluessel)) continue;
    await eventLoeschen(accessToken, kalenderId, eintrag.google_event_id);
    await supabase
      .from("kalender_eintrag")
      .delete()
      .eq("user_id", verbindung.user_id)
      .eq("quelle_typ", eintrag.quelle_typ)
      .eq("quelle_id", eintrag.quelle_id);
  }
}

export async function vollAbgleich(supabase: Client, userId: string): Promise<void> {
  const verbindung = await verbindungLaden(supabase, userId);
  if (!verbindung) return;
  const accessToken = await gueltigerAccessToken(supabase, verbindung);

  if (!verbindung.kalender_id) {
    verbindung.kalender_id = await uniwarsKalenderAnlegen(accessToken);
    await supabase.from("kalender_verbindung").update({ kalender_id: verbindung.kalender_id }).eq("user_id", userId);
  }

  try {
    await abgleichDurchfuehren(supabase, verbindung, accessToken);
  } catch (err) {
    // Nutzer hat den UniWars-Kalender in Google gelöscht: neu anlegen und alles neu schreiben.
    if (!(err instanceof GoogleFehler) || err.status !== 404) throw err;
    verbindung.kalender_id = await uniwarsKalenderAnlegen(accessToken);
    await supabase.from("kalender_verbindung").update({ kalender_id: verbindung.kalender_id }).eq("user_id", userId);
    await supabase.from("kalender_eintrag").delete().eq("user_id", userId);
    await abgleichDurchfuehren(supabase, verbindung, accessToken);
  }

  await supabase
    .from("kalender_verbindung")
    .update({ zuletzt_abgeglichen: new Date().toISOString() })
    .eq("user_id", userId);
}
