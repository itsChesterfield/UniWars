import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { tabelleFehlt } from "@/lib/hubs/datenbank";
import { anzahlFaellig } from "@/lib/karteikarten/wiederholung";
import { vorschlaegeBerechnen } from "@/lib/karteikarten/vorschlaege";
import { berlinDatum, berlinUhrzeit, berlinWochentag } from "@/lib/zeit";
import { EinrichtungHinweis, HubKopf } from "@/components/hubs/hub-bausteine";
import { StapelUebersicht, type StapelKachel } from "@/components/karteikarten/stapel-uebersicht";
import { QuizBereich, type QuizKachel } from "@/components/quiz/quiz-bereich";
import type { QuellOption } from "@/components/quiz/quellen-wahl";
import { fragenLesen, schwaechen, versuchAntwortenLesen } from "@/lib/ki/quiz";
import { kiKonfiguriert } from "@/lib/ki/anbieter";

export const maxDuration = 300;

export const metadata = { title: "Karteikarten · UniVerse" };

export default async function KarteikartenSeite() {
  const supabase = await createClient();
  const [
    { data: stapel, error },
    { data: karten },
    { data: faecher },
    { data: pruefungen },
    { data: vorlesungen },
    { data: quizze },
    { data: versuche },
    { data: pdfs },
    { data: notizen },
  ] = await Promise.all([
    supabase.from("kk_stapel").select("*").order("geaendert_am", { ascending: false }),
    supabase.from("kk_karte").select("stapel_id, naechste_abfrage"),
    supabase.from("fach").select("id, name, farbe").eq("aktiv", true).order("erstellt_am", { ascending: true }),
    supabase.from("pruefung").select("fach_id, datum, titel").eq("status", "ANSTEHEND"),
    supabase.from("stundenplan_eintrag").select("fach_id, tag, start_zeit"),
    supabase.from("quiz").select("id, titel, fach_id, fragen").order("geaendert_am", { ascending: false }).limit(60),
    supabase.from("quiz_versuch").select("quiz_id, punkte, max_punkte, antworten").order("erstellt_am", { ascending: false }).limit(500),
    supabase.from("datei").select("id, name, fach_id").eq("mime_typ", "application/pdf").order("name").limit(500),
    supabase.from("notiz").select("id, titel, fach_id").order("geaendert_am", { ascending: false }).limit(500),
  ]);

  if (tabelleFehlt(error)) {
    return (
      <>
        <HubKopf titel="Karteikarten" />
        <EinrichtungHinweis hub="Karteikarten" />
      </>
    );
  }
  if (error) throw new Error(error.message);

  const kacheln: StapelKachel[] = (stapel ?? []).map((s) => {
    const eigene = (karten ?? []).filter((k) => k.stapel_id === s.id);
    return { ...s, anzahl: eigene.length, faellig: anzahlFaellig(eigene) };
  });

  // Vorschläge: fällige Wiederholungen + bevorstehende Prüfungen/Vorlesungen der Fächer
  const jetzt = new Date();
  const vorschlaege = vorschlaegeBerechnen(
    kacheln,
    (pruefungen ?? []).map((p) => ({ ...p, datum: berlinDatum(new Date(p.datum)) })),
    vorlesungen ?? [],
    { datum: berlinDatum(jetzt), tag: berlinWochentag(jetzt), uhr: berlinUhrzeit(jetzt) },
  ).map((v) => ({ stapelId: v.stapel.id, gruende: v.gruende }));

  const quizKacheln: QuizKachel[] = (quizze ?? []).map((q) => {
    const eigene = (versuche ?? []).filter((v) => v.quiz_id === q.id);
    const prozent = (v: { punkte: number; max_punkte: number }) => (v.max_punkte ? Math.round((Number(v.punkte) / v.max_punkte) * 100) : 0);
    const fragen = fragenLesen(q.fragen);
    return {
      id: q.id,
      titel: q.titel,
      fach_id: q.fach_id,
      anzahl: fragen.length,
      versuche: eigene.length,
      bester: eigene.length ? Math.max(...eigene.map(prozent)) : null,
      letzter: eigene.length ? prozent(eigene[0]) : null,
      schwaechen: schwaechen(fragen, eigene.slice(0, 5).map((v) => ({ antworten: versuchAntwortenLesen(v.antworten) }))).fragen.length,
    };
  });
  const optionen: QuellOption[] = [
    ...(pdfs ?? []).map((p) => ({ art: "pdf" as const, id: p.id, titel: p.name, fach_id: p.fach_id })),
    ...(notizen ?? []).map((n) => ({ art: "notiz" as const, id: n.id, titel: n.titel || "Unbenannte Notiz", fach_id: n.fach_id })),
  ];

  return (
    <Suspense fallback={null}>
      <StapelUebersicht stapel={kacheln} faecher={faecher ?? []} vorschlaege={vorschlaege} />
      <QuizBereich quizze={quizKacheln} faecher={faecher ?? []} optionen={optionen} kiVerfuegbar={kiKonfiguriert()} />
    </Suspense>
  );
}
