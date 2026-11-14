import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { dateiBestimmen, inhaltErkennen, istPrivateIp, linkNormalisieren, LinkFehler, nameAusDisposition } from "./link-import.ts";
import { linkHerunterladen } from "./link-laden.ts";

const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
const HTML = Buffer.from("<!DOCTYPE html><html><head><title>Login</title></head><body>Bitte anmelden</body></html>");

test("Link: normalisieren und Schutz vor internen Adressen", () => {
  assert.equal(linkNormalisieren("https://uni.de/skript.pdf")?.toString(), "https://uni.de/skript.pdf");
  assert.equal(linkNormalisieren("  uni.de/a/skript.pdf#page=3  ")?.toString(), "https://uni.de/a/skript.pdf");
  assert.equal(linkNormalisieren("javascript:alert(1)"), null);
  assert.equal(linkNormalisieren("file:///etc/passwd"), null);
  assert.equal(linkNormalisieren("http://localhost:3000/x.pdf"), null);
  assert.equal(linkNormalisieren("http://127.0.0.1/x.pdf"), null);
  assert.equal(linkNormalisieren("http://169.254.169.254/latest/meta-data"), null);
  assert.equal(linkNormalisieren("http://[::1]/x.pdf"), null);
  assert.equal(linkNormalisieren("http://user:pw@uni.de/x.pdf"), null);
  assert.equal(linkNormalisieren("https://uni.de:8443/x.pdf"), null);
  assert.equal(linkNormalisieren("http://drucker/x.pdf"), null);
  assert.equal(linkNormalisieren("kein link"), null);
});

test("Link: Google Drive und Dropbox werden zum direkten Download", () => {
  assert.equal(
    linkNormalisieren("https://drive.google.com/file/d/1AbC-xyz_9/view?usp=sharing")?.toString(),
    "https://drive.google.com/uc?export=download&id=1AbC-xyz_9",
  );
  assert.equal(linkNormalisieren("https://www.dropbox.com/s/abc/Skript.pdf?dl=0")?.searchParams.get("dl"), "1");
});

test("Link: private IP-Adressen erkennen", () => {
  for (const ip of ["10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.10", "127.0.0.1", "0.0.0.0", "169.254.169.254", "100.64.0.1", "::1", "fd12::1", "fe80::1", "::ffff:10.0.0.1"]) {
    assert.equal(istPrivateIp(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "141.30.1.1", "172.32.0.1", "2a00:1450:4001::1"]) assert.equal(istPrivateIp(ip), false, ip);
});

test("Link: Inhalt an den ersten Bytes erkennen", () => {
  assert.equal(inhaltErkennen(PDF), "pdf");
  assert.equal(inhaltErkennen(HTML), "html");
  assert.equal(inhaltErkennen(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d])), "png");
  assert.equal(inhaltErkennen(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14])), "zip");
  assert.equal(inhaltErkennen(Buffer.from("Hallo Welt\nZeile 2")), "text");
});

test("Link: Dateiname und Typ bestimmen", () => {
  const url = new URL("https://uni.de/download.php?id=7");
  assert.equal(nameAusDisposition(`attachment; filename*=UTF-8''Vorlesung%203%20%C3%9Cbersicht.pdf`), "Vorlesung 3 Übersicht.pdf");
  assert.equal(nameAusDisposition(`inline; filename="Skript.pdf"`), "Skript.pdf");
  assert.deepEqual(dateiBestimmen({ bytes: PDF, url, contentType: "application/pdf", contentDisposition: `inline; filename="Skript WS26.pdf"` }), {
    name: "Skript WS26.pdf",
    mime: "application/pdf",
  });
  // Name aus der Adresse, Endung fehlt → aus dem Inhalt
  assert.equal(dateiBestimmen({ bytes: PDF, url: new URL("https://uni.de/files/Skript%20Kapitel%202"), contentType: null, contentDisposition: null }).name, "Skript Kapitel 2.pdf");
  assert.equal(dateiBestimmen({ bytes: PDF, url, contentType: "application/octet-stream", contentDisposition: null }).name, "download.pdf");
  // Anmeldeseite statt PDF
  assert.throws(() => dateiBestimmen({ bytes: HTML, url: new URL("https://moodle.uni.de/x.pdf"), contentType: "text/html", contentDisposition: null }), /Anmeldeseite/);
  // Endung .pdf, Inhalt aber Text
  assert.throws(() => dateiBestimmen({ bytes: Buffer.from("Fehler 500"), url: new URL("https://uni.de/x.pdf"), contentType: "text/plain", contentDisposition: null }), LinkFehler);
  // Office über Content-Type
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0]);
  assert.equal(
    dateiBestimmen({ bytes: zip, url: new URL("https://uni.de/get?id=1"), contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", contentDisposition: null }).name,
    "get.pptx",
  );
  assert.throws(() => dateiBestimmen({ bytes: Buffer.from([0, 1, 2, 3, 4]), url: new URL("https://uni.de/x.exe"), contentType: null, contentDisposition: null }), LinkFehler);
});

