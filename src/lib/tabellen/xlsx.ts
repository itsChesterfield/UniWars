// TAB-06: Minimaler XLSX-Schreiber (Office Open XML) – Werte, Formeln, Fett, Hintergrund, Zahlenformat.
import { strToU8, zipSync } from "fflate";
import { adresse, auswerten, excelFormel, genutzterBereich, istFehler, type TabellenDaten, type Zelle } from "@/lib/tabellen/formeln";

function xml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

function blattName(titel: string): string {
  return (titel.replace(/[[\]:*?/\\]/g, " ").trim() || "Tabelle").slice(0, 31);
}

export function alsXlsx(titel: string, daten: TabellenDaten): Uint8Array {
  const werte = auswerten(daten);
  const { zeilen, spalten } = genutzterBereich(daten);

  // Stile sammeln: (fett, hintergrund, format) -> Index in cellXfs
  const fuellungen: string[] = [];
  const stile: { fett: boolean; fill: number; numFmt: number }[] = [{ fett: false, fill: 0, numFmt: 0 }];
  const stilIndex = (z: Zelle | undefined): number => {
    if (!z || (!z.f && !z.bg && (!z.fmt || z.fmt === "std"))) return 0;
    let fill = 0;
    if (z.bg && /^#[0-9a-fA-F]{6}$/.test(z.bg)) {
      let i = fuellungen.indexOf(z.bg.toUpperCase());
      if (i === -1) i = fuellungen.push(z.bg.toUpperCase()) - 1;
      fill = i + 2; // 0 = none, 1 = gray125 (Pflicht)
    }
    const numFmt = z.fmt === "2" ? 164 : z.fmt === "%" ? 10 : 0;
    const fett = Boolean(z.f);
    let idx = stile.findIndex((s) => s.fett === fett && s.fill === fill && s.numFmt === numFmt);
    if (idx === -1) idx = stile.push({ fett, fill, numFmt }) - 1;
    return idx;
  };

  const zeilenXml: string[] = [];
  for (let z = 0; z < zeilen; z++) {
    const zellen: string[] = [];
    for (let s = 0; s < spalten; s++) {
      const ref = adresse(s, z);
      const zelle = daten.zellen[ref];
      const roh = zelle?.w ?? "";
      const stil = stilIndex(zelle);
      const sAttr = stil ? ` s="${stil}"` : "";
      const w = werte.get(ref);
      if (roh.startsWith("=")) {
        const f = `<f>${xml(excelFormel(roh))}</f>`;
        if (w === undefined || istFehler(w)) zellen.push(`<c r="${ref}"${sAttr} t="e">${f}<v>#VALUE!</v></c>`);
        else if (typeof w === "number") zellen.push(`<c r="${ref}"${sAttr}>${f}<v>${w}</v></c>`);
        else zellen.push(`<c r="${ref}"${sAttr} t="str">${f}<v>${xml(w)}</v></c>`);
      } else if (typeof w === "number") {
        zellen.push(`<c r="${ref}"${sAttr}><v>${w}</v></c>`);
      } else if (roh) {
        zellen.push(`<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${xml(roh)}</t></is></c>`);
      } else if (stil) {
        zellen.push(`<c r="${ref}"${sAttr}/>`);
      }
    }
    if (zellen.length) zeilenXml.push(`<row r="${z + 1}">${zellen.join("")}</row>`);
  }

  const blatt =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${zeilenXml.join("")}</sheetData></worksheet>`;

  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="0.00"/></numFmts>` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="${fuellungen.length + 2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
    fuellungen.map((f) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${f.slice(1)}"/><bgColor indexed="64"/></patternFill></fill>`).join("") +
    `</fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${stile.length}">` +
    stile
      .map(
        (s) =>
          `<xf numFmtId="${s.numFmt}" fontId="${s.fett ? 1 : 0}" fillId="${s.fill}" borderId="0" xfId="0"` +
          `${s.numFmt ? ' applyNumberFormat="1"' : ""}${s.fett ? ' applyFont="1"' : ""}${s.fill ? ' applyFill="1"' : ""}/>`,
      )
      .join("") +
    `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const dateien: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${xml(blattName(titel))}" sheetId="1" r:id="rId1"/></sheets>` +
        `<calcPr fullCalcOnLoad="1"/></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    ),
    "xl/worksheets/sheet1.xml": strToU8(blatt),
    "xl/styles.xml": strToU8(styles),
  };
  return zipSync(dateien);
}
