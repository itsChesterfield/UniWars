import { test } from "node:test";
import assert from "node:assert/strict";
import { ereignisLesen, MAX_SAGEN_ZEICHEN, MAX_STRICH_PUNKTE } from "./protokoll.ts";

test("sagen: gueltig und getrimmt", () => {
  assert.deepEqual(ereignisLesen('{"typ":"sagen","text":"  Hallo  "}'), { typ: "sagen", text: "Hallo" });
});

test("sagen: leer oder zu lang ist ungueltig", () => {
  assert.equal(ereignisLesen('{"typ":"sagen","text":"   "}'), null);
  assert.equal(ereignisLesen(`{"typ":"sagen","text":"${"a".repeat(MAX_SAGEN_ZEICHEN + 1)}"}`), null);
});

test("titel: gueltig", () => {
  assert.deepEqual(ereignisLesen('{"typ":"titel","text":"Thema"}'), { typ: "titel", text: "Thema" });
});

test("bild: gueltig mit Groesse", () => {
  assert.deepEqual(ereignisLesen('{"typ":"bild","symbol":"baum","x":500,"y":300,"groesse":200}'), {
    typ: "bild",
    symbol: "baum",
    x: 500,
    y: 300,
    groesse: 200,
  });
});

test("bild: ohne Groesse nimmt die Vorgabe", () => {
  const e = ereignisLesen('{"typ":"bild","symbol":"sonne","x":100,"y":100}');
  assert.equal(e?.typ, "bild");
  assert.ok(e && "groesse" in e && e.groesse > 0);
});

test("bild: Groesse wird begrenzt", () => {
  const klein = ereignisLesen('{"typ":"bild","symbol":"sonne","x":0,"y":0,"groesse":1}');
  const gross = ereignisLesen('{"typ":"bild","symbol":"sonne","x":0,"y":0,"groesse":99999}');
  assert.ok(klein && "groesse" in klein && klein.groesse >= 20);
  assert.ok(gross && "groesse" in gross && gross.groesse <= 500);
});

test("bild: fehlendes Symbol oder Koordinaten ist ungueltig", () => {
  assert.equal(ereignisLesen('{"typ":"bild","x":1,"y":2}'), null);
  assert.equal(ereignisLesen('{"typ":"bild","symbol":"baum","x":1}'), null);
  assert.equal(ereignisLesen('{"typ":"bild","symbol":"baum","x":"viel","y":2}'), null);
});

test("text: gueltig, fehlende Koordinaten ungueltig", () => {
  assert.deepEqual(ereignisLesen('{"typ":"text","text":"Licht","x":10,"y":20,"groesse":26}'), {
    typ: "text",
    text: "Licht",
    x: 10,
    y: 20,
    groesse: 26,
  });
  assert.equal(ereignisLesen('{"typ":"text","text":"Licht"}'), null);
});

test("pfeil: mit und ohne Label", () => {
  assert.deepEqual(ereignisLesen('{"typ":"pfeil","x1":0,"y1":0,"x2":10,"y2":10,"label":"Licht"}'), {
    typ: "pfeil",
    x1: 0,
    y1: 0,
    x2: 10,
    y2: 10,
    label: "Licht",
  });
  assert.deepEqual(ereignisLesen('{"typ":"pfeil","x1":0,"y1":0,"x2":10,"y2":10}'), { typ: "pfeil", x1: 0, y1: 0, x2: 10, y2: 10 });
});

test("linie: gueltig, fehlende Koordinate ungueltig", () => {
  assert.deepEqual(ereignisLesen('{"typ":"linie","x1":0,"y1":0,"x2":10,"y2":10}'), { typ: "linie", x1: 0, y1: 0, x2: 10, y2: 10 });
  assert.equal(ereignisLesen('{"typ":"linie","x1":0,"y1":0,"x2":10}'), null);
});

test("strich: gueltige Punktliste", () => {
  assert.deepEqual(ereignisLesen('{"typ":"strich","punkte":[0,0,10,5,20,0]}'), { typ: "strich", punkte: [0, 0, 10, 5, 20, 0] });
});

test("strich: ungerade, zu kurz oder mit Unzahl ist ungueltig", () => {
  assert.equal(ereignisLesen('{"typ":"strich","punkte":[0,0,10]}'), null); // ungerade
  assert.notEqual(ereignisLesen('{"typ":"strich","punkte":[0,0,10,10]}'), null); // genau vier Werte ist erlaubt
  assert.equal(ereignisLesen('{"typ":"strich","punkte":[0,0]}'), null); // zu kurz
  assert.equal(ereignisLesen('{"typ":"strich","punkte":[0,0,"x",1]}'), null);
});

test("strich: wird auf Hoechstlaenge gekappt", () => {
  const viele = Array.from({ length: MAX_STRICH_PUNKTE + 50 }, (_, i) => i);
  const e = ereignisLesen(JSON.stringify({ typ: "strich", punkte: viele }));
  assert.ok(e && e.typ === "strich" && e.punkte.length <= MAX_STRICH_PUNKTE);
});

test("fertig und Fehlerfaelle", () => {
  assert.deepEqual(ereignisLesen('{"typ":"fertig"}'), { typ: "fertig" });
  assert.equal(ereignisLesen(""), null);
  assert.equal(ereignisLesen('{"typ":"sagen","text":'), null);
  assert.equal(ereignisLesen('{"typ":"loeschen"}'), null);
  assert.equal(ereignisLesen('"string"'), null);
  assert.equal(ereignisLesen("[1,2]"), null);
});
