import { nameOhneEndung } from "./dateien.ts";

export function istWebLink(datei: { speicher_pfad: string; mime_typ: string }): boolean {
  return datei.mime_typ === "text/plain" && /^[^/]+\/weblinks\/[^/]+\.txt$/.test(datei.speicher_pfad);
}

export function ablageDateiname(datei: { speicher_pfad: string; mime_typ: string; name: string }): string {
  return istWebLink(datei) ? nameOhneEndung(datei.name) : datei.name;
}

export function webLinkUrl(eingabe: string): URL | null {
  if (typeof eingabe !== "string" || eingabe.length > 2048) return null;
  const text = eingabe.trim();
  if (!text || /\s/.test(text)) return null;
  try {
    const url = new URL(text);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password && url.href.length <= 2048 ? url : null;
  } catch {
    return null;
  }
}
