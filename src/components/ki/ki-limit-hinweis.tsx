/** KI-ALL-03: verbleibendes Kontingent, z. B. „Heute noch 14 von 20 KI-Anfragen“. */
export function KiLimitHinweis({
  verbleibend,
  limit,
  einheit = "KI-Anfragen",
  zeitraum = "tag",
}: {
  verbleibend: number;
  limit: number;
  einheit?: string;
  zeitraum?: "tag" | "monat";
}) {
  const rest = Math.max(0, verbleibend);
  return (
    <span className={`muted ki-limit ${rest === 0 ? "leer" : ""}`} aria-live="polite">
      {zeitraum === "tag" ? "Heute" : "Diesen Monat"} noch {rest.toLocaleString("de-DE")} von {limit.toLocaleString("de-DE")} {einheit}
    </span>
  );
}
