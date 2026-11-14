// Regeln der Dateiablage (DAT-02, DAT-05, DAT-09) – ohne Abhängigkeiten, gut testbar.

export const MAX_DATEI_BYTES = 25 * 1024 * 1024;
export const SPEICHER_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;

export type DateiArt = "pdf" | "bild" | "office" | "text" | "audio";

const ENDUNGEN: Record<string, { mime: string; art: DateiArt }> = {
  pdf: { mime: "application/pdf", art: "pdf" },
  jpg: { mime: "image/jpeg", art: "bild" },
  jpeg: { mime: "image/jpeg", art: "bild" },
  png: { mime: "image/png", art: "bild" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", art: "office" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", art: "office" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", art: "office" },
  txt: { mime: "text/plain", art: "text" },
  mp3: { mime: "audio/mpeg", art: "audio" },
  m4a: { mime: "audio/mp4", art: "audio" },
  wav: { mime: "audio/wav", art: "audio" },
  // Aufnahmen aus dem Browser (TRA-01): Chrome/Firefox nehmen WebM/Opus bzw. Ogg auf
  webm: { mime: "audio/webm", art: "audio" },
  ogg: { mime: "audio/ogg", art: "audio" },
};

export const ERLAUBTE_ENDUNGEN = Object.keys(ENDUNGEN);
export const ACCEPT_ATTRIBUT = ERLAUBTE_ENDUNGEN.map((e) => `.${e}`).join(",");

export function endung(name: string): string {
  const punkt = name.lastIndexOf(".");
  return punkt > 0 ? name.slice(punkt + 1).toLowerCase() : "";
}

function basis(name: string): string {
  const punkt = name.lastIndexOf(".");
  return punkt > 0 ? name.slice(0, punkt) : name;
}

/** Typ anhand der Endung – der Browser liefert MIME-Typen nicht zuverlässig. */
export function dateiTyp(name: string): { mime: string; art: DateiArt } | null {
  return ENDUNGEN[endung(name)] ?? null;
}

export type Pruefung = { ok: true; mime: string } | { ok: false; fehler: string };

export function uploadPruefen(name: string, groesse: number, belegt: number): Pruefung {
  const typ = dateiTyp(name);
  if (!typ) return { ok: false, fehler: `„${name}“: Dateityp nicht erlaubt (PDF, Bilder, Office, TXT, Audio).` };
  if (groesse > MAX_DATEI_BYTES) return { ok: false, fehler: `„${name}“ ist größer als 25 MB.` };
  if (groesse <= 0) return { ok: false, fehler: `„${name}“ ist leer.` };
  if (belegt + groesse > SPEICHER_LIMIT_BYTES) return { ok: false, fehler: "Dein Speicherplatz ist voll (2 GB)." };
  return { ok: true, mime: typ.mime };
}

/** DAT-02: "Skript.pdf" -> "Skript (2).pdf", wenn der Name im Ordner schon existiert. */
export function freierName(name: string, vorhandene: string[]): string {
  const belegt = new Set(vorhandene.map((n) => n.toLowerCase()));
  if (!belegt.has(name.toLowerCase())) return name;
  const b = basis(name).replace(/ \(\d+\)$/, "");
  const e = endung(name);
  for (let i = 2; ; i++) {
    const kandidat = `${b} (${i})${e ? `.${e}` : ""}`;
    if (!belegt.has(kandidat.toLowerCase())) return kandidat;
  }
}

/** DAT-05: Endung bleibt immer erhalten. null = ungültig (leer). */
export function umbenannt(alterName: string, neueEingabe: string): string | null {
  const e = endung(alterName);
  let neu = neueEingabe.trim().replace(/[\\/]/g, "-");
  if (e && neu.toLowerCase().endsWith(`.${e}`)) neu = neu.slice(0, -(e.length + 1)).trim();
  if (!neu) return null;
  return e ? `${neu}.${e}` : neu;
}

export function nameOhneEndung(name: string): string {
  return basis(name);
}

/** Pfadteil für Storage: nur unkritische Zeichen. */
export function speicherName(name: string): string {
  const ersetzt = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-100);
  return ersetzt || "datei";
}

export function groesseText(bytes: number): string {
  const einheiten = ["B", "KB", "MB", "GB"];
  let wert = bytes;
  let i = 0;
  while (wert >= 1024 && i < einheiten.length - 1) {
    wert /= 1024;
    i++;
  }
  const stellen = i === 0 || wert >= 100 ? 0 : 1;
  return `${wert.toLocaleString("de-DE", { maximumFractionDigits: stellen, minimumFractionDigits: stellen })} ${einheiten[i]}`;
}
