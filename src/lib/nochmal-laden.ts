/**
 * Lädt ein Bündel Supabase-Abfragen und wiederholt es genau einmal, wenn eine davon
 * mit 401 abgelehnt wurde. Das passiert direkt nach dem Erneuern der Anmeldung:
 * Einzelne Abfragen gehen dann noch mit dem abgelaufenen Token raus, ein zweiter
 * Versuch Sekunden später klappt. Ohne Wiederholung fällt sonst die ganze Seite aus.
 */
export async function nochmalBei401<T extends readonly { status: number }[]>(laden: (signal: AbortSignal) => Promise<T>): Promise<T> {
  // Jeder Versuch bekommt ein eigenes Signal: Sonst liefert Next.js beim zweiten Versuch
  // die gemerkte Antwort des ersten (gleiche Anfrage im selben Seitenaufbau).
  const erst = await laden(new AbortController().signal);
  if (!erst.some((r) => r.status === 401)) return erst;
  return laden(new AbortController().signal);
}
