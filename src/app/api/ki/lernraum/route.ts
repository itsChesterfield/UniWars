import { kiAnfrage, kiAnfrageStream, kiModell, kiWebsuche } from "@/lib/ki/anbieter";
import { KiEingabe } from "@/lib/ki/fehler";
import { chatBuchen, chatHeuteGenutzt, kiNutzer, nutzungAbschliessen, textVoraussetzungen } from "@/lib/ki/server";
import { kiFehlerAntwort } from "@/lib/ki/stream-antwort";
import {
  absichtLesen,
  absichtPrompt,
  absichtSchaetzen,
  antwortPrompt,
  kontextBauen,
  MAX_FRAGE,
  MAX_KONTEXT_AUSWAHL,
  MAX_KONTEXT_GANZ,
  profilAnpassen,
  profilLesen,
  type Absicht,
} from "@/lib/ki/lernraum";
import { quellenListe, quellenTexte } from "@/lib/ki/lernraum-server";
import type { Json } from "@/lib/supabase/types";
import type { Nachricht } from "@/lib/ki/anfrage";

/**
 * Lernraum-Chat (wie NotebookLM): Antwort aus den Quellen des Fachs mit Belegen.
 * Ablauf: Absicht erkennen (kleines Modell) → Kontext bauen (ganz oder Auswahl, mit
 * Kostenbremse) → Antwort mit dem starken Modell streamen, bei Bedarf mit Websuche.
 */
export const maxDuration = 120;

