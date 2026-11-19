import "server-only";

import { unzipSync, strFromU8 } from "fflate";
import { MAX_DATEI_BYTES } from "./dateien";

export const POWERPOINT_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function xmlText(text: string): string {
  return text.replace(/&(amp|lt|gt|apos|quot|#\d{1,7}|#x[0-9a-fA-F]{1,6});/g, (_, zeichen: string) => {
    if (!zeichen.startsWith("#")) {
      return ({ amp: "&", lt: "<", gt: ">", apos: "'", quot: '"' })[zeichen] ?? "";
    }
    const wert = zeichen.startsWith("#x") ? parseInt(zeichen.slice(2), 16) : Number(zeichen.slice(1));
    return wert > 0 && wert <= 0x10ffff ? String.fromCodePoint(wert) : "";
  });
}

async function officeXml(blob: Blob, pfade: string[]) {
  if (blob.size > MAX_DATEI_BYTES) return {};
  const gesucht = new Set(pfade);
  try {
    return unzipSync(new Uint8Array(await blob.arrayBuffer()), {
      filter: (datei) => datei.originalSize <= 2_000_000 && gesucht.delete(datei.name),
    });
  } catch {
    return {};
  }
}

export async function wordText(blob: Blob): Promise<string[]> {
  const pfad = "word/document.xml";
  const eintrag = (await officeXml(blob, [pfad]))[pfad];
  if (!eintrag) return [];
  const zeilen: string[] = [];
  for (const absatz of strFromU8(eintrag).matchAll(/<w:p(?:\s[^>]*)?>((?:(?!<w:p[\s>])[\s\S])*?)<\/w:p>/g)) {
    const text = Array.from(absatz[1].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g), (teil) => xmlText(teil[1])).join("").trim();
    if (text) zeilen.push(text.slice(0, 400));
    if (zeilen.length === 8) break;
  }
  return zeilen;
}

export async function excelZellen(blob: Blob): Promise<string[][]> {
  const pfad = "xl/worksheets/sheet1.xml";
  const textPfad = "xl/sharedStrings.xml";
  const dateien = await officeXml(blob, [pfad, textPfad]);
  if (!dateien[pfad]) return [];
  const texte = dateien[textPfad] ? Array.from(strFromU8(dateien[textPfad]).matchAll(/<si(?:\s[^>]*)?>((?:(?!<si[\s>])[\s\S])*?)<\/si>/g),
    (eintrag) => Array.from(eintrag[1].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g), (teil) => xmlText(teil[1])).join("")) : [];
  const zeilen: string[][] = [];
  for (const zelle of strFromU8(dateien[pfad]).matchAll(/<c\b([^<>]*?)(?:\/>|>((?:(?!<c[\s>])[\s\S])*?)<\/c>)/g)) {
    const position = /\br="([A-F][1-8])"/.exec(zelle[1])?.[1];
    if (!position || !zelle[2]) continue;
    const spalte = position.charCodeAt(0) - 65;
    const zeile = Number(position[1]) - 1;
    const roh = /<v>([^<]*)<\/v>/.exec(zelle[2])?.[1] ?? "";
    const typ = /\bt="([^"]+)"/.exec(zelle[1])?.[1];
    const text = typ === "s" && roh !== "" ? texte[Number(roh)] ?? "" :
      typ === "inlineStr" ? Array.from(zelle[2].matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g), (teil) => xmlText(teil[1])).join("") :
      xmlText(roh);
    if (!text) continue;
    while (zeilen.length <= zeile) zeilen.push([]);
    const rechteSpalte = Math.max(spalte, ...zeilen.map((z) => z.length - 1));
    for (const z of zeilen) while (z.length <= rechteSpalte) z.push("");
    zeilen[zeile][spalte] = text.slice(0, 120);
  }
  return zeilen;
}

export async function powerpointText(blob: Blob, limit: number): Promise<{ seite: number; text: string }[]> {
  if (blob.size > MAX_DATEI_BYTES || limit < 1) return [];
  const folienLimit = Math.min(limit, 20);
  const gelesen = new Set<number>();
  try {
    const dateien = unzipSync(new Uint8Array(await blob.arrayBuffer()), {
      filter: (datei) => {
        const treffer = /^ppt\/slides\/slide(\d+)\.xml$/.exec(datei.name);
        if (!treffer || datei.originalSize >= 200_000) return false;
        const seite = Number(treffer[1]);
        if (seite < 1 || seite > folienLimit || gelesen.has(seite)) return false;
        gelesen.add(seite);
        return true;
      },
    });
    return [...gelesen].sort((a, b) => a - b).flatMap((seite) => {
      const folie = dateien[`ppt/slides/slide${seite}.xml`];
      if (!folie) return [];
      const text = [...strFromU8(folie).matchAll(/<a:t>([^<]{0,3000})<\/a:t>/g)].slice(0, 16)
        .map((treffer) => xmlText(treffer[1]))
        .join("\n").slice(0, 6000);
      return text ? [{ seite, text }] : [];
    });
  } catch {
    return [];
  }
}
