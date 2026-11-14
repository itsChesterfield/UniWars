// Dateiablage: Datei über einen Link importieren – reine Regeln, ohne Netzwerk (gut testbar).
import { dateiTyp, endung, nameOhneEndung } from "./dateien.ts";

/** Erwartbarer Fehler mit deutscher Meldung für die Oberfläche */
export class LinkFehler extends Error {
  constructor(meldung: string) {
    super(meldung);
    this.name = "LinkFehler";
  }
}

const VERBOTENE_HOSTS = /(^|\.)(localhost|local|internal|intranet|home|lan|corp)$/i;

/**
 * Eingefügten Text in eine Download-Adresse umwandeln. Bekannte Freigabe-Links
 * (Google Drive, Dropbox) werden auf den direkten Download umgestellt.
 */
export function linkNormalisieren(text: string): URL | null {
  const roh = text.trim().split(/\s+/)[0] ?? "";
  if (!roh) return null;
  const mitSchema = /^[a-z][a-z0-9+.-]*:/i.test(roh) ? roh : /^[\w-]+(\.[\w-]+)+(:\d+)?(\/|$)/.test(roh) ? `https://${roh}` : roh;
  let url: URL;
  try {
    url = new URL(mitSchema);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") && !host.includes(":")) return null;
  if (VERBOTENE_HOSTS.test(host) || istPrivateIp(host)) return null;
  url.hash = "";

  // Google Drive: /file/d/<id>/view → direkter Download
  if (host === "drive.google.com") {
    const id = /\/file\/d\/([\w-]+)/.exec(url.pathname)?.[1] ?? (url.pathname === "/open" ? url.searchParams.get("id") : null);
    if (id) return new URL(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`);
  }
  // Dropbox: ?dl=0 → ?dl=1
  if (host === "www.dropbox.com" || host === "dropbox.com") {
    url.searchParams.set("dl", "1");
  }
  return url;
}

/** IPv4/IPv6-Adressen, die nicht ins öffentliche Internet gehören (Schutz vor SSRF). */
export function istPrivateIp(adresse: string): boolean {
  const a = adresse.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  if (v4) {
    const [o1, o2] = [Number(v4[1]), Number(v4[2])];
    return (
      o1 === 0 ||
      o1 === 10 ||
      o1 === 127 ||
      (o1 === 100 && o2 >= 64 && o2 <= 127) || // CGNAT
      (o1 === 169 && o2 === 254) || // Link-local (Cloud-Metadaten)
      (o1 === 172 && o2 >= 16 && o2 <= 31) ||
      (o1 === 192 && o2 === 168) ||
      (o1 === 192 && o2 === 0) ||
      (o1 === 198 && (o2 === 18 || o2 === 19)) ||
      o1 >= 224 // Multicast, reserviert, Broadcast
    );
  }
  if (!a.includes(":")) return false;
  // IPv4 in IPv6 (::ffff:10.0.0.1)
  const eingebettet = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (eingebettet) return istPrivateIp(eingebettet[1]);
  if (a === "::" || a === "::1") return true;
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(a) || a.startsWith("64:ff9b:") || a.startsWith("2001:db8");
}

export type InhaltsTyp = "pdf" | "png" | "jpeg" | "zip" | "mp3" | "wav" | "ogg" | "webm" | "m4a" | "html" | "text";

/** Dateityp an den ersten Bytes erkennen (Server-Angaben sind oft falsch). */
export function inhaltErkennen(b: Uint8Array): InhaltsTyp | null {
  const start = (...bytes: number[]) => bytes.every((x, i) => b[i] === x);
  const ascii = (von: number, text: string) => [...text].every((c, i) => b[von + i] === c.charCodeAt(0));
  if (ascii(0, "%PDF")) return "pdf";
  if (start(0x89, 0x50, 0x4e, 0x47)) return "png";
  if (start(0xff, 0xd8, 0xff)) return "jpeg";
  if (start(0x50, 0x4b, 0x03, 0x04)) return "zip";
  if (ascii(0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "mp3";
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return "wav";
  if (ascii(0, "OggS")) return "ogg";
  if (start(0x1a, 0x45, 0xdf, 0xa3)) return "webm";
  if (ascii(4, "ftyp")) return "m4a";
  const anfang = new TextDecoder("utf-8", { fatal: false }).decode(b.slice(0, 512)).trimStart().toLowerCase();
  if (anfang.startsWith("<!doctype html") || anfang.startsWith("<html") || /<(head|body|script|meta)[\s>]/.test(anfang.slice(0, 300))) return "html";
  // Text: keine Steuerzeichen außer Zeilenumbrüchen/Tabs
  const probe = b.slice(0, 512);
  if (probe.length && probe.every((x) => x === 9 || x === 10 || x === 13 || x >= 32)) return "text";
  return null;
}

/** Zu welchen Endungen ein erkannter Inhalt passt (erste = Standard) */
const PASSENDE_ENDUNGEN: Record<Exclude<InhaltsTyp, "html">, string[]> = {
  pdf: ["pdf"],
  png: ["png"],
  jpeg: ["jpg", "jpeg"],
  zip: ["docx", "pptx", "xlsx"],
  mp3: ["mp3"],
  wav: ["wav"],
  ogg: ["ogg"],
  webm: ["webm"],
  m4a: ["m4a"],
  text: ["txt"],
};

const MIME_ENDUNG: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
};

/** Dateiname aus Content-Disposition (RFC 6266/5987) */
export function nameAusDisposition(kopf: string | null): string | null {
  if (!kopf) return null;
  const stern = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(kopf);
  if (stern) {
    try {
      return decodeURIComponent(stern[2].trim().replace(/^"|"$/g, ""));
    } catch {
      // weiter mit filename=
    }
  }
  const einfach = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(kopf);
  const wert = (einfach?.[2] ?? einfach?.[1])?.trim();
  return wert ? wert : null;
}

function nameAusUrl(url: URL): string | null {
  const teil = url.pathname.split("/").filter(Boolean).pop();
  if (!teil) return null;
  try {
    return decodeURIComponent(teil);
  } catch {
    return teil;
  }
}

function bereinigen(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

/**
 * Endgültigen Dateinamen und Typ bestimmen. Wirft LinkFehler, wenn der Inhalt keine
 * erlaubte Datei ist (z. B. eine Anmeldeseite statt der PDF).
 */
export function dateiBestimmen(eingabe: {
  bytes: Uint8Array;
  url: URL;
  contentType: string | null;
  contentDisposition: string | null;
}): { name: string; mime: string } {
  const inhalt = inhaltErkennen(eingabe.bytes);
  if (inhalt === "html") {
    throw new LinkFehler(
      "Der Link führt zu einer Webseite, nicht direkt zu einer Datei – oft eine Anmeldeseite (z. B. Moodle/ILIAS). Lade die Datei dann bitte herunter und zieh sie hierher.",
    );
  }

  const kandidat = bereinigen(nameAusDisposition(eingabe.contentDisposition) ?? nameAusUrl(eingabe.url) ?? "");
  const mime = (eingabe.contentType ?? "").split(";")[0].trim().toLowerCase();
  const passend = inhalt ? PASSENDE_ENDUNGEN[inhalt] : null;

  // Endung aus dem Namen – fehlt sie, aus dem Inhalt bzw. dem Content-Type ableiten
  let e = dateiTyp(kandidat) ? endung(kandidat) : "";
  if (!e) {
    if (inhalt === "zip") e = passend!.includes(MIME_ENDUNG[mime] ?? "") ? MIME_ENDUNG[mime] : "";
    else e = passend?.[0] ?? MIME_ENDUNG[mime] ?? "";
  }
  if (!e || !dateiTyp(`x.${e}`)) {
    throw new LinkFehler("Diesen Dateityp kann die Dateiablage nicht speichern (PDF, Bilder, Office, TXT, Audio).");
  }
  if (passend && !passend.includes(e)) {
    throw new LinkFehler("Der Inhalt passt nicht zum Dateityp – der Link liefert offenbar keine gültige Datei.");
  }
  if (!passend && e !== "txt") {
    throw new LinkFehler("Der Link liefert keine gültige Datei.");
  }

  const basis = (kandidat && dateiTyp(kandidat) ? nameOhneEndung(kandidat) : kandidat.replace(/\.[a-z0-9]{1,5}$/i, "")) || "Download";
  const name = `${basis}.${e}`;
  return { name, mime: dateiTyp(name)!.mime };
}

/** Meldung für HTTP-Status beim Abruf */
export function statusMeldung(status: number): string {
  if (status === 401 || status === 403) return "Auf diese Datei kann UniWars nicht zugreifen – sie ist geschützt (Anmeldung nötig). Lade sie bitte herunter und zieh sie hierher.";
  if (status === 404 || status === 410) return "Unter diesem Link wurde keine Datei gefunden.";
  if (status === 429) return "Die Seite lässt gerade keine Downloads zu. Versuch es später noch einmal.";
  return `Die Datei konnte nicht geladen werden (Fehler ${status}).`;
}
