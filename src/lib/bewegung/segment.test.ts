import { test } from "node:test";
import assert from "node:assert/strict";
import { gleicheLage, markeLage } from "./segment.ts";

test("markeLage: unter dem gewählten Eintrag, sonst keine", () => {
  const e = (links: number, gewaehlt = false, breite = 60) => ({ links, oben: 2, breite, hoehe: 30, gewaehlt });
  assert.deepEqual(markeLage([e(2), e(62.4, true, 80.6)]), { x: 62, y: 2, breite: 81, hoehe: 30 });
  assert.equal(markeLage([e(2), e(62)]), null);
  assert.equal(markeLage([e(2, true, 0)]), null);
  assert.ok(gleicheLage(markeLage([e(2, true)]), markeLage([e(2.2, true)])));
  assert.ok(!gleicheLage(markeLage([e(2, true)]), null));
});
