// Tabellen-Logik (TAB-01 … TAB-06) ohne React – gut testbar.

export const MAX_SPALTEN = 26;
export const MAX_ZEILEN = 500;
export const START_SPALTEN = 10;
export const START_ZEILEN = 20;

export type Zahlenformat = "std" | "2" | "%";
export type Zelle = { w?: string; f?: boolean; bg?: string; fmt?: Zahlenformat };
export type TabellenDaten = { spalten: number; zeilen: number; zellen: Record<string, Zelle> };

export const FEHLER = "#FEHLER";
export type Wert = number | string | { fehler: true };

export function istFehler(w: Wert): w is { fehler: true } {
  return typeof w === "object";
}

// --- Adressen -----------------------------------------------------------------

export function spaltenName(index: number): string {
  return String.fromCharCode(65 + index);
}

export function adresse(spalte: number, zeile: number): string {
  return `${spaltenName(spalte)}${zeile + 1}`;
}

export function zerlegen(ref: string): { spalte: number; zeile: number } | null {
  const m = /^([A-Z])(\d{1,3})$/.exec(ref.toUpperCase());
  if (!m) return null;
  const zeile = Number(m[2]) - 1;
  if (zeile < 0) return null;
  return { spalte: m[1].charCodeAt(0) - 65, zeile };
}

export function datenLesen(roh: unknown): TabellenDaten {
  const d = (roh && typeof roh === "object" ? roh : {}) as Partial<TabellenDaten>;
  const spalten = Math.min(MAX_SPALTEN, Math.max(1, Math.floor(Number(d.spalten) || START_SPALTEN)));
  const zeilen = Math.min(MAX_ZEILEN, Math.max(1, Math.floor(Number(d.zeilen) || START_ZEILEN)));
  const zellen: Record<string, Zelle> = {};
  if (d.zellen && typeof d.zellen === "object") {
    for (const [k, z] of Object.entries(d.zellen)) {
      if (zerlegen(k) && z && typeof z === "object") zellen[k] = z as Zelle;
    }
  }
  return { spalten, zeilen, zellen };
}

// --- Zahlen in deutscher Schreibweise -------------------------------------------

/** "3,5" / "3.5" / "1.234,5" / "-2" / "12%" -> Zahl, sonst null. */
export function zahlLesen(text: string): number | null {
  const t = text.trim().replace(/\s/g, "");
  if (!t) return null;
  const prozent = t.endsWith("%");
  const kern = prozent ? t.slice(0, -1) : t;
  let normal: string;
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(kern)) normal = kern.replace(/\./g, "").replace(",", ".");
  else if (/^[-+]?\d+(,\d+)?$/.test(kern)) normal = kern.replace(",", ".");
  else if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(kern)) normal = kern;
  else return null;
  const zahl = Number(normal);
  if (!Number.isFinite(zahl)) return null;
  return prozent ? zahl / 100 : zahl;
}

// --- Formel-Parser --------------------------------------------------------------

type Token =
  | { t: "zahl"; v: number }
  | { t: "ref"; v: string }
  | { t: "bereich"; von: string; bis: string }
  | { t: "name"; v: string }
  | { t: "op"; v: string }
  | { t: "fehler" };

