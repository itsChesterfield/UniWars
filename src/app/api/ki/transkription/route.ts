import { after } from "next/server";
import { transkribieren } from "@/lib/ki/audio";
import { KiEingabe, KiFehler, KiKeineEinwilligung } from "@/lib/ki/fehler";
import { alsFehler, audioBuchen, audioMonatGenutzt, audioVoraussetzungen, kiNutzer, nutzungAbschliessen } from "@/lib/ki/server";
import { KI_STATUS } from "@/lib/ki/stream-antwort";
import type { Json } from "@/lib/supabase/types";
import { transkriptZusammensetzen } from "@/lib/transkription/server";
import { haengt } from "@/lib/transkription/transkript";

/**
 * TRA-03: einen Teil einer Aufnahme transkribieren (Mistral Voxtral statt Whisper, siehe Plan).
 * Antwortet sofort (202), die Umwandlung läuft danach weiter; die Oberfläche fragt den Status ab.
 * Gebucht werden die Audio-Sekunden VOR dem Aufruf; ist die Aufnahme laut Dienst länger, wird nachgebucht.
 */
export const maxDuration = 300;

const BUCKET = "dateiablage";

function fehlerAntwort(err: unknown) {
  const f = alsFehler(err);
  const art = err instanceof KiKeineEinwilligung ? err.art : undefined;
  return Response.json({ ...f, ...(art ? { art } : {}) }, { status: KI_STATUS[f.typ] ?? 500 });
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await kiNutzer();
    await audioVoraussetzungen(supabase, userId);

    const body = (await request.json().catch(() => ({}))) as { teilId?: unknown };
    const teilId = typeof body.teilId === "string" ? body.teilId : "";
    // Teil, Transkript und Datei lädt der Server selbst (RLS) – nur eigene Daten
    const { data: teil } = await supabase
      .from("transkript_teil")
      .select("id, transkript_id, nr, sekunden, status, gestartet_am, datei_id")
      .eq("id", teilId)
      .maybeSingle();
    if (!teil) throw new KiEingabe("Aufnahme nicht gefunden.");
    if (teil.status === "fertig") return Response.json({ ok: true, daten: { status: "fertig" } });
    if (teil.status === "in_bearbeitung" && !haengt(teil)) return Response.json({ ok: true, daten: { status: "in_bearbeitung" } });
    if (!teil.datei_id) throw new KiEingabe("Die Audiodatei wurde gelöscht.");

    const [{ data: transkript }, { data: datei }] = await Promise.all([
      supabase.from("transkript").select("sprache").eq("id", teil.transkript_id).maybeSingle(),
      supabase.from("datei").select("name, mime_typ, speicher_pfad").eq("id", teil.datei_id).maybeSingle(),
    ]);
    if (!transkript || !datei) throw new KiEingabe("Aufnahme nicht gefunden.");
    if (!datei.mime_typ.startsWith("audio/")) throw new KiEingabe("Das ist keine Audiodatei.");

    // Teil für diese Anfrage beanspruchen – nur einer von zwei gleichzeitigen Aufrufen kommt durch
    const vorher = teil.status === "ausstehend" ? "ausstehend" : "fehler";
    if (teil.status === "in_bearbeitung") {
      await supabase.from("transkript_teil").update({ status: "fehler" }).eq("id", teil.id).eq("status", "in_bearbeitung");
    }
    const { data: beansprucht } = await supabase
      .from("transkript_teil")
      .update({ status: "in_bearbeitung", gestartet_am: new Date().toISOString(), fehler: null })
      .eq("id", teil.id)
      .in("status", ["ausstehend", "fehler"])
      .select("id");
    if (!beansprucht?.length) return Response.json({ ok: true, daten: { status: "in_bearbeitung" } });
    const zuruecksetzen = (fehler: string | null) =>
      supabase.from("transkript_teil").update({ status: vorher, fehler }).eq("id", teil.id);

    // Erst laden, dann buchen: Kann die Datei nicht gelesen werden, kostet es nichts
    const { data: audio, error: ladeFehler } = await supabase.storage.from(BUCKET).download(datei.speicher_pfad);
    if (ladeFehler || !audio) {
      await zuruecksetzen("Die Audiodatei konnte nicht geladen werden.");
      throw new KiEingabe("Die Audiodatei konnte nicht geladen werden.");
    }
    let buchung: Awaited<ReturnType<typeof audioBuchen>>;
    try {
      buchung = await audioBuchen(supabase, "transkription", teil.sekunden);
    } catch (err) {
      await zuruecksetzen(null);
      throw err;
    }

    after(async () => {
      let erfolgreich = false;
      try {
        const ergebnis = await transkribieren(audio, transkript.sprache === "en" ? "en" : "de", {
          dateiname: datei.name,
          zeitstempel: true,
          geschaetzteSekunden: teil.sekunden,
        });
        const { error } = await supabase
          .from("transkript_teil")
          .update({
            status: "fertig",
            text: ergebnis.text.slice(0, 200_000),
            segmente: ergebnis.segmente as unknown as Json,
            fehler: ergebnis.text.trim() ? null : "In der Aufnahme wurde keine Sprache erkannt.",
          })
          .eq("id", teil.id);
        if (error) throw new Error(error.message);
        erfolgreich = true;
        // Länger als angegeben? Differenz nachbuchen (laut Dienst gemessene Länge)
        if (ergebnis.sekunden && Math.ceil(ergebnis.sekunden) > teil.sekunden + 5) {
          const nach = await audioBuchen(supabase, "transkription", Math.ceil(ergebnis.sekunden) - teil.sekunden, true).catch(() => null);
          if (nach) await nutzungAbschliessen(supabase, nach.nutzungId, { tokensEin: 0, tokensAus: 0, erfolgreich: true });
        }
        await transkriptZusammensetzen(supabase, teil.transkript_id);
      } catch (err) {
        const meldung = err instanceof KiFehler ? err.nutzerMeldung : "Die Umwandlung hat nicht geklappt. Bitte versuch es noch einmal.";
        if (!(err instanceof KiFehler)) console.error("[ki] transkription", err instanceof Error ? err.message : err);
        await supabase.from("transkript_teil").update({ status: "fehler", fehler: meldung.slice(0, 500) }).eq("id", teil.id);
      } finally {
        await nutzungAbschliessen(supabase, buchung.nutzungId, { tokensEin: 0, tokensAus: 0, erfolgreich });
      }
    });

    const genutzt = await audioMonatGenutzt(supabase);
    return Response.json(
      { ok: true, daten: { status: "in_bearbeitung", verbleibendSekunden: Math.max(0, buchung.limitSekunden - genutzt) } },
      { status: 202 },
    );
  } catch (err) {
    return fehlerAntwort(err);
  }
}
