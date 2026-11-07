import assert from "node:assert/strict";
import * as P from "../src/game/progress.js";

P.resetProgress();
const m = P.loadMeta();
assert.equal(m.currency, 0); assert.equal(m.upgrades.vigor, 0); assert.equal(m.settings.quality, "auto");
assert.equal(P.loadRun(), null);

m.currency = 50; m.codex.push("ember-blade"); m.upgrades.vigor = 1;
P.saveMeta(m);
assert.equal(P.loadMeta().currency, 50);
assert.deepEqual(P.loadMeta().codex, ["ember-blade"]);
const run = P.newRun("abc");
run.items.push("lucky-coin");
P.saveRun(run);
assert.equal(P.loadRun().items[0], "lucky-coin");
assert.equal(P.loadMeta().currency, 50);
P.clearRun();
assert.equal(P.loadRun(), null);
assert.equal(P.loadMeta().currency, 50);

assert.equal(P.upgradeCost({ upgrades: { vigor: 0 } }, "vigor"), 30);
assert.equal(P.upgradeCost({ upgrades: { vigor: 1 } }, "vigor"), 60);
assert.equal(P.upgradeCost({ upgrades: { vigor: 2 } }, "vigor"), null);
assert.equal(P.ENDINGS.length, 3);

const code = P.encodeSave(m, run);
const back = P.decodeSave(code);
assert.deepEqual(back.meta, P.loadMeta());
assert.deepEqual(back.run, run);
assert.equal(P.decodeSave(P.encodeSave(m, null)).run, null);

// tampering
const raw = JSON.parse(Buffer.from(code, "base64").toString("utf8"));
const forged = JSON.parse(raw.d); forged.meta.currency = 99999; raw.d = JSON.stringify(forged);
const bad = Buffer.from(JSON.stringify(raw)).toString("base64");
for (const c of [bad, code.slice(0, -4), "!!!", "", null, 42, Buffer.from("{}").toString("base64"),
  code.slice(0, 20) + (code[20] === "A" ? "B" : "A") + code.slice(21)]) {
  assert.throws(() => P.decodeSave(c), { message: "That code doesn't match a save." });
}
console.log("progress.test OK");
