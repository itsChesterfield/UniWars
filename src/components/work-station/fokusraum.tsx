"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { initiale, raumTopic, restMs, teilnehmerListe, type Anwesenheit, type Raum, type Teilnehmer } from "@/lib/fokusraum";
import { fokusraumSchreiben, useFokusraum } from "@/lib/fokusraum-store";
import { alsUhr, MODUS_NAME, starten, startZustand, type Modus } from "@/lib/work-station/timer";
import { timerLesen, timerSchreiben, useJetzt } from "@/lib/work-station/timer-store";
import { useEigenerRaum } from "@/components/work-station/fokusraum-praesenz";
import { track } from "@/lib/analytics";
import { PfeilText } from "@/components/bewegung/pfeil-text";

/** Wer gerade in einem Raum ist (nur zuschauen, ohne selbst sichtbar zu sein) */
function useRaumTeilnehmer(topic: string, eigenerTopic: string | null): { liste: Teilnehmer[]; status: "laedt" | "da" | "fehler" } {
  const eigen = useEigenerRaum();
  const istEigener = topic === eigenerTopic;
  const [stand, setStand] = useState<{ topic: string; liste: Teilnehmer[]; status: "laedt" | "da" | "fehler" }>({ topic, liste: [], status: "laedt" });
  useEffect(() => {
    // Im eigenen Raum liefert die Anwesenheit die Liste; nur fremde Räume selbst öffnen
    if (istEigener) return;
    const supabase = createClient();
    let kanal: RealtimeChannel | null = null;
    let aus = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (aus) return;
      await supabase.realtime.setAuth();
      // Raum inzwischen gewechselt oder Seite verlassen: keinen Kanal mehr öffnen
      if (aus) return;
      // Eigener Zuschau-Kanal mit zufälligem Schlüssel: zuschauen ist unsichtbar
      kanal = supabase.channel(topic, { config: { private: true, presence: { key: `zuschauer-${crypto.randomUUID()}` } } });
      const aktualisieren = () => {
        if (aus || !kanal) return;
        setStand({ topic, liste: teilnehmerListe(kanal.presenceState<Anwesenheit>(), data.user?.id ?? null), status: "da" });
      };
      kanal
        .on("presence", { event: "sync" }, aktualisieren)
        .subscribe((s) => {
          if (s === "SUBSCRIBED") aktualisieren();
          if ((s === "CHANNEL_ERROR" || s === "TIMED_OUT") && !aus) setStand({ topic, liste: [], status: "fehler" });
        });
    })();
    return () => {
      aus = true;
      if (kanal) void supabase.removeChannel(kanal);
    };
  }, [topic, istEigener]);
  if (istEigener) return eigen?.topic === topic ? { liste: eigen.liste, status: "da" } : { liste: [], status: "laedt" };
  return stand.topic === topic ? stand : { liste: [], status: "laedt" };
}

function Platz({ t, jetzt }: { t: Teilnehmer; jetzt: number }) {
  const fokus = t.m === "fokus";
  return (
    <li className={`fr-platz${fokus && t.l ? " fokus" : ""}${t.ich ? " ich" : ""}`}>
      <span className="fr-avatar" aria-hidden>
        {initiale(t.n)}
      </span>
      <span className="fr-name">{t.ich ? "Du" : (t.n ?? "Anonym")}</span>
      {t.f && <span className="fr-fach">{t.f}</span>}
      <span className="fr-stand">
        {t.l ? (t.w ? "Flow" : MODUS_NAME[(t.m as Modus) ?? "fokus"]) : "pausiert"} <span className="zahl">{alsUhr(restMs(t, jetzt))}</span>
      </span>
    </li>
  );
}

/**
 * Fokusraum: zusammen lernen, ohne Chat und ohne Video. Man sieht, wer gerade lernt;
 * selbst sichtbar ist man erst nach „Beitreten“. Im Raum „Alle“ standardmäßig anonym.
 */
