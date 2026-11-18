"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ANGEMELDET_BLEIBEN, GEMERKTE_EMAIL } from "@/lib/inaktivitaet";

/**
 * E-Mail, Passwort und „Angemeldet bleiben“ für die Anmeldeseite.
 * Mit Häkchen: kein automatisches Abmelden nach 5 Minuten auf diesem Gerät, E-Mail wird vorausgefüllt.
 * Passwörter speichert der Browser bzw. Passwort-Manager (autocomplete), nie die App.
 */
export function LoginFelder({ email: vorgabe, passwortFalsch = false }: { email?: string; passwortFalsch?: boolean }) {
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
      <div className="anm-feld">
        <label htmlFor="email">E-Mail</label>
        <input
          ref={email}
          id="email"
          name="email"
          type="email"
          placeholder="name@hochschule.de"
          defaultValue={vorgabe}
          required
          autoComplete="username"
          autoFocus={!vorgabe}
        />
      </div>

      <div className="anm-feld">
        <span className="anm-feld-kopf">
          <label htmlFor="password">Passwort</label>
          <Link className="link" href="/forgot-password">
            Passwort vergessen?
          </Link>
        </span>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          autoFocus={Boolean(vorgabe)}
          aria-invalid={passwortFalsch || undefined}
          aria-describedby={passwortFalsch ? "anm-meldung" : undefined}
        />
      </div>

      <label className="anm-bleiben">
        <input type="checkbox" name="bleiben" checked={bleiben} onChange={(e) => setBleiben(e.target.checked)} />
        <span>
          Angemeldet bleiben
          <small>Auf diesem Gerät nicht nach 5 Minuten abmelden und E-Mail merken. Nicht auf fremden Geräten nutzen.</small>
        </span>
      </label>
    </>
  );
}
