import test from "node:test";
import assert from "node:assert/strict";
import { makeWorld, spy, step } from "./helpers.mjs";
test("helpers build a world with stubs", () => {
  const w = makeWorld({ withPlayer: true });
  assert.equal(w.player.hp, 100); w.shake(1); assert.equal(w.shake.calls.length, 1);
  step(w, 0.1); assert.ok(w.time > 0);
  const f = spy((x) => x * 2); assert.equal(f(2), 4);
});
