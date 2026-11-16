// Quiz und Podcast erzeugen (server-only): Quellen laden, Modell rufen, Ergebnis prüfen.
import "server-only";
import type { KiAntwort, KiOptionen } from "@/lib/ki/anfrage";
import { KiEingabe } from "@/lib/ki/fehler";
import { kontextBauen, type LernQuelle } from "@/lib/ki/lernraum";
import { lernraumSichern, quellenListe, quellenTexte, type QuellenEintrag } from "@/lib/ki/lernraum-server";
import { podcastLesen, podcastPrompt, quizLesen, quizPrompt, type PodcastLaenge, type PodcastSegment, type QuizEinstellungen, type QuizFrage } from "@/lib/ki/quiz";
import { nutzungAbschliessen, textBuchen, textVoraussetzungen, type Supabase } from "@/lib/ki/server";
import { kiAnfrage, type ModellZweck } from "@/lib/ki/anbieter";

export type QuellAuswahl = { art: "pdf" | "notiz"; id: string };
export type QuellInfo = { nr: number; art: "pdf" | "notiz"; id: string; titel: string };
/** Ruft das Modell (mit Buchung im Hub, ohne im Studio-Chat, der schon gebucht hat) */
export type Anfrage = (optionen: KiOptionen) => Promise<KiAntwort>;

/** Material fürs Quiz/den Podcast: ausgewählte PDFs/Notizen, sonst alle aktiven Quellen des Fachs */
export async function materialLaden(
  supabase: Supabase,
  userId: string,
  auswahl: QuellAuswahl[],
  fachId: string | null,
  budget = 150_000,
): Promise<{ quellen: LernQuelle[]; info: QuellInfo[]; text: string; fachName: string | null }> {
  let eintraege: QuellenEintrag[] = [];
  const pdfIds = auswahl.filter((a) => a.art === "pdf").map((a) => a.id).slice(0, 20);
  const notizIds = auswahl.filter((a) => a.art === "notiz").map((a) => a.id).slice(0, 20);
  if (pdfIds.length || notizIds.length) {
    const [{ data: pdfs }, { data: notizen }] = await Promise.all([
      pdfIds.length ? supabase.from("datei").select("id, name, geaendert_am").in("id", pdfIds) : Promise.resolve({ data: [] as { id: string; name: string; geaendert_am: string }[] }),
      notizIds.length ? supabase.from("notiz").select("id, titel, geaendert_am").in("id", notizIds) : Promise.resolve({ data: [] as { id: string; titel: string; geaendert_am: string }[] }),
    ]);
    eintraege = [
      ...(pdfs ?? []).map((p) => ({ art: "pdf" as const, id: p.id, titel: p.name, herkunft: "extra" as const, aktiv: true, seiten: 0, geaendertAm: p.geaendert_am })),
      ...(notizen ?? []).map((n) => ({ art: "notiz" as const, id: n.id, titel: n.titel || "Unbenannte Notiz", herkunft: "extra" as const, aktiv: true, seiten: 0, geaendertAm: n.geaendert_am })),
    ];
  } else if (fachId) {
    const raum = await lernraumSichern(supabase, userId, fachId);
    eintraege = (await quellenListe(supabase, raum, fachId)).filter((q) => q.aktiv);
  }
  if (!eintraege.length) throw new KiEingabe("Wähle mindestens eine PDF oder Notiz (oder ein Fach mit Material).");
  const quellen = (await quellenTexte(supabase, eintraege)).filter((q) => q.abschnitte.some((a) => a.text.trim()));
  if (!quellen.length) {
    throw new KiEingabe("In den gewählten Quellen steht noch kein Text. PDFs werden eingelesen, sobald du sie einmal im PDF-Reader öffnest.");
  }
  // Neu nummerieren, damit Belege Q1, Q2 … zur Liste passen
  const nummeriert = quellen.map((q, i) => ({ ...q, nr: i + 1 }));
  const kontext = kontextBauen(nummeriert, "", budget);
  let fachName: string | null = null;
  if (fachId) fachName = (await supabase.from("fach").select("name").eq("id", fachId).maybeSingle()).data?.name ?? null;
  return { quellen: nummeriert, info: nummeriert.map((q) => ({ nr: q.nr, art: q.art, id: q.id, titel: q.titel })), text: kontext.text, fachName };
}

export async function quizErzeugen(
  anfrage: Anfrage,
  material: { info: QuellInfo[]; text: string },
  einstellungen: QuizEinstellungen,
  schwerpunkte: string[] = [],
): Promise<{ titel: string; fragen: QuizFrage[] }> {
  const p = quizPrompt(einstellungen, material.info, material.text, schwerpunkte);
  const a = await anfrage({
    system: p.system,
    nutzer: p.nutzer,
    json: true,
    temperatur: 0.5,
    maxTokens: Math.min(16_000, 1000 + einstellungen.anzahl * 650),
    timeoutMs: 110_000,
  });
  const ergebnis = quizLesen(a.text);
  if (ergebnis.fragen.length < 2) throw new KiEingabe("Aus dem Material ließ sich kein Quiz erstellen. Versuch es noch einmal.");
  return ergebnis;
}

export async function podcastErzeugen(
  anfrage: Anfrage,
  material: { info: QuellInfo[]; text: string },
  laenge: PodcastLaenge,
  fokus: string,
): Promise<{ titel: string; segmente: PodcastSegment[] }> {
  const p = podcastPrompt(laenge, material.info, material.text, fokus);
  const a = await anfrage({ system: p.system, nutzer: p.nutzer, json: true, temperatur: 0.7, maxTokens: laenge === "lang" ? 9000 : laenge === "normal" ? 6000 : 3500, timeoutMs: 110_000 });
  const ergebnis = podcastLesen(a.text);
  if (ergebnis.segmente.length < 3) throw new KiEingabe("Der Podcast ließ sich nicht erstellen. Versuch es noch einmal.");
  return ergebnis;
}

/** Anfrage(n) über das Text-Kontingent buchen (Einwilligung + Tageslimit wie alle Text-Funktionen) */
export async function mitBuchung<T>(
  supabase: Supabase,
  userId: string,
  funktion: string,
  zweck: ModellZweck,
  arbeit: (anfrage: Anfrage) => Promise<T>,
): Promise<T> {
  await textVoraussetzungen(supabase, userId);
  const { nutzungId } = await textBuchen(supabase, funktion);
  const tokens = { tokensEin: 0, tokensAus: 0 };
  let erfolgreich = false;
  try {
    const ergebnis = await arbeit(async (o) => {
      const a = await kiAnfrage(o, zweck);
      tokens.tokensEin += a.tokensEin;
      tokens.tokensAus += a.tokensAus;
      return a;
    });
    erfolgreich = true;
    return ergebnis;
  } finally {
    await nutzungAbschliessen(supabase, nutzungId, { ...tokens, erfolgreich });
  }
}
