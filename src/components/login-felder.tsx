"use client";

import { useEffect, useRef, useState } from "react";
import { ANGEMELDET_BLEIBEN, GEMERKTE_EMAIL } from "@/lib/inaktivitaet";

/**
 * E-Mail, Passwort und „Angemeldet bleiben“ für die Anmeldeseite.
 * Mit Häkchen: kein automatisches Abmelden nach 5 Minuten auf diesem Gerät, E-Mail wird vorausgefüllt.
 * Passwörter speichert der Browser bzw. Passwort-Manager (autocomplete), nie die App.
 */
export function LoginFelder() {
  const [bleiben, setBleiben] = useState(false);
  const email = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const an = window.localStorage.getItem(ANGEMELDET_BLEIBEN) === "1";
      const gemerkt = window.localStorage.getItem(GEMERKTE_EMAIL);
      // Zustand aus dem Browser übernehmen (gibt es erst nach dem Laden)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBleiben(an);
      if (an && gemerkt && email.current && !email.current.value) email.current.value = gemerkt;
    } catch {
      // ohne Speicher bleibt alles leer
    }
  }, []);

  // Beim Absenden merken (das Formular selbst geht an die Server Action)
  useEffect(() => {
    const form = email.current?.form;
    if (!form) return;
    const merken = () => {
      try {
        if (bleiben) {
          window.localStorage.setItem(ANGEMELDET_BLEIBEN, "1");
          window.localStorage.setItem(GEMERKTE_EMAIL, email.current?.value.trim() ?? "");
        } else {
          window.localStorage.removeItem(ANGEMELDET_BLEIBEN);
          window.localStorage.removeItem(GEMERKTE_EMAIL);
        }
      } catch {
        // ohne Speicher: nichts merken
      }
    };
    form.addEventListener("submit", merken);
    return () => form.removeEventListener("submit", merken);
  }, [bleiben]);

  return (
    <>
      <div className="auth-field">
        <label htmlFor="email" className="sr-only">
          E-Mail
        </label>
        <input ref={email} id="email" name="email" type="email" placeholder="E-Mail" required autoComplete="username" />
      </div>

      <div className="auth-field">
        <label htmlFor="password" className="sr-only">
          Passwort
        </label>
        <input id="password" name="password" type="password" placeholder="Passwort" required autoComplete="current-password" />
      </div>

      <label className="auth-bleiben">
        <input type="checkbox" name="bleiben" checked={bleiben} onChange={(e) => setBleiben(e.target.checked)} />
        <span>
          Angemeldet bleiben
          <small>Auf diesem Gerät nicht nach 5 Minuten abmelden und E-Mail merken. Nicht auf fremden Geräten nutzen.</small>
        </span>
      </label>
    </>
  );
}
