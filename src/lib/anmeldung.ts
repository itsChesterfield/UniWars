/**
 * Anmeldung und Registrierung: Fehler von Supabase in kurze deutsche Sätze übersetzen
 * und die Adressen zwischen den Seiten bauen. Rein, ohne Supabase-Import, damit Tests sie prüfen.
 */

export type AuthFehler = { message: string; code?: string; status?: number };

/** Ergebnis einer fehlgeschlagenen Anmeldung: entweder „noch nicht bestätigt“ oder ein Text */
export type AnmeldeFehler = { art: "unbestaetigt" } | { art: "text"; text: string };

export function anmeldeFehler(error: AuthFehler): AnmeldeFehler {
  const code = error.code ?? "";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(error.message)) return { art: "unbestaetigt" };
  if (code === "invalid_credentials" || /invalid login credentials/i.test(error.message)) {
    return { art: "text", text: "E-Mail oder Passwort stimmt nicht." };
  }
  if (code === "over_request_rate_limit" || error.status === 429) {
    return { art: "text", text: "Zu viele Versuche. Bitte warte einen Moment und versuch es dann noch einmal." };
  }
  return { art: "text", text: "Die Anmeldung hat nicht geklappt. Bitte versuch es gleich noch einmal." };
}

/** Fehler beim Erneut-Senden der Bestätigungsmail */
export function sendeFehler(error: AuthFehler): string {
  if (error.code === "over_email_send_rate_limit" || error.status === 429) {
    const sekunden = error.message.match(/after (\d+) seconds/)?.[1];
    return sekunden
      ? `Der Link ist gerade erst rausgegangen. Warte ${sekunden} Sekunden und schau solange im Spam-Ordner.`
      : "Gerade wurden zu viele E-Mails verschickt. Bitte versuch es später noch einmal.";
  }
  return "Der Link konnte nicht verschickt werden. Bitte versuch es später noch einmal.";
}

/**
 * Fehler beim Registrieren. Ob eine E-Mail schon ein Konto hat, verrät die App nie (AGENTS.md 3.6,
 * Entscheidung Didi 18.11.): Supabase meldet das bei eingeschalteter Bestätigung ohnehin nicht als Fehler,
 * und ein „user_already_exists“ landet beim allgemeinen Text.
 */
export function registrierFehler(error: AuthFehler): { feld: "nutzername" | "email" | "passwort" | null; text: string } {
  const code = error.code ?? "";
  if (error.message.includes("USERNAME_TAKEN")) return { feld: "nutzername", text: "Dieser Nutzername ist schon vergeben." };
  if (code === "email_address_invalid" || code === "validation_failed") return { feld: "email", text: "Diese E-Mail-Adresse ist ungültig." };
  if (code === "weak_password") return { feld: "passwort", text: "Das Passwort ist zu schwach. Nimm mindestens 6 Zeichen." };
  if (code === "over_email_send_rate_limit" || error.status === 429) {
    return { feld: null, text: "Gerade wurden zu viele E-Mails verschickt. Bitte versuch es später noch einmal." };
  }
  return { feld: null, text: "Das Konto konnte nicht erstellt werden. Bitte versuch es gleich noch einmal." };
}

/** Adresse mit Suchparametern; leere Werte fallen weg */
export function adresse(pfad: string, werte: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(werte)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${pfad}?${s}` : pfad;
}

/** Meldung im Anmeldefenster, gesteuert über `?bestaetigen=` */
export function bestaetigenText(wert: string | undefined, email: string | undefined): string | null {
  const an = email ? `an ${email}` : "an deine E-Mail-Adresse";
  if (wert === "1") return `Bestätige noch deine E-Mail. Der Link ist ${an} unterwegs.`;
  if (wert === "offen") return "Deine E-Mail ist noch nicht bestätigt. Schau in dein Postfach, auch im Spam-Ordner.";
  if (wert === "gesendet") return `Neuer Link ist ${an} unterwegs.`;
  return null;
}