async function mitServer(fn: (basis: string) => Promise<void>, handler: http.RequestListener) {
  const server = http.createServer(handler);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

const ERLAUBT = { adresseErlaubt: () => true, zielPruefen: (a: string) => new URL(a) };

test("Link laden: Weiterleitung, Größenlimit, Statusmeldungen", async () => {
  await mitServer(
    async (basis) => {
      const g = await linkHerunterladen(new URL(`${basis}/weiter`), ERLAUBT);
      assert.equal(g.bytes.toString("latin1"), PDF.toString("latin1"));
      assert.equal(g.url.pathname, "/skript.pdf");
      assert.equal(g.contentDisposition, `attachment; filename="Skript.pdf"`);
      await assert.rejects(linkHerunterladen(new URL(`${basis}/gross`), { ...ERLAUBT, maxBytes: 1000 }), /größer als 25 MB/);
      await assert.rejects(linkHerunterladen(new URL(`${basis}/gross-ohne-laenge`), { ...ERLAUBT, maxBytes: 1000 }), /größer als 25 MB/);
      await assert.rejects(linkHerunterladen(new URL(`${basis}/geschuetzt`), ERLAUBT), /geschützt/);
      await assert.rejects(linkHerunterladen(new URL(`${basis}/fehlt`), ERLAUBT), /keine Datei gefunden/);
      await assert.rejects(linkHerunterladen(new URL(`${basis}/schleife`), ERLAUBT), /zu oft weiter/);
      await assert.rejects(linkHerunterladen(new URL(`${basis}/langsam`), { ...ERLAUBT, zeitlimitMs: 300 }), /zu lange gedauert/);
      // Standard: interne Adressen sind verboten – auch wenn die URL vorher durchgerutscht wäre
      await assert.rejects(linkHerunterladen(new URL(`${basis}/skript.pdf`)), /interne Adresse/);
      // … auch über einen Namen, der auf eine interne Adresse auflöst (DNS-Prüfung)
      await assert.rejects(linkHerunterladen(new URL(basis.replace("127.0.0.1", "localhost") + "/skript.pdf")), /interne Adresse/);
      // Weiterleitung auf eine interne Adresse wird abgelehnt
      await assert.rejects(linkHerunterladen(new URL(`${basis}/weiter`), { adresseErlaubt: () => true }), /ungültige Adresse/);
    },
    (req, res) => {
      if (req.url === "/weiter") return res.writeHead(302, { location: "/skript.pdf" }).end();
      if (req.url === "/skript.pdf") return res.writeHead(200, { "content-type": "application/pdf", "content-disposition": `attachment; filename="Skript.pdf"` }).end(PDF);
      if (req.url === "/gross") return res.writeHead(200, { "content-length": "5000" }).end(Buffer.alloc(5000));
      if (req.url === "/gross-ohne-laenge") {
        res.writeHead(200, { "transfer-encoding": "chunked" });
        for (let i = 0; i < 5; i++) res.write(Buffer.alloc(400));
        return res.end();
      }
      if (req.url === "/geschuetzt") return res.writeHead(403).end();
      if (req.url === "/schleife") return res.writeHead(302, { location: "/schleife" }).end();
      if (req.url === "/langsam") return setTimeout(() => res.writeHead(200).end(PDF), 2000);
      res.writeHead(404).end();
    },
  );
});
