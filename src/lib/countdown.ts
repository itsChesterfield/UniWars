export function restMillisekunden(iso: string): number {
  return new Date(iso).getTime() - Date.now();
}

export function restzeitGross(iso: string): { wert: string; einheit: string } {
  const diffMs = restMillisekunden(iso);
  if (diffMs < 0) return { wert: "0", einheit: "überfällig" };
  const stunden = diffMs / 1000 / 60 / 60;
  if (stunden < 1) {
    const minuten = Math.max(1, Math.round(diffMs / 1000 / 60));
    return { wert: String(minuten), einheit: minuten === 1 ? "Minute" : "Minuten" };
  }
  if (stunden < 48) {
    const h = Math.round(stunden);
    return { wert: String(h), einheit: h === 1 ? "Stunde" : "Stunden" };
  }
  const tage = Math.round(stunden / 24);
  return { wert: String(tage), einheit: tage === 1 ? "Tag" : "Tage" };
}

export function absolutesDatum(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
