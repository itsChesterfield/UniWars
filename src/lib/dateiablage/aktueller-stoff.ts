function stoffWoerter(text: string): string[] {
  return text.normalize("NFKC").toLocaleLowerCase("de-DE").match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function fragtNachLetztemStoff(frage: string): boolean {
  const text = stoffWoerter(frage).join(" ");
  const zeitraum = /\b(?:zuletzt|letzt(?:e[rmns]?)?|verpasst)\b/.test(text);
  if (/\bcrashkurs\b/.test(text)) return true;
  if (!zeitraum) return false;
  return /\b(?:stoff|vorlesung(?:en)?|unterricht|durchgenommen|behandelt|besprochen|gelernt)\b/.test(text)
    || (/\bwir\b/.test(text) && /\b(?:gemacht|gearbeitet|angeschaut)\b/.test(text));
}

export function fachAusStofffrage<T extends { name: string }>(frage: string, faecher: T[]): T | undefined {
  const text = ` ${stoffWoerter(frage).join(" ")} `;
  return faecher.map((fach) => ({ fach, name: stoffWoerter(fach.name).join(" ") }))
    .filter(({ name }) => name && text.includes(` ${name} `))
    .sort((a, b) => b.name.length - a.name.length)[0]?.fach;
}

export function aktuelleMaterialfolge<T>(
  termine: { datum: string; material: T }[],
  hinzugefuegt: { zeit: string; material: T }[],
  heute: string,
  schluessel: (m: T) => string,
) {
  const aktuell = termine.filter((t) => t.datum <= heute).sort((a, b) => b.datum.localeCompare(a.datum));
  const tage = [...new Set(aktuell.map((t) => t.datum))].slice(0, 3);
  const nachDatum = aktuell.filter((t) => tage.includes(t.datum)).map((t) => t.material);
  const terminMaterial = new Set(termine.map((t) => schluessel(t.material)));
  const fallback = hinzugefuegt.filter((q) => !terminMaterial.has(schluessel(q.material)))
    .sort((a, b) => b.zeit.localeCompare(a.zeit)).map((q) => q.material);
  const basis = nachDatum.length ? "vorlesungen" : "uploads";
  const gesehen = new Set<string>();
  return {
    basis,
    material: (nachDatum.length ? nachDatum : fallback).filter((q) => {
      const id = schluessel(q);
      if (gesehen.has(id)) return false;
      gesehen.add(id);
      return true;
    }).slice(0, 12),
  } as const;
}
