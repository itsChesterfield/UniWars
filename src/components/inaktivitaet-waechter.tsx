"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { inaktivAbmelden } from "@/app/logout/actions";
import { createClient } from "@/lib/supabase/client";
import { INAKTIV_MS, inaktivStand, LETZTE_AKTIVITAET, wirdAktivGehalten } from "@/lib/inaktivitaet";
import { istEingebettet } from "@/lib/geteilte-ansicht";
import { timerLesen } from "@/lib/work-station/timer-store";
import { abmelden, track } from "@/lib/analytics";

const EREIGNISSE = ["pointerdown", "keydown", "wheel", "touchstart", "scroll", "mousemove"] as const;

function letzteLesen(fallback: number): number {
  try {
    const w = Number(window.localStorage.getItem(LETZTE_AKTIVITAET));
    return Number.isFinite(w) && w > 0 ? w : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Meldet nach 5 Minuten ohne Eingabe ab (über alle Tabs hinweg – Aktivität in einem Tab zählt für alle).
 * 30 Sekunden vorher erscheint ein Hinweis mit „Angemeldet bleiben“. Eine laufende Aufnahme,
 * Wiedergabe oder ein laufender Work-Station-Timer halten die Sitzung wach.
 */
export function InaktivitaetsWaechter() {
  const [rest, setRest] = useState<number | null>(null);
  const letzte = useRef(0);
  const abgemeldet = useRef(false);

  const merken = useCallback(() => {
    const jetzt = Date.now();
    // höchstens alle 5 s schreiben (mousemove feuert sehr oft)
    if (jetzt - letzte.current < 5000) return;
    letzte.current = jetzt;
    try {
      window.localStorage.setItem(LETZTE_AKTIVITAET, String(jetzt));
    } catch {
      // ohne Speicher zählt nur dieser Tab
    }
    setRest(null);
  }, []);

  const pruefen = useCallback(() => {
    if (abgemeldet.current) return;
    const jetzt = Date.now();
    const z = timerLesen();
    const timerLaeuft = Boolean(z?.laeuft && z.endetUm && z.endetUm > jetzt);
    const zuletzt = Math.max(letzte.current, letzteLesen(letzte.current));
    const stand = inaktivStand(zuletzt, jetzt, wirdAktivGehalten() || timerLaeuft);
    if (stand === "abmelden") {
      abgemeldet.current = true;
      track("automatisch_abgemeldet");
      abmelden();
      // Server-Abmeldung (leitet zur Anmeldung um); falls die nicht geht: im Browser abmelden und neu laden
      void inaktivAbmelden().catch(async () => {
        await createClient()
          .auth.signOut()
          .catch(() => undefined);
        window.location.reload();
      });
    } else if (stand === "warnung") {
      setRest(Math.max(0, Math.ceil((zuletzt + INAKTIV_MS - jetzt) / 1000)));
    } else {
      setRest(null);
    }
  }, []);

  useEffect(() => {
    // In der zweiten Ansicht (iframe) entscheidet das Hauptfenster
    if (istEingebettet()) return;
    const jetzt = Date.now();
    // Seite nach längerer Pause wieder geöffnet → sofort prüfen, sonst Aktivität merken
    letzte.current = letzteLesen(jetzt);
    if (jetzt - letzte.current >= INAKTIV_MS) {
      pruefen();
      return;
    }
    letzte.current = 0;
    merken();
    for (const e of EREIGNISSE) window.addEventListener(e, merken, { passive: true, capture: true });
    const sichtbar = () => document.visibilityState === "visible" && pruefen();
    document.addEventListener("visibilitychange", sichtbar);
    const takt = window.setInterval(pruefen, 1000);
    return () => {
      for (const e of EREIGNISSE) window.removeEventListener(e, merken, { capture: true });
      document.removeEventListener("visibilitychange", sichtbar);
      window.clearInterval(takt);
    };
  }, [merken, pruefen]);

  if (rest === null) return null;
  return (
    <div className="inaktiv-hinweis" role="alertdialog" aria-live="assertive" aria-label="Automatische Abmeldung">
      <p>
        Du wirst in <strong>{rest} s</strong> wegen Inaktivität abgemeldet.
      </p>
      <button
        type="button"
        className="btnp"
        onClick={() => {
          letzte.current = 0;
          merken();
          track("abmeldung_verhindert");
        }}
      >
        Angemeldet bleiben
      </button>
    </div>
  );
}
