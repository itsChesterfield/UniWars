"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kalenderJetztAbgleichen, kalenderTrennen } from "@/app/kalender/actions";
import { track } from "@/lib/analytics";

const MELDUNG: Record<string, { text: string; fehler: boolean }> = {
  verbunden: { text: "Google Kalender verbunden – deine Einträge werden übertragen.", fehler: false },
  abgebrochen: { text: "Verbindung abgebrochen.", fehler: true },
  "rechte-fehlen": { text: "Bitte beide Berechtigungen erlauben, sonst funktioniert die Verbindung nicht.", fehler: true },
  "nicht-eingerichtet": { text: "Die Google-Verbindung ist noch nicht eingerichtet.", fehler: true },
  fehler: { text: "Verbinden hat nicht geklappt. Bitte erneut versuchen.", fehler: true },
};

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1V17A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  );
}

export function KalenderButton({
  konfiguriert,
  verbunden,
  probleme = [],
}: {
  konfiguriert: boolean;
  verbunden: boolean;
  probleme?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [menueOffen, setMenueOffen] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const meldung = MELDUNG[searchParams.get("kalender") ?? ""];

  function meldungSchliessen() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("kalender");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  function abgleichen() {
    setHinweis(null);
    startTransition(async () => {
      try {
        await kalenderJetztAbgleichen();
        track("kalender_abgeglichen", { ausloeser: "manuell" });
        setHinweis("Abgeglichen.");
        router.refresh();
      } catch {
        setHinweis("Abgleich fehlgeschlagen.");
      }
    });
  }

  function trennen() {
    if (!window.confirm("Google Kalender trennen? Der UniWars-Kalender wird dabei aus deinem Google-Konto entfernt.")) return;
    startTransition(async () => {
      await kalenderTrennen();
      track("kalender_getrennt", { anbieter: "google" });
      setMenueOffen(false);
      router.refresh();
    });
  }

  return (
    <div className="kalender-button">
      {verbunden ? (
        <button type="button" className="btng kalender-button-an" onClick={() => setMenueOffen((o) => !o)}>
          <GoogleIcon /> Google Kalender ✓
        </button>
      ) : (
        <a
          href={konfiguriert ? "/kalender/google/verbinden" : undefined}
          aria-disabled={!konfiguriert}
          className="btng kalender-button-aus"
          title={konfiguriert ? "Mit Google Kalender verbinden" : "Noch nicht eingerichtet"}
          onClick={(e) => {
            if (!konfiguriert) {
              e.preventDefault();
              setHinweis(
                `Die Google-Verbindung ist noch nicht eingerichtet${probleme.length ? `: ${probleme.join(", ")}` : "."}`,
              );
              return;
            }
            track("kalender_verbinden_geklickt", { anbieter: "google" });
          }}
        >
          <GoogleIcon /> Mit Google Kalender verbinden
        </a>
      )}

      {menueOffen && verbunden && (
        <div className="kalender-button-menue">
          <p className="muted" style={{ fontSize: 12 }}>
            Deine UniWars-Einträge erscheinen im Kalender „UniWars“. Termine aus Google siehst du hier
            nur als „Belegt“.
          </p>
          <button type="button" className="btng" disabled={isPending} onClick={abgleichen}>
            {isPending ? "…" : "Jetzt abgleichen"}
          </button>
          <button type="button" className="btng" disabled={isPending} onClick={trennen}>
            Verbindung trennen
          </button>
        </div>
      )}

      {(hinweis || meldung) && (
        <div className={`kalender-hinweis ${meldung?.fehler ? "kalender-hinweis-fehler" : ""}`}>
          <span>{hinweis ?? meldung?.text}</span>
          <button
            type="button"
            aria-label="Hinweis schließen"
            onClick={() => {
              setHinweis(null);
              if (meldung) meldungSchliessen();
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
