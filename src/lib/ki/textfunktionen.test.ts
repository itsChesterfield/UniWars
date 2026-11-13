import { test } from "node:test";
import assert from "node:assert/strict";
import { entwurfBereinigen, knotenZaehlen, mindmapParsen, mindmapPromptBauen, MAX_KI_KNOTEN } from "./mindmap.ts";
import { zusammenfassungAlsMarkdown, zusammenfassungParsen, zusammenfassungPromptBauen } from "./zusammenfassung.ts";
import { KiEingabe, KiKeineDaten } from "./fehler.ts";
import { hatUeberlappung, knotenGroesse, radialLayout, type BaumKnoten } from "../mindmap/knoten.ts";

const LANG = "Inflation ist ein anhaltender Anstieg des Preisniveaus. ".repeat(6);

// ---------------------------------------------------------------------------
// KI-02 Zusammenfassen
// ---------------------------------------------------------------------------

test("KI-02: gültige Antwort, auch mit Text drumherum", () => {
  const z = zusammenfassungParsen(
    'Hier: {"zusammenfassung":["Inflation = Preisanstieg","Gemessen über VPI"],"luecken":[{"stelle":"Formel zur Inflationsrate","grund":"Herleitung fehlt"}]} Ende',
  );
  assert.deepEqual(z, {
    zusammenfassung: ["Inflation = Preisanstieg", "Gemessen über VPI"],
    luecken: [{ stelle: "Formel zur Inflationsrate", grund: "Herleitung fehlt" }],
  });
});

test("KI-02: kaputt, leer, zu groß", () => {
  assert.throws(() => zusammenfassungParsen("{kaputt"), KiKeineDaten);
  assert.throws(() => zusammenfassungParsen('{"zusammenfassung":[],"luecken":[]}'), (e) => e instanceof KiKeineDaten && /keine Zusammenfassung/.test(e.nutzerMeldung));
  const gross = zusammenfassungParsen(
    JSON.stringify({
      zusammenfassung: [...Array.from({ length: 12 }, (_, i) => `Punkt ${i}`), "Punkt 1", "   ", 5, "x".repeat(900)],
      luecken: [...Array.from({ length: 15 }, (_, i) => ({ stelle: `S${i}`, grund: "G" })), { stelle: "", grund: "ohne Stelle" }],
    }),
  );
  assert.equal(gross.zusammenfassung.length, 7);
  assert.equal(gross.luecken.length, 10);
  const lang = zusammenfassungParsen(JSON.stringify({ zusammenfassung: ["x".repeat(900)], luecken: "keine Liste" }));
  assert.equal(lang.zusammenfassung[0].length, 400);
  assert.deepEqual(lang.luecken, []);
});

test("KI-02: Prompt mit Markern, Mindestlänge 200", () => {
  const p = zusammenfassungPromptBauen({ titel: "VL 3", inhalt: LANG });
  assert.match(p.nutzer, /<notiz>\n[\s\S]*\n<\/notiz>$/);
  assert.match(p.system, /erfinde keine Lücken/);
  assert.throws(() => zusammenfassungPromptBauen({ titel: "x", inhalt: "a".repeat(199) }), KiEingabe);
});

test("KI-02: Markdown-Abschnitt mit optionalen offenen Punkten", () => {
  const z = { zusammenfassung: ["A", "B"], luecken: [{ stelle: "Formel", grund: "Herleitung fehlt" }] };
  assert.equal(zusammenfassungAlsMarkdown(z, false), "## Zusammenfassung\n\n- A\n- B");
  assert.equal(zusammenfassungAlsMarkdown(z, true), "## Zusammenfassung\n\n- A\n- B\n\n### Offene Punkte\n\n- [ ] **Formel** – Herleitung fehlt");
});

// ---------------------------------------------------------------------------
// KI-07 MindMap
// ---------------------------------------------------------------------------

const k = (text: string, kinder: BaumKnoten[] = []): BaumKnoten => ({ text, kinder });

test("KI-07: gültige Antwort", () => {
  const e = mindmapParsen('{"wurzel":"Makro","knoten":[{"text":"Inflation","kinder":[{"text":"VPI","kinder":[]}]},{"text":"BIP"}]}', "Titel");
  assert.deepEqual(e, { wurzel: "Makro", knoten: [k("Inflation", [k("VPI")]), k("BIP")] });
});

