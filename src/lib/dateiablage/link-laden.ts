// Dateiablage: Datei von einem Link herunterladen (nur Server).
// Schutz vor SSRF: Jede aufgelöste IP wird geprüft – direkt beim Verbindungsaufbau,
// damit auch DNS-Rebinding und Weiterleitungen auf interne Adressen nicht greifen.
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { MAX_DATEI_BYTES } from "./dateien.ts";
import { istPrivateIp, linkNormalisieren, LinkFehler, statusMeldung } from "./link-import.ts";

const MAX_WEITERLEITUNGEN = 5;
const ZEITLIMIT_MS = 30_000;

export type Geladen = { bytes: Buffer; url: URL; contentType: string | null; contentDisposition: string | null };

type Optionen = {
  /** nur für Tests: welche IPs erlaubt sind (Standard: keine privaten) */
  adresseErlaubt?: (ip: string) => boolean;
  /** nur für Tests: Weiterleitungsziele prüfen (Standard: linkNormalisieren) */
  zielPruefen?: (adresse: string) => URL | null;
  maxBytes?: number;
  zeitlimitMs?: number;
};

function sichererLookup(erlaubt: (ip: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (err, adressen) => {
      if (err) return callback(err, "", 4);
      const liste = adressen as unknown as LookupAddress[];
      if (!liste.length || liste.some((a) => !erlaubt(a.address))) {
        return callback(new LinkFehler("Dieser Link zeigt auf eine interne Adresse und kann nicht geladen werden."), "", 4);
      }
      if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, liste);
      callback(null, liste[0].address, liste[0].family);
    });
  };
}

function einmalLaden(url: URL, opt: Required<Optionen>, abbruch: AbortSignal): Promise<{ weiter: URL } | Geladen> {
  return new Promise((fertig, fehler) => {
    // Bei IP-Adressen im Link fragt Node kein DNS – dann hier direkt prüfen
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && !opt.adresseErlaubt(host)) {
      return fehler(new LinkFehler("Dieser Link zeigt auf eine interne Adresse und kann nicht geladen werden."));
    }
    const modul = url.protocol === "https:" ? https : http;
    const anfrage = modul.request(
      url,
      {
        method: "GET",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; UniWars-Dateiablage/1.0)",
          accept: "application/pdf,image/*,audio/*,application/*;q=0.9,*/*;q=0.5",
          "accept-encoding": "identity",
        },
        lookup: sichererLookup(opt.adresseErlaubt),
        signal: abbruch,
      },
      (antwort) => {
        const status = antwort.statusCode ?? 0;
        if (status >= 300 && status < 400 && antwort.headers.location) {
          antwort.resume();
          let ziel: URL | null = null;
          try {
            ziel = opt.zielPruefen(new URL(antwort.headers.location, url).toString());
          } catch {
            ziel = null;
          }
          if (!ziel) return fehler(new LinkFehler("Der Link leitet auf eine ungültige Adresse weiter."));
          return fertig({ weiter: ziel });
        }
        if (status < 200 || status >= 300) {
          antwort.resume();
          return fehler(new LinkFehler(statusMeldung(status)));
        }
        const laenge = Number(antwort.headers["content-length"] ?? 0);
        if (laenge > opt.maxBytes) {
          antwort.destroy();
          return fehler(new LinkFehler("Die Datei ist größer als 25 MB."));
        }
        const teile: Buffer[] = [];
        let summe = 0;
        antwort.on("data", (teil: Buffer) => {
          summe += teil.length;
          if (summe > opt.maxBytes) {
            antwort.destroy();
            fehler(new LinkFehler("Die Datei ist größer als 25 MB."));
            return;
          }
          teile.push(teil);
        });
        antwort.on("error", (e) => fehler(e));
        antwort.on("end", () => {
          if (summe > opt.maxBytes) return;
          const kopf = (n: string) => {
            const w = antwort.headers[n];
            return Array.isArray(w) ? w[0] ?? null : w ?? null;
          };
          fertig({ bytes: Buffer.concat(teile), url, contentType: kopf("content-type"), contentDisposition: kopf("content-disposition") });
        });
      },
    );
    anfrage.on("error", (e) => fehler(e));
    anfrage.end();
  });
}

/** Lädt die Datei hinter `url` (folgt bis zu 5 Weiterleitungen, höchstens 25 MB, 30 s). */
export async function linkHerunterladen(url: URL, optionen: Optionen = {}): Promise<Geladen> {
  const opt: Required<Optionen> = {
    adresseErlaubt: optionen.adresseErlaubt ?? ((ip) => !istPrivateIp(ip)),
    zielPruefen: optionen.zielPruefen ?? linkNormalisieren,
    maxBytes: optionen.maxBytes ?? MAX_DATEI_BYTES,
    zeitlimitMs: optionen.zeitlimitMs ?? ZEITLIMIT_MS,
  };
  const abbruch = AbortSignal.timeout(opt.zeitlimitMs);
  let aktuell = url;
  try {
    for (let i = 0; i <= MAX_WEITERLEITUNGEN; i++) {
      const ergebnis = await einmalLaden(aktuell, opt, abbruch);
      if ("weiter" in ergebnis) {
        aktuell = ergebnis.weiter;
        continue;
      }
      if (ergebnis.bytes.length === 0) throw new LinkFehler("Unter diesem Link liegt eine leere Datei.");
      return ergebnis;
    }
    throw new LinkFehler("Der Link leitet zu oft weiter.");
  } catch (err) {
    if (err instanceof LinkFehler) throw err;
    if (abbruch.aborted) throw new LinkFehler("Der Download hat zu lange gedauert. Versuch es noch einmal.");
    const code = (err as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") throw new LinkFehler("Diese Adresse gibt es nicht. Prüf bitte den Link.");
    if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT") throw new LinkFehler("Die Seite ist gerade nicht erreichbar.");
    if ((typeof code === "string" && code.startsWith("ERR_TLS")) || code === "EPROTO" || code === "CERT_HAS_EXPIRED" || code === "DEPTH_ZERO_SELF_SIGNED_CERT" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
      throw new LinkFehler("Keine sichere Verbindung zur Seite möglich. Prüf bitte, ob der Link stimmt (http/https).");
    }
    throw err;
  }
}
