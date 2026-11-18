/** Reine Rechenhilfen für Bewegung, ohne Browser (testbar mit node --test). */
/** Versatz zwischen Elementen, die nacheinander erscheinen (Token --stagger) */
export const STAGGER_MS = 30;
/** Höchstens so viele Elemente bekommen einen eigenen Versatz, der Rest kommt mit dem letzten */
export const STAGGER_MAX = 6;

/** Verzögerung für das n-te Element einer Folge, gedeckelt bei STAGGER_MAX */
export function staffel(n: number): number {
  return Math.min(Math.max(n, 0), STAGGER_MAX - 1) * STAGGER_MS;
}

export type RollZeichen = { neu: string; alt: string | null; verzoegerung: number };

/**
 * Zerlegt einen Wechsel von `alt` nach `neu` in Zeichen für das Rollen (wie bei Mistral):
 * Gleich lange Werte rollen Zeichen für Zeichen, nur geänderte Zeichen bewegen sich, nacheinander versetzt.
 * Ändert sich die Länge, rollt der ganze Wert als ein Stück.
 */
export function rollZeichen(alt: string | null, neu: string): RollZeichen[] {
  if (alt == null || alt === neu) return [{ neu, alt: null, verzoegerung: 0 }];
  if (alt.length !== neu.length) return [{ neu, alt, verzoegerung: 0 }];
  let geaendert = 0;
  return [...neu].map((z, i) => (z === alt[i] ? { neu: z, alt: null, verzoegerung: 0 } : { neu: z, alt: alt[i], verzoegerung: staffel(geaendert++) }));
}
