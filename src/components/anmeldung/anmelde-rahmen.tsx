import type { ReactNode } from "react";
import { Icon } from "@/components/nav-icon";
import { AktivitaetZuruecksetzen } from "@/components/aktivitaet-zuruecksetzen";

/**
 * Rahmen für Anmelden, Registrieren, Passwort vergessen und Neues Passwort.
 * Links eine ruhige Markenfläche (Planet mit Bahn als feine Linie), rechts das Formular auf der Arbeitsfläche.
 * Vor dem Anmelden ist kein Design gewählt: es folgt dem System (Entscheidung Didi, 18.11.).
 */
export function AnmeldeRahmen({ children }: { children: ReactNode }) {
  return (
    <main className="anm" data-theme="system">
      <AktivitaetZuruecksetzen />
      <section className="anm-marke" aria-label="UniVerse">
        <svg className="anm-bahn" viewBox="0 0 560 420" fill="none" strokeLinecap="round" aria-hidden="true">
          <ellipse cx="280" cy="210" rx="262" ry="92" transform="rotate(-16 280 210)" />
          <circle className="anm-planet" cx="280" cy="210" r="104" />
          <path className="anm-planet" d="M30 268c70 98 430 -40 500 -116" />
        </svg>
        <p className="anm-wort">
          <span>Uni</span>Verse
        </p>
        <p className="anm-versprechen">Dein Studium an einem Ort. Aufgaben, Unterlagen und Lernen, ruhig geordnet.</p>
      </section>
      <div className="anm-flaeche">
        <p className="anm-kopf" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M3.5 14.5c2.5 3.5 14.5-1.5 17-6" />
          </svg>
          <span className="anm-wort">
            <span>Uni</span>Verse
          </span>
        </p>
        {children}
      </div>
    </main>
  );
}

/** Kurze Meldung oben im Formular. Info und Erfolg mit role="status", Fehler mit role="alert". */
export function AnmeldeMeldung({ art, children, aktion }: { art: "info" | "fehler" | "ok"; children: ReactNode; aktion?: ReactNode }) {
  return (
    <div id="anm-meldung" className={`anm-meldung ${art}`} role={art === "fehler" ? "alert" : "status"}>
      <Icon name={art === "fehler" ? "warnung" : art === "ok" ? "haken" : "info"} groesse={16} />
      <div>
        <p>{children}</p>
        {aktion}
      </div>
    </div>
  );
}
