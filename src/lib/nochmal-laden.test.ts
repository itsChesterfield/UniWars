import { test } from "node:test";
import assert from "node:assert/strict";
import { nochmalBei401 } from "./nochmal-laden.ts";

test("nochmalBei401: lädt nur einmal, wenn alles durchgeht", async () => {
  let aufrufe = 0;
  const r = await nochmalBei401(async () => {
    aufrufe++;
    return [{ status: 200 }, { status: 206 }] as const;
  });
  assert.equal(aufrufe, 1);
  assert.equal(r[0].status, 200);
});

test("nochmalBei401: wiederholt einmal nach abgelehnter Anmeldung", async () => {
  let aufrufe = 0;
  const r = await nochmalBei401(async () => {
    aufrufe++;
    return [{ status: 200 }, { status: aufrufe === 1 ? 401 : 200 }];
  });
  assert.equal(aufrufe, 2);
  assert.deepEqual(r.map((x) => x.status), [200, 200]);
});

test("nochmalBei401: höchstens ein zweiter Versuch", async () => {
  let aufrufe = 0;
  const r = await nochmalBei401(async () => {
    aufrufe++;
    return [{ status: 401 }];
  });
  assert.equal(aufrufe, 2);
  assert.equal(r[0].status, 401);
});

test("nochmalBei401: jeder Versuch mit eigenem Signal (gegen gemerkte Antworten)", async () => {
  const signale: AbortSignal[] = [];
  await nochmalBei401(async (s) => {
    signale.push(s);
    return [{ status: signale.length === 1 ? 401 : 200 }];
  });
  assert.equal(signale.length, 2);
  assert.notEqual(signale[0], signale[1]);
});
