import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BILDER,
  benutzteBilder,
  bereichZuPfad,
  bildEntfernen,
  bildFuer,
  eigenerPfad,
  helligkeitMessen,
  hintergrundLesen,
  kontrast,
  leererHintergrund,
  nachSchleier,
  schleier,
  textHelligkeit,
  type Bild,
} from "./hintergrund.ts";

const UID = "00000000-0000-4000-8000-000000000001";
const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;
const bild = (n: number, extra: Partial<Bild> = {}): Bild => ({
  id: id(n),
  pfad: `${UID}/${id(n)}.webp`,
  mittel: `${UID}/${id(n)}-m.webp`,
  weich: `${UID}/${id(n)}-w.webp`,
  tief: 0.1,
  hoch: 0.9,
  mitte: "mitte",
  abdunkeln: 0,
  unschaerfe: false,
  ...extra,
});

test("Lesen: leer, fehlende Spalte, Unsinn", () => {
  assert.deepEqual(hintergrundLesen(null), leererHintergrund());
  assert.deepEqual(hintergrundLesen(undefined), leererHintergrund());
  assert.deepEqual(hintergrundLesen("x"), leererHintergrund());
  assert.deepEqual(hintergrundLesen({ bilder: "x", groesse: "riesig" }), leererHintergrund());
});

test("Lesen: Standard fällt auf das erste Bild, unbekannte Wahl wird Standard, doppelte Bilder fallen weg", () => {
  const h = hintergrundLesen({
    bilder: [bild(1), bild(2), bild(1)],
    standard: "weg",
    flaechen: { leiste: id(2), studio: "aus", bereiche: "unbekannt" },
    bereich: { karteikarten: id(1), notizen: "standard", erfunden: id(1) },
    groesse: "alles",
    lernen_aus: false,
  });
  assert.equal(h.bilder.length, 2);
  assert.equal(h.standard, id(1));
  assert.deepEqual(h.flaechen, { leiste: id(2), studio: "aus", bereiche: "standard" });
  assert.deepEqual(h.bereich, { karteikarten: id(1) });
  assert.equal(h.groesse, "alles");
  assert.equal(h.lernen_aus, false);
});

test("Lesen: höchstens zwölf Bilder, fremde Pfade mit userId abgewiesen", () => {
  const viele = Array.from({ length: 20 }, (_, i) => bild(i + 1));
  assert.equal(hintergrundLesen({ bilder: viele }).bilder.length, MAX_BILDER);
  const fremd = { ...bild(3), pfad: `11111111-0000-4000-8000-000000000000/${id(3)}.webp` };
  assert.equal(hintergrundLesen({ bilder: [fremd] }, UID).bilder.length, 0);
  assert.equal(hintergrundLesen({ bilder: [bild(3)] }, UID).bilder.length, 1);
  assert.equal(eigenerPfad(`${UID}/../x.webp`, UID), false);
  assert.equal(eigenerPfad(`${UID}/${id(1)}-w.jpg`, UID), true);
});

test("Zuordnung: Bereich überschreibt, sonst Wahl für alle Bereiche, sonst Standard", () => {
  const h = hintergrundLesen({ bilder: [bild(1), bild(2)], standard: id(1), flaechen: { studio: "aus" }, bereich: { notizen: id(2), tabellen: "aus" } });
  assert.equal(bildFuer(h, "leiste")?.id, id(1));
  assert.equal(bildFuer(h, "studio"), null);
  assert.equal(bildFuer(h, "bereiche", "karteikarten")?.id, id(1));
  assert.equal(bildFuer(h, "bereiche", "notizen")?.id, id(2));
  assert.equal(bildFuer(h, "bereiche", "tabellen"), null);
  assert.deepEqual(benutzteBilder(h).map((b) => b.id).sort(), [id(1), id(2)]);
  assert.equal(bildFuer(leererHintergrund(), "leiste"), null);
});

test("Entfernen: Zuordnungen fallen auf Standard, Standard rückt nach", () => {
  const h = hintergrundLesen({ bilder: [bild(1), bild(2)], standard: id(1), flaechen: { leiste: id(1) }, bereich: { notizen: id(1) } });
  const n = bildEntfernen(h, id(1));
  assert.equal(n.bilder.length, 1);
  assert.equal(n.standard, id(2));
  assert.equal(n.flaechen.leiste, "standard");
  assert.deepEqual(n.bereich, {});
  assert.equal(bildEntfernen(n, id(2)).standard, null);
});

test("Schleier: --text-2 erreicht auf der kritischsten Stelle mindestens 4,5:1", () => {
  for (const tief of [0, 0.2, 0.5, 0.8, 1]) {
    for (const hoch of [0, 0.3, 0.6, 0.9, 1]) {
      if (hoch < tief) continue;
      for (const abdunkeln of [0, 1, 2] as const) {
        const d = schleier({ tief, hoch, abdunkeln }, "DUNKEL");
        assert.ok(kontrast(textHelligkeit("DUNKEL"), nachSchleier(hoch, d, "DUNKEL")) >= 4.49, `dunkel ${hoch} ${d}`);
        const l = schleier({ tief, hoch, abdunkeln }, "HELL");
        assert.ok(kontrast(textHelligkeit("HELL"), nachSchleier(tief, l, "HELL")) >= 4.49, `hell ${tief} ${l}`);
        assert.ok(d <= 0.95 && l <= 0.95);
      }
    }
  }
});

test("Schleier: dunkles Bild im dunklen Design nur Mindestwert, „viel“ dunkelt stärker ab", () => {
  assert.equal(schleier({ tief: 0, hoch: 0.05, abdunkeln: 0 }, "DUNKEL"), 0.3);
  assert.ok(schleier({ tief: 0, hoch: 0.05, abdunkeln: 2 }, "DUNKEL") > 0.55);
  assert.ok(schleier({ tief: 0.9, hoch: 1, abdunkeln: 0 }, "DUNKEL") > 0.7);
  assert.equal(schleier({ tief: 0.95, hoch: 1, abdunkeln: 0 }, "HELL"), 0.25);
});

test("Helligkeit messen: Perzentile statt Extremwerte", () => {
  const px: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const v = i < 5 ? 255 : 40; // fünf helle Punkte von tausend
    px.push(v, v, v, 255);
  }
  const m = helligkeitMessen(px);
  assert.equal(m.tief, 40 / 255);
  assert.equal(m.hoch, 40 / 255);
  const sterne: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const v = i < 30 ? 255 : 20;
    sterne.push(v, v, v, 255);
  }
  assert.equal(helligkeitMessen(sterne).hoch, 1);
  assert.deepEqual(helligkeitMessen([]), { tief: 0, hoch: 1 });
});

test("Bereich zum Pfad", () => {
  const hub = ["/termine", "/aufgaben"];
  assert.equal(bereichZuPfad("/", hub), "hub");
  assert.equal(bereichZuPfad("/termine?fach=x", hub), "hub");
  assert.equal(bereichZuPfad("/notizen/abc", hub), "notizen");
  assert.equal(bereichZuPfad("/einstellungen/personalisierung", hub), null);
});
