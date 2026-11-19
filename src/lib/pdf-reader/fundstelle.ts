export function pdfPfad(id: string, seite?: number): string {
  const pfad = `/pdf-reader/${encodeURIComponent(id)}`;
  return seite && Number.isSafeInteger(seite) && seite > 0 ? `${pfad}?seite=${seite}` : pfad;
}

export function pdfAusschnitt(text: string, begriff: string) {
  if (!begriff) return null;
  const index = text.toLowerCase().indexOf(begriff.toLowerCase());
  if (index < 0) return null;
  const start = Math.max(0, index - 45);
  const bis = index + begriff.length;
  const ende = Math.min(text.length, bis + 65);
  return {
    davor: (start > 0 ? "…" : "") + text.slice(start, index),
    begriff: text.slice(index, bis),
    danach: text.slice(bis, ende) + (ende < text.length ? "…" : ""),
  };
}

export function pdfMarkdownLink(titel: string, id: string, seite: number, ursprung: string): string {
  const label = titel.replaceAll("[", "\\[").replaceAll("]", "\\]").replace(/[\r\n]+/g, " ");
  return `[${label}, S. ${seite}](${ursprung}${pdfPfad(id, seite)})`;
}


export function pdfLinkLesen(eingabe: string, ursprung: string): { id: string; seite: number } | null {
  if (eingabe.length > 4096) return null;
  const text = eingabe.trim();
  const markdown = /^\[.+\]\(([^\s()]+)\)$/.exec(text);
  const link = markdown?.[1] ?? text;
  try {
    const url = new URL(link, ursprung);
    if (url.origin !== ursprung || url.username || url.password) return null;
    const treffer = /^\/pdf-reader\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.exec(url.pathname);
    const seite = Number(url.searchParams.get("seite"));
    return treffer && Number.isSafeInteger(seite) && seite > 0 && seite <= 100000 ? { id: treffer[1], seite } : null;
  } catch {
    return null;
  }
}
