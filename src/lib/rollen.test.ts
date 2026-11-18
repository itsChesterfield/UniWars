import { test } from "node:test";
import assert from "node:assert/strict";
import { adminErfordern, rollenAusZeilen, type Rolle } from "./rollen-kern.ts";

test("Rollen: fehlende IDs bekommen die Rolle user", () => {
  const zeilen: { user_id: string; role: Rolle }[] = [
    { user_id: "a", role: "admin" },
    { user_id: "b", role: "moderator" },
  ];
  const map = rollenAusZeilen(zeilen, ["a", "b", "c", "d"]);
  assert.equal(map.get("a"), "admin");
  assert.equal(map.get("b"), "moderator");
  assert.equal(map.get("c"), "user");
  assert.equal(map.get("d"), "user");
});

test("Rollen: leere ID-Liste gibt eine leere Map", () => {
  const map = rollenAusZeilen([{ user_id: "a", role: "admin" }], []);
  assert.equal(map.size, 0);
});

test("Rollen: adminErfordern wirft ohne Nutzer, bei user und moderator", () => {
  assert.throws(() => adminErfordern("user", "id-1"));
  assert.throws(() => adminErfordern("moderator", "id-1"));
  assert.throws(() => adminErfordern(null, null));
  assert.deepEqual(adminErfordern("admin", "id-1"), { userId: "id-1" });
});