test("KI-07: kaputt, leer → KiKeineDaten; fehlende Wurzel → Titel", () => {
  assert.throws(() => mindmapParsen("{", "T"), KiKeineDaten);
  assert.throws(() => mindmapParsen('{"wurzel":"X","knoten":[]}', "T"), KiKeineDaten);
  assert.throws(() => mindmapParsen('{"wurzel":"X","knoten":[{"text":"  "},{"kinder":[]}]}', "T"), KiKeineDaten);
  assert.equal(mindmapParsen('{"knoten":[{"text":"A"}]}', "Notiztitel").wurzel, "Notiztitel");
});

test("KI-07: höchstens 3 Ebenen und 30 Knoten – Hauptäste bleiben beim Kürzen erhalten", () => {
  const tief = entwurfBereinigen([{ text: "1", kinder: [{ text: "2", kinder: [{ text: "3", kinder: [{ text: "4 (zu tief)", kinder: [] }] }] }] }]);
  assert.deepEqual(tief, [k("1", [k("2", [k("3")])])]);
  const riesig = Array.from({ length: 12 }, (_, i) => ({ text: `Ast ${i}`, kinder: Array.from({ length: 6 }, (_, j) => ({ text: `${i}.${j}`, kinder: [] })) }));
  const gekuerzt = entwurfBereinigen(riesig);
  assert.equal(knotenZaehlen(gekuerzt), MAX_KI_KNOTEN);
  assert.equal(gekuerzt.length, 12, "alle Hauptäste bleiben");
  assert.equal(entwurfBereinigen([{ text: "x".repeat(200) }])[0].text.length, 80);
});

test("KI-07: Prompt mit Markern, Mindestlänge", () => {
  assert.match(mindmapPromptBauen({ titel: "T", inhalt: LANG }).nutzer, /<notiz>/);
  assert.throws(() => mindmapPromptBauen({ titel: "T", inhalt: "kurz" }), KiEingabe);
});

test("KI-07: radiales Layout – Wurzel in der Mitte, Struktur und Farben stimmen", () => {
  let n = 0;
  const d = radialLayout("Makro", [k("Inflation", [k("VPI")]), k("BIP")], () => `id${n++}`);
  assert.equal(d.knoten.length, 4);
  const [wurzel, inflation, vpi, bip] = d.knoten;
  assert.deepEqual([wurzel.x, wurzel.y, wurzel.parent_id], [0, 0, null]);
  assert.equal(inflation.parent_id, wurzel.id);
  assert.equal(vpi.parent_id, inflation.id);
  assert.equal(bip.parent_id, wurzel.id);
  assert.equal(vpi.farbe, inflation.farbe, "Unteräste erben die Astfarbe");
  assert.notEqual(inflation.farbe, bip.farbe);
  // VPI liegt weiter außen als sein Elternknoten
  assert.ok(Math.hypot(vpi.x, vpi.y) > Math.hypot(inflation.x, inflation.y));
});

test("KI-07: radiales Layout – keine Überlappungen (breite, tiefe, gemischte Bäume, lange Texte)", () => {
  const lang = (i: number) => `Sehr langer Knotentext Nummer ${i} mit vielen Wörtern drin`;
  const baeume: Record<string, BaumKnoten[]> = {
    breit: Array.from({ length: 30 }, (_, i) => k(lang(i))),
    tief: [k("A", [k("A1", [k("A1a"), k("A1b"), k("A1c")]), k("A2", [k("A2a"), k("A2b")])]), k("B", [k("B1", [k("B1a")])])],
    gemischt: Array.from({ length: 6 }, (_, i) => k(lang(i), Array.from({ length: 3 }, (_, j) => k(`${i}.${j} ${lang(j)}`, [k(`${i}.${j}.x`)])))).slice(0, 6),
    einAst: [k("Einziger Ast", Array.from({ length: 10 }, (_, i) => k(lang(i))))],
  };
  for (const [name, baum] of Object.entries(baeume)) {
    const d = radialLayout("Hauptthema der Vorlesung", entwurfBereinigen(baum));
    assert.ok(!hatUeberlappung(d), `${name}: Knoten überlappen`);
    for (const a of d.knoten) for (const b of d.knoten) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 40, `${name}: Mindestabstand`);
    assert.ok(d.knoten.every((x) => Number.isInteger(x.x) && Number.isInteger(x.y)));
  }
});

test("KI-07: Knotengröße wie im Editor begrenzt", () => {
  assert.deepEqual(knotenGroesse("", false), { b: 90, h: 40 });
  assert.equal(knotenGroesse("x".repeat(200), false).b, 360);
  assert.equal(knotenGroesse("Wurzel", true).h, 54);
});
