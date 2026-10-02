import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { umgebung } from "@/lib/kalender/google";

function schluessel(): Buffer {
  const roh = umgebung("KALENDER_TOKEN_SCHLUESSEL");
  if (!roh) throw new Error("KALENDER_TOKEN_SCHLUESSEL ist nicht gesetzt.");
  const key = Buffer.from(roh, "base64");
  if (key.length !== 32) throw new Error("KALENDER_TOKEN_SCHLUESSEL muss 32 Byte (base64) lang sein.");
  return key;
}

export function verschluesseln(klartext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", schluessel(), iv);
  const daten = Buffer.concat([cipher.update(klartext, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), daten.toString("base64")].join(":");
}

export function entschluesseln(wert: string): string {
  const [version, iv, tag, daten] = wert.split(":");
  if (version !== "v1" || !iv || !tag || !daten) throw new Error("Unbekanntes Token-Format.");
  const decipher = createDecipheriv("aes-256-gcm", schluessel(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(daten, "base64")), decipher.final()]).toString("utf8");
}

export function hash(wert: string): string {
  return createHash("sha256").update(wert).digest("hex");
}
