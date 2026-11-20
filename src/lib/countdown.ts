export function restMillisekunden(iso: string, jetzt: number = Date.now()): number {
  return new Date(iso).getTime() - jetzt;
}

/**
 * Restzeit als Zahl und Einheit („23“ „Stunden“). Ist die Frist vorbei, steht die Zeit seitdem da
 * und `ueberfaellig` ist gesetzt („2“ „Tage“, überfällig); nie „0 überfällig“.
 */
export function restzeitGross(iso: string, jetzt: number = Date.now()): { wert: string; einheit: string; ueberfaellig: boolean } {
  const diffMs = restMillisekunden(iso, jetzt);
  const ueberfaellig = diffMs < 0;
  const abstand = Math.abs(diffMs);
  const stunden = abstand / 1000 / 60 / 60;
  if (stunden < 1) {
    const minuten = Math.max(1, Math.round(abstand / 1000 / 60));
    return { wert: String(minuten), einheit: minuten === 1 ? "Minute" : "Minuten", ueberfaellig };
  }
  if (stunden < 48) {
    const h = Math.round(stunden);
    return { wert: String(h), einheit: h === 1 ? "Stunde" : "Stunden", ueberfaellig };
  }
  const tage = Math.round(stunden / 24);
  return { wert: String(tage), einheit: tage === 1 ? "Tag" : "Tage", ueberfaellig };
}

/** Restzeit als kurzer Satzteil: „23 Stunden übrig“, „2 Tage überfällig“. */
export function restzeitText(iso: string, jetzt: number = Date.now()): string {
  const { wert, einheit, ueberfaellig } = restzeitGross(iso, jetzt);
  return `${wert} ${einheit} ${ueberfaellig ? "überfällig" : "übrig"}`;
}

const ZONE = "Europe/Berlin";

/**
 * Das eine Datumsformat der Aufgaben und Termine: „20. Nov., 23:59“, in einem anderen Jahr „15. Jan. 2027, 10:00“.
 * Immer in Berliner Zeit, damit Server und Browser dasselbe anzeigen.
 */
export function absolutesDatum(iso: string, jetzt: number = Date.now()): string {
  const wann = new Date(iso);
  const jahr = (d: Date) => new Intl.DateTimeFormat("de-DE", { year: "numeric", timeZone: ZONE }).format(d);
  const anderesJahr = jahr(wann) !== jahr(new Date(jetzt));
  return wann.toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    ...(anderesJahr ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    timeZone: ZONE,
  });
}
