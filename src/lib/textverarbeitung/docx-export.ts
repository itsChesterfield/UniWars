"use client";

// TXT-06: Export als Word-Datei (.docx) direkt im Browser.
import type { JSONContent } from "@tiptap/react";

type Docx = typeof import("docx");
type Kind = InstanceType<Docx["Paragraph"]> | InstanceType<Docx["Table"]>;

type Format = { bold?: boolean; italics?: boolean; underline?: boolean; code?: boolean; strike?: boolean };

const MAX_BILD_BREITE = 600;

async function bildLaden(src: string): Promise<{ data: ArrayBuffer; typ: "png" | "jpg"; breite: number; hoehe: number } | null> {
  try {
    const antwort = await fetch(src);
    if (!antwort.ok) return null;
    const blob = await antwort.blob();
    const typ = blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : null;
    if (!typ) return null;
    const bitmap = await createImageBitmap(blob);
    const faktor = Math.min(1, MAX_BILD_BREITE / bitmap.width);
    const masse = { breite: Math.round(bitmap.width * faktor), hoehe: Math.round(bitmap.height * faktor) };
    bitmap.close();
    return { data: await blob.arrayBuffer(), typ, ...masse };
  } catch {
    return null;
  }
}

export async function alsDocx(titel: string, inhalt: JSONContent): Promise<Blob> {
  const d = await import("docx");
  let listenInstanz = 0;

  function laeufe(knoten: JSONContent[] | undefined, basis: Format = {}): InstanceType<Docx["TextRun"]>[] {
    const ergebnis: InstanceType<Docx["TextRun"]>[] = [];
    for (const k of knoten ?? []) {
      if (k.type === "hardBreak") {
        ergebnis.push(new d.TextRun({ text: "", break: 1 }));
        continue;
      }
      if (k.type !== "text" || !k.text) continue;
      const f: Format = { ...basis };
      for (const m of k.marks ?? []) {
        if (m.type === "bold") f.bold = true;
        if (m.type === "italic") f.italics = true;
        if (m.type === "underline") f.underline = true;
        if (m.type === "code") f.code = true;
        if (m.type === "strike") f.strike = true;
      }
      ergebnis.push(
        new d.TextRun({
          text: k.text,
          bold: f.bold,
          italics: f.italics,
          strike: f.strike,
          underline: f.underline ? {} : undefined,
          font: f.code ? "Courier New" : undefined,
        }),
      );
    }
    return ergebnis;
  }

  async function bloecke(knoten: JSONContent[] | undefined, liste?: { art: "bullet" | "nummer"; ebene: number; instanz: number }, format: Format = {}): Promise<Kind[]> {
    const ergebnis: Kind[] = [];
    for (const k of knoten ?? []) {
      switch (k.type) {
        case "heading": {
          const ebene = Number(k.attrs?.level ?? 1);
          const heading = ebene === 1 ? d.HeadingLevel.HEADING_1 : ebene === 2 ? d.HeadingLevel.HEADING_2 : d.HeadingLevel.HEADING_3;
          ergebnis.push(new d.Paragraph({ heading, children: laeufe(k.content) }));
          break;
        }
        case "paragraph": {
          const bilder = (k.content ?? []).filter((c) => c.type === "image");
          const kinder: (InstanceType<Docx["TextRun"]> | InstanceType<Docx["ImageRun"]>)[] = laeufe(k.content, format);
          for (const b of bilder) {
            const bild = await bildLaden(String(b.attrs?.src ?? ""));
            if (bild) kinder.push(new d.ImageRun({ type: bild.typ, data: bild.data, transformation: { width: bild.breite, height: bild.hoehe } }));
          }
          ergebnis.push(
            new d.Paragraph({
              children: kinder,
              ...(liste?.art === "bullet" ? { bullet: { level: liste.ebene } } : {}),
              ...(liste?.art === "nummer" ? { numbering: { reference: "nummern", level: liste.ebene, instance: liste.instanz } } : {}),
            }),
          );
          break;
        }
        case "image": {
          const bild = await bildLaden(String(k.attrs?.src ?? ""));
          if (bild) {
            ergebnis.push(
              new d.Paragraph({
                children: [new d.ImageRun({ type: bild.typ, data: bild.data, transformation: { width: bild.breite, height: bild.hoehe } })],
              }),
            );
          }
          break;
        }
        case "bulletList":
        case "orderedList":
        case "taskList": {
          const art = k.type === "orderedList" ? "nummer" : "bullet";
          const ebene = liste ? Math.min(liste.ebene + 1, 8) : 0;
          const instanz = art === "nummer" ? ++listenInstanz : 0;
          for (const eintrag of k.content ?? []) {
            ergebnis.push(...(await bloecke(eintrag.content, { art, ebene, instanz })));
          }
          break;
        }
        case "blockquote":
          for (const p of await bloecke(k.content, liste, { ...format, italics: true })) ergebnis.push(p);
          break;
        case "codeBlock":
          for (const zeile of (k.content?.map((c) => c.text ?? "").join("") ?? "").split("\n")) {
            ergebnis.push(new d.Paragraph({ children: [new d.TextRun({ text: zeile, font: "Courier New", size: 20 })] }));
          }
          break;
        case "horizontalRule":
          ergebnis.push(new d.Paragraph({ thematicBreak: true, children: [] }));
          break;
        case "table": {
          const zeilen = [];
          for (const zeile of k.content ?? []) {
            const zellen = [];
            for (const zelle of zeile.content ?? []) {
              const inhaltZelle = (await bloecke(zelle.content, undefined, zelle.type === "tableHeader" ? { bold: true } : {})).filter(
                (x): x is InstanceType<Docx["Paragraph"]> => x instanceof d.Paragraph,
              );
              zellen.push(
                new d.TableCell({
                  children: inhaltZelle.length ? inhaltZelle : [new d.Paragraph("")],
                  columnSpan: Number(zelle.attrs?.colspan ?? 1),
                  rowSpan: Number(zelle.attrs?.rowspan ?? 1),
                }),
              );
            }
            zeilen.push(new d.TableRow({ children: zellen }));
          }
          if (zeilen.length) ergebnis.push(new d.Table({ rows: zeilen, width: { size: 100, type: d.WidthType.PERCENTAGE } }));
          ergebnis.push(new d.Paragraph(""));
          break;
        }
        default:
          if (k.content) ergebnis.push(...(await bloecke(k.content, liste, format)));
      }
    }
    return ergebnis;
  }

  const kinder = await bloecke(inhalt.content);
  const dokument = new d.Document({
    title: titel,
    creator: "UniWars",
    styles: { default: { document: { run: { font: "Calibri", size: 24 } } } },
    numbering: {
      config: [
        {
          reference: "nummern",
          levels: Array.from({ length: 9 }, (_, ebene) => ({
            level: ebene,
            format: d.LevelFormat.DECIMAL,
            text: `%${ebene + 1}.`,
            alignment: d.AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (ebene + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [
      {
        children: [new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [new d.TextRun(titel)] }), ...kinder],
      },
    ],
  });
  return d.Packer.toBlob(dokument);
}

export function dateiSpeichern(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function dateiname(titel: string, endung: string) {
  const sauber = titel.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Dokument";
  return `${sauber.slice(0, 100)}.${endung}`;
}
