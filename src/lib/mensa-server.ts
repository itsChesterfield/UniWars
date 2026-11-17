import "server-only";
import { berlinDatum } from "@/lib/zeit";
import { gerichteAufbereiten, naechsterOffenerTag, type Mensa, type Speiseplan } from "@/lib/mensa";

const API = "https://openmensa.org/api/v2";

async function holen(pfad: string, sekunden: number): Promise<unknown> {
  const r = await fetch(`${API}${pfad}`, { next: { revalidate: sekunden }, signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`OpenMensa ${r.status}`);
  return r.json();
}

/** Alle Mensen (ca. 1.300, 14 Seiten) – einen Tag zwischengespeichert */
export async function mensenListe(): Promise<Mensa[]> {
  const seiten = await Promise.all(Array.from({ length: 20 }, (_, i) => holen(`/canteens?limit=100&page=${i + 1}`, 86_400).catch(() => [])));
  return seiten
    .flatMap((s) => (Array.isArray(s) ? s : []))
    .filter((m): m is { id: number; name: string; city?: string | null } => typeof m?.id === "number" && typeof m?.name === "string")
    .map((m) => ({ id: m.id, name: m.name, stadt: m.city ?? null }));
}

/** Speiseplan für heute, sonst den nächsten geöffneten Tag – 30 Minuten zwischengespeichert */
export async function speiseplan(mensaId: number, mensaName: string): Promise<Speiseplan | null> {
  try {
    const heute = berlinDatum(new Date());
    const tag = naechsterOffenerTag(await holen(`/canteens/${mensaId}/days`, 1800), heute);
    if (!tag) return { mensa: mensaName, datum: null, heute: false, gerichte: [] };
    const gerichte = gerichteAufbereiten(await holen(`/canteens/${mensaId}/days/${tag}/meals`, 1800));
    return { mensa: mensaName, datum: tag, heute: tag === heute, gerichte };
  } catch {
    return null;
  }
}