export function Fokusraum({ raeume, hochschuleBestaetigt }: { raeume: Raum[]; hochschuleBestaetigt: boolean }) {
  const wahl = useFokusraum();
  // Ohne eigene Auswahl den beigetretenen Raum zeigen (auch nach dem Neuladen, wenn die Wahl erst nach dem ersten Rendern bekannt ist)
  const [aktivTopic, setAktivTopic] = useState<string | null>(null);
  const raum = raeume.find((r) => raumTopic(r) === (aktivTopic ?? wahl?.topic)) ?? raeume[0];
  const topic = raumTopic(raum);
  const { liste, status } = useRaumTeilnehmer(topic, wahl?.topic ?? null);
  const jetzt = useJetzt(liste.some((t) => t.l));
  const drin = wahl?.topic === topic;
  const lernen = liste.filter((t) => t.m === "fokus" && t.l).length;

  // Freigaben: im Raum „Alle“ anonym, in Hochschule/Gruppe mit Namen
  const [nameWahl, setNameZeigen] = useState<{ topic: string; an: boolean } | null>(null);
  const nameZeigen = nameWahl?.topic === topic ? nameWahl.an : raum.art !== "alle";
  const [fachZeigen, setFachZeigen] = useState(false);

  function beitreten(mitFokus: boolean) {
    fokusraumSchreiben({ topic, titel: raum.titel, nameZeigen, fachZeigen });
    if (mitFokus) {
      const z = timerLesen() ?? startZustand();
      // In einer Pause direkt in die nächste Fokus-Runde; Runden und Aufgabe bleiben erhalten
      if (!z.laeuft)
        timerSchreiben(
          starten(z.modus === "fokus" ? z : { ...startZustand(z.einstellungen, z.fachId), erledigteRunden: z.erledigteRunden, aufgabe: z.aufgabe ?? null, frage: z.frage ?? null }, Date.now()),
        );
    }
    track("fokusraum_beigetreten", { raum: raum.art, name: nameZeigen, fach: fachZeigen, mit_fokus: mitFokus });
  }

  function verlassen() {
    fokusraumSchreiben(null);
    track("fokusraum_verlassen", { raum: raum.art });
  }

  return (
    <>
      <header className="seitenkopf">
        <div>
          <h1>Fokusraum</h1>
          <p>Zusammen lernen, ohne Chat und ohne Video. Du siehst, wer gerade lernt, und wirst erst sichtbar, wenn du beitrittst.</p>
        </div>
        <div className="rechts">
          <Link href="/work-station" className="knopf leise">
            <PfeilText>Zur Work Station</PfeilText>
          </Link>
        </div>
      </header>

      <div className="fr-reiter" role="tablist" aria-label="Räume">
        {raeume.map((r) => (
          <button
            key={raumTopic(r)}
            type="button"
            role="tab"
            aria-selected={raumTopic(r) === topic}
            className={raumTopic(r) === topic ? "an" : undefined}
            onClick={() => {
              setAktivTopic(raumTopic(r));
            }}
          >
            {r.art === "gruppe" ? `Gruppe: ${r.titel}` : r.titel}
          </button>
        ))}
      </div>
      {!hochschuleBestaetigt && (
        <p className="fr-hinweis">
          Den Raum deiner Hochschule gibt es nach der Uni-Mail-Bestätigung. <Link href="/einstellungen" className="link">Uni-Mail bestätigen</Link>
        </p>
      )}

      <section className="fr-raum" aria-labelledby="fr-raum-titel">
        <div className="fr-kopf">
          <h2 id="fr-raum-titel">{raum.art === "gruppe" ? raum.titel : raum.art === "hs" ? raum.titel : "Alle"}</h2>
          <span className="fr-zahl">
            <span className="zahl">{lernen}</span> {lernen === 1 ? "lernt" : "lernen"} gerade
          </span>
        </div>

        {status === "fehler" ? (
          <p className="fr-leer">Der Raum lässt sich gerade nicht öffnen. Versuch es gleich noch einmal.</p>
        ) : status === "laedt" ? (
          <p className="fr-leer">Raum wird geöffnet …</p>
        ) : liste.length === 0 ? (
          <p className="fr-leer">Gerade ist niemand hier. Fang an, andere sehen dich dann.</p>
        ) : (
          <ul className="fr-plaetze">
            {liste.map((t) => (
              <Platz key={t.key} t={t} jetzt={jetzt} />
            ))}
          </ul>
        )}

        <div className="fr-fuss">
          {drin ? (
            <>
              <span className="fr-du">Du bist in diesem Raum sichtbar{wahl?.nameZeigen ? " mit Namen" : " als Anonym"}.</span>
              <button type="button" className="knopf neben" onClick={verlassen}>
                Raum verlassen
              </button>
            </>
          ) : (
            <>
              <label className="fr-freigabe">
                <input type="checkbox" checked={nameZeigen} onChange={(e) => setNameZeigen({ topic, an: e.target.checked })} />
                Namen zeigen
              </label>
              <label className="fr-freigabe">
                <input type="checkbox" checked={fachZeigen} onChange={(e) => setFachZeigen(e.target.checked)} />
                Fach zeigen
              </label>
              <button type="button" className="knopf neben" onClick={() => beitreten(false)}>
                Beitreten
              </button>
              <button type="button" className="knopf haupt" onClick={() => beitreten(true)}>
                Mit Fokus beitreten
              </button>
            </>
          )}
        </div>
        {wahl && !drin && <p className="fr-hinweis">Du bist gerade im Raum „{wahl.titel}“. Beitreten wechselt den Raum.</p>}
      </section>
    </>
  );
}