const VERLAUF = 10;

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await kiNutzer();
    await textVoraussetzungen(supabase, userId);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const lernraumId = typeof body.lernraumId === "string" ? body.lernraumId : "";
    const frage = typeof body.frage === "string" ? body.frage.trim() : "";
    if (!frage) throw new KiEingabe("Bitte gib eine Frage ein.");
    if (frage.length > MAX_FRAGE) throw new KiEingabe(`Die Nachricht ist zu lang (höchstens ${MAX_FRAGE} Zeichen).`);

    const { data: raum } = await supabase.from("lernraum").select("id, fach_id, fach(name)").eq("id", lernraumId).maybeSingle();
    if (!raum) throw new KiEingabe("Lernraum nicht gefunden.");
    const fach = (raum.fach as { name: string } | null)?.name ?? "Fach";

    const [liste, { data: verlaufRoh }, { data: settings }] = await Promise.all([
      quellenListe(supabase, raum.id, raum.fach_id),
      supabase.from("lernraum_nachricht").select("rolle, inhalt").eq("lernraum_id", raum.id).order("erstellt_am", { ascending: false }).limit(VERLAUF),
      supabase.from("settings").select("ki_profil").eq("user_id", userId).maybeSingle(),
    ]);
    const verlauf = [...(verlaufRoh ?? [])].reverse();
    let profil = profilLesen(settings?.ki_profil);

    // Limit vorab buchen (eine Nachricht = eine Buchung, egal welches Modell)
    const buchung = await chatBuchen(supabase, "lernraum");

    // 1) Absicht erkennen – kleines, günstiges Modell; scheitert es, grobe Schätzung
    const vorherige = [...verlauf].reverse().find((v) => v.rolle === "nutzer")?.inhalt ?? null;
    let absicht: Absicht;
    try {
      const p = absichtPrompt(frage, vorherige);
      const a = await kiAnfrage({ system: p.system, nutzer: p.nutzer, json: true, temperatur: 0, maxTokens: 120, timeoutMs: 8000 }, "schnell");
      absicht = absichtLesen(a.text, frage);
    } catch {
      absicht = absichtSchaetzen(frage);
    }
    if (absicht.vorliebe) {
      profil = profilAnpassen(profil, "gut", absicht.vorliebe);
      await supabase.from("settings").update({ ki_profil: profil as unknown as Json }).eq("user_id", userId);
    }

    // 2) Kontext: ganzes Material oder passende Auswahl – mit Kostenbremse
    const quellen = await quellenTexte(supabase, liste);
    const suchtext = [vorherige, frage].filter(Boolean).join(" ");
    const kontext = kontextBauen(quellen, suchtext, absicht.ganz ? MAX_KONTEXT_GANZ : MAX_KONTEXT_AUSWAHL);
    const fehlend = liste.filter((q) => q.aktiv && q.art === "pdf" && q.seiten === 0).map((q) => q.titel);

    const system = antwortPrompt({ fach, quellen, kontext: kontext.text, umfang: kontext.umfang, modus: absicht.modus, profil, web: absicht.web });
    const nachrichten: Nachricht[] = [
      ...verlauf.map((v) => ({ role: v.rolle === "nutzer" ? ("user" as const) : ("assistant" as const), content: v.inhalt.slice(0, 6000) })),
      { role: "user", content: frage },
    ];
    const maxTokens = absicht.modus === "plaudern" ? 400 : profil.laenge === "kurz" ? 900 : profil.laenge === "ausfuehrlich" ? 3000 : 1800;
    // Großer Kontext braucht etwas länger bis zum ersten Wort
    const timeoutMs = kontext.zeichen > 150_000 ? 90_000 : 45_000;

    await supabase.from("lernraum_nachricht").insert({ user_id: userId, lernraum_id: raum.id, rolle: "nutzer", inhalt: frage });

    const meta = {
      modus: absicht.modus,
      umfang: kontext.umfang,
      web: [] as { titel: string; url: string }[],
      quellen: quellen.map((q) => ({ nr: q.nr, art: q.art, id: q.id, titel: q.titel })),
      fehlend,
      modell: kiModell("stark"),
    };
    const verbleibend = Math.max(0, buchung.limit - (await chatHeuteGenutzt(supabase)));
    const encoder = new TextEncoder();
    let gesamt = "";
    let tokens = { tokensEin: 0, tokensAus: 0 };
    let erfolgreich = false;
    const speichern = async () => {
      await nutzungAbschliessen(supabase, buchung.nutzungId, { ...tokens, erfolgreich });
      if (gesamt.trim()) {
        await supabase.from("lernraum_nachricht").insert({
          user_id: userId,
          lernraum_id: raum.id,
          rolle: "ki",
          inhalt: gesamt.slice(0, 40000),
          meta: meta as unknown as Json,
        });
      }
    };

    // 3a) Mit Websuche: Mistral recherchiert selbst (nicht gestreamt), Text dann auf einmal
    if (absicht.web) {
      try {
        const w = await kiWebsuche({ system, nachrichten, temperatur: 0.3, maxTokens, timeoutMs: 90_000, signal: request.signal });
        gesamt = w.text;
        meta.web = w.quellen;
        tokens = { tokensEin: w.tokensEin, tokensAus: w.tokensAus };
        erfolgreich = true;
        await speichern();
        return new Response(gesamt, { headers: kopf(meta, verbleibend, buchung.limit) });
      } catch (err) {
        // Websuche nicht verfügbar → normal ohne Web antworten
        console.warn("[lernraum] Websuche fehlgeschlagen, antworte ohne", err instanceof Error ? err.message : err);
      }
    }

    // 3b) Normal: starkes Modell, gestreamt
    const abbruch = new AbortController();
    request.signal.addEventListener("abort", () => abbruch.abort(), { once: true });
    const it = kiAnfrageStream({ system, nachrichten, temperatur: 0.3, maxTokens, timeoutMs, signal: abbruch.signal }, "stark")[Symbol.asyncIterator]();
    const erstes = await it.next();
    if (!erstes.done && erstes.value.typ === "fehler") {
      await nutzungAbschliessen(supabase, buchung.nutzungId, { tokensEin: 0, tokensAus: 0, erfolgreich: false });
      throw erstes.value.fehler;
    }
    let aktuell: typeof erstes | null = erstes;
    let fertig = false;
    const strom = new ReadableStream<Uint8Array>({
      async pull(controller) {
        while (true) {
          const r = aktuell ?? (await it.next());
          aktuell = null;
          if (r.done) {
            if (!fertig) {
              fertig = true;
              await speichern();
            }
            controller.close();
            return;
          }
          const e = r.value;
          if (e.typ === "text") {
            gesamt += e.text;
            controller.enqueue(encoder.encode(e.text));
            return;
          }
          if (e.typ === "fehler") {
            const hinweis = `\n\n_(${e.fehler.nutzerMeldung})_`;
            gesamt += hinweis;
            controller.enqueue(encoder.encode(hinweis));
            return;
          }
          if (e.typ === "ende") {
            tokens = { tokensEin: e.tokensEin, tokensAus: e.tokensAus };
            erfolgreich = true;
          }
        }
      },
      async cancel() {
        abbruch.abort();
        if (!fertig) {
          fertig = true;
          await speichern();
        }
      },
    });
    return new Response(strom, { headers: kopf(meta, verbleibend, buchung.limit) });
  } catch (err) {
    return kiFehlerAntwort(err);
  }
}

function kopf(meta: unknown, verbleibend: number, limit: number): HeadersInit {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Lernraum-Meta": encodeURIComponent(JSON.stringify(meta)),
    "X-KI-Verbleibend": String(verbleibend),
    "X-KI-Limit": String(limit),
  };
}
