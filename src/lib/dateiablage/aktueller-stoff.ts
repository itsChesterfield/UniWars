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