function tokenisieren(formel: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const s = formel.toUpperCase();
  while (i < s.length) {
    const c = s[i];
    if (c === " ") {
      i++;
      continue;
    }
    if (s.startsWith(FEHLER, i)) {
      tokens.push({ t: "fehler" });
      i += FEHLER.length;
      continue;
    }
    if ("+-*/();".includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    const bereich = /^([A-Z]\d{1,3}):([A-Z]\d{1,3})/.exec(s.slice(i));
    if (bereich) {
      tokens.push({ t: "bereich", von: bereich[1], bis: bereich[2] });
      i += bereich[0].length;
      continue;
    }
    const ref = /^[A-Z]\d{1,3}(?![A-Z0-9(])/.exec(s.slice(i));
    if (ref) {
      tokens.push({ t: "ref", v: ref[0] });
      i += ref[0].length;
      continue;
    }
    const name = /^[A-ZÄÖÜ]+(?=\s*\()/.exec(s.slice(i));
    if (name) {
      tokens.push({ t: "name", v: name[0] });
      i += name[0].length;
      continue;
    }
    // Zahl: Dezimalkomma oder -punkt
    const zahl = /^\d+([.,]\d+)?/.exec(s.slice(i));
    if (zahl) {
      tokens.push({ t: "zahl", v: Number(zahl[0].replace(",", ".")) });
      i += zahl[0].length;
      continue;
    }
    return null;
  }
  return tokens;
}

type Knoten =
  | { k: "zahl"; v: number }
  | { k: "ref"; v: string }
  | { k: "bereich"; von: string; bis: string }
  | { k: "fehler" }
  | { k: "neg"; a: Knoten }
  | { k: "bin"; op: string; a: Knoten; b: Knoten }
  | { k: "fn"; name: string; args: Knoten[] };

export const FUNKTIONEN = ["SUMME", "MITTELWERT", "MIN", "MAX", "ANZAHL"] as const;

function parsen(tokens: Token[]): Knoten | null {
  let p = 0;
  const op = (v: string) => {
    const t = tokens[p];
    return t && t.t === "op" && t.v === v;
  };

  function ausdruck(): Knoten {
    let links = term();
    while (op("+") || op("-")) {
      const o = (tokens[p++] as { v: string }).v;
      links = { k: "bin", op: o, a: links, b: term() };
    }
    return links;
  }
  function term(): Knoten {
    let links = faktor();
    while (op("*") || op("/")) {
      const o = (tokens[p++] as { v: string }).v;
      links = { k: "bin", op: o, a: links, b: faktor() };
    }
    return links;
  }
  function faktor(): Knoten {
    if (op("-")) {
      p++;
      return { k: "neg", a: faktor() };
    }
    if (op("+")) {
      p++;
      return faktor();
    }
    const t = tokens[p++];
    if (!t) throw new Error("Ende");
    if (t.t === "zahl") return { k: "zahl", v: t.v };
    if (t.t === "ref") return { k: "ref", v: t.v };
    if (t.t === "fehler") return { k: "fehler" };
    if (t.t === "bereich") return { k: "bereich", von: t.von, bis: t.bis };
    if (t.t === "name") {
      if (!(FUNKTIONEN as readonly string[]).includes(t.v)) throw new Error("Funktion");
      if (!op("(")) throw new Error("(");
      p++;
      const args: Knoten[] = [];
      if (!op(")")) {
        args.push(ausdruck());
        while (op(";")) {
          p++;
          args.push(ausdruck());
        }
      }
      if (!op(")")) throw new Error(")");
      p++;
      return { k: "fn", name: t.v, args };
    }
    if (t.t === "op" && t.v === "(") {
      const innen = ausdruck();
      if (!op(")")) throw new Error(")");
      p++;
      return innen;
    }
    throw new Error("Token");
  }

  try {
    const baum = ausdruck();
    return p === tokens.length ? baum : null;
  } catch {
    return null;
  }
}

// --- Auswertung -----------------------------------------------------------------

function bereichZellen(von: string, bis: string): string[] | null {
  const a = zerlegen(von);
  const b = zerlegen(bis);
  if (!a || !b) return null;
  const liste: string[] = [];
  for (let z = Math.min(a.zeile, b.zeile); z <= Math.max(a.zeile, b.zeile); z++) {
    for (let s = Math.min(a.spalte, b.spalte); s <= Math.max(a.spalte, b.spalte); s++) liste.push(adresse(s, z));
  }
  return liste;
}

/** Wertet alle Zellen aus (mit Zyklus-Erkennung). Ergebnis: Adresse -> Wert. */
export function auswerten(daten: Pick<TabellenDaten, "zellen">): Map<string, Wert> {
  const ergebnis = new Map<string, Wert>();
  const inArbeit = new Set<string>();
  const fehler: Wert = { fehler: true };

  function zellwert(ref: string): Wert {
    const vorhanden = ergebnis.get(ref);
    if (vorhanden !== undefined) return vorhanden;
    const roh = daten.zellen[ref]?.w ?? "";
    if (!roh.startsWith("=")) {
      const zahl = zahlLesen(roh);
      const w = zahl ?? roh;
      ergebnis.set(ref, w);
      return w;
    }
    if (inArbeit.has(ref)) return fehler; // Zirkelbezug
    inArbeit.add(ref);
    const tokens = tokenisieren(roh.slice(1));
    const baum = tokens && tokens.length ? parsen(tokens) : null;
    let w: Wert = fehler;
    if (baum) {
      try {
        w = knoten(baum);
      } catch {
        w = fehler;
      }
    }
    if (typeof w === "number" && !Number.isFinite(w)) w = fehler;
    inArbeit.delete(ref);
    ergebnis.set(ref, w);
    return w;
  }

  function alsZahl(w: Wert): number {
    if (istFehler(w)) throw new Error(FEHLER);
    if (typeof w === "number") return w;
    if (w === "") return 0;
    throw new Error(FEHLER); // Text in Rechnung
  }

  function werteListe(args: Knoten[]): Wert[] {
    const liste: Wert[] = [];
    for (const a of args) {
      if (a.k === "bereich") {
        const zellen = bereichZellen(a.von, a.bis);
        if (!zellen) throw new Error(FEHLER);
        for (const z of zellen) liste.push(zellwert(z));
      } else liste.push(knoten(a));
    }
    return liste;
  }

  function knoten(n: Knoten): Wert {
    switch (n.k) {
      case "zahl":
        return n.v;
      case "fehler":
        throw new Error(FEHLER);
      case "ref":
        return zellwert(n.v);
      case "bereich":
        throw new Error(FEHLER); // Bereich nur in Funktionen
      case "neg":
        return -alsZahl(knoten(n.a));
      case "bin": {
        const a = alsZahl(knoten(n.a));
        const b = alsZahl(knoten(n.b));
        if (n.op === "+") return a + b;
        if (n.op === "-") return a - b;
        if (n.op === "*") return a * b;
        if (b === 0) throw new Error(FEHLER);
        return a / b;
      }
      case "fn": {
        const werte = werteListe(n.args);
        if (werte.some(istFehler)) throw new Error(FEHLER);
        const zahlen = werte.filter((w): w is number => typeof w === "number");
        switch (n.name) {
          case "SUMME":
            return zahlen.reduce((s, z) => s + z, 0);
          case "MITTELWERT":
            if (!zahlen.length) throw new Error(FEHLER);
            return zahlen.reduce((s, z) => s + z, 0) / zahlen.length;
          case "MIN":
            return zahlen.length ? Math.min(...zahlen) : 0;
          case "MAX":
            return zahlen.length ? Math.max(...zahlen) : 0;
          case "ANZAHL":
            return zahlen.length;
        }
        throw new Error(FEHLER);
      }
    }
  }

  for (const ref of Object.keys(daten.zellen)) zellwert(ref);
  return ergebnis;
}

// --- Anzeige (TAB-02, TAB-05) ---------------------------------------------------

export function anzeigen(w: Wert | undefined, fmt: Zahlenformat = "std"): string {
  if (w === undefined || w === "") return "";
  if (istFehler(w)) return FEHLER;
  if (typeof w === "string") return w;
  if (fmt === "%") return `${(w * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
  if (fmt === "2") return w.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return w.toLocaleString("de-DE", { maximumFractionDigits: 10, useGrouping: false });
}

// --- TAB-03: Zeilen/Spalten einfügen und löschen --------------------------------

type Verschiebung = { art: "zeile" | "spalte"; index: number; delta: 1 | -1 };

function verschiebeEins(ref: string, v: Verschiebung): string | null {
  const z = zerlegen(ref);
  if (!z) return ref;
  const wert = v.art === "zeile" ? z.zeile : z.spalte;
  if (v.delta === -1 && wert === v.index) return null; // gelöscht
  const neu = wert >= v.index ? wert + v.delta : wert;
  return v.art === "zeile" ? adresse(z.spalte, neu) : adresse(neu, z.zeile);
}

/** Passt Bezüge in einer Formel an, damit sie nach dem Einfügen/Löschen weiter stimmen. */
export function bezuegeVerschieben(formel: string, v: Verschiebung): string {
  if (!formel.startsWith("=")) return formel;
  return (
    "=" +
    formel.slice(1).replace(/([A-Za-z]\d{1,3})(?::([A-Za-z]\d{1,3}))?(?![A-Za-z0-9(])/g, (treffer, a: string, b?: string) => {
      if (!b) return verschiebeEins(a.toUpperCase(), v) ?? FEHLER;
      // Bereich: Endpunkte verschieben, gelöschte Ränder nach innen ziehen
      const za = zerlegen(a);
      const zb = zerlegen(b);
      if (!za || !zb) return treffer;
      const achse = (x: { spalte: number; zeile: number }) => (v.art === "zeile" ? x.zeile : x.spalte);
      let lo = Math.min(achse(za), achse(zb));
      let hi = Math.max(achse(za), achse(zb));
      if (v.delta === 1) {
        if (lo >= v.index) lo++;
        if (hi >= v.index) hi++;
      } else {
        if (lo === v.index && hi === v.index) return FEHLER;
        if (lo > v.index) lo--;
        if (hi >= v.index) hi--;
      }
      const andereA = v.art === "zeile" ? Math.min(za.spalte, zb.spalte) : Math.min(za.zeile, zb.zeile);
      const andereB = v.art === "zeile" ? Math.max(za.spalte, zb.spalte) : Math.max(za.zeile, zb.zeile);
      const von = v.art === "zeile" ? adresse(andereA, lo) : adresse(lo, andereA);
      const bis = v.art === "zeile" ? adresse(andereB, hi) : adresse(hi, andereB);
      return `${von}:${bis}`;
    })
  );
}

export function einfuegen(daten: TabellenDaten, art: "zeile" | "spalte", index: number): TabellenDaten | null {
  if (art === "zeile" && daten.zeilen >= MAX_ZEILEN) return null;
  if (art === "spalte" && daten.spalten >= MAX_SPALTEN) return null;
  return umbauen(daten, { art, index, delta: 1 });
}

export function loeschen(daten: TabellenDaten, art: "zeile" | "spalte", index: number): TabellenDaten | null {
  if (art === "zeile" && daten.zeilen <= 1) return null;
  if (art === "spalte" && daten.spalten <= 1) return null;
  return umbauen(daten, { art, index, delta: -1 });
}

function umbauen(daten: TabellenDaten, v: Verschiebung): TabellenDaten {
  const zellen: Record<string, Zelle> = {};
  for (const [ref, zelle] of Object.entries(daten.zellen)) {
    const neu = verschiebeEins(ref, v);
    if (!neu) continue;
    zellen[neu] = zelle.w?.startsWith("=") ? { ...zelle, w: bezuegeVerschieben(zelle.w, v) } : zelle;
  }
  return {
    spalten: daten.spalten + (v.art === "spalte" ? v.delta : 0),
    zeilen: daten.zeilen + (v.art === "zeile" ? v.delta : 0),
    zellen,
  };
}

// --- TAB-06: Export --------------------------------------------------------------

/** CSV mit Semikolon (Excel in Deutschland), berechnete Werte. */
export function alsCsv(daten: TabellenDaten): string {
  const werte = auswerten(daten);
  const { zeilen: z, spalten: s } = genutzterBereich(daten);
  const zeilen: string[] = [];
  for (let zeile = 0; zeile < z; zeile++) {
    const felder: string[] = [];
    for (let spalte = 0; spalte < s; spalte++) {
      const ref = adresse(spalte, zeile);
      const text = anzeigen(werte.get(ref), daten.zellen[ref]?.fmt);
      felder.push(/[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
    }
    zeilen.push(felder.join(";"));
  }
  return `﻿${zeilen.join("\r\n")}`;
}

/** Kleinster Bereich ab A1, der alle gefüllten Zellen enthält. */
export function genutzterBereich(daten: TabellenDaten): { zeilen: number; spalten: number } {
  let zeilen = 0;
  let spalten = 0;
  for (const [ref, zelle] of Object.entries(daten.zellen)) {
    if (!zelle.w) continue;
    const z = zerlegen(ref);
    if (!z) continue;
    zeilen = Math.max(zeilen, z.zeile + 1);
    spalten = Math.max(spalten, z.spalte + 1);
  }
  return { zeilen, spalten };
}

const EXCEL_NAMEN: Record<string, string> = { SUMME: "SUM", MITTELWERT: "AVERAGE", MIN: "MIN", MAX: "MAX", ANZAHL: "COUNT" };

/** Formel für Excel-Dateien: englische Funktionsnamen, Komma als Trenner, Punkt als Dezimalzeichen. */
export function excelFormel(formel: string): string {
  return formel
    .slice(1)
    .toUpperCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/;/g, ",")
    .replace(/\b(SUMME|MITTELWERT|MIN|MAX|ANZAHL)(?=\s*\()/g, (n) => EXCEL_NAMEN[n])
    .replace(new RegExp(FEHLER, "g"), "#REF!");
}
