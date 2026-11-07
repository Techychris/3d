import assert from "node:assert/strict";
import { TAGS, ITEMS, BASE_STATS, computeStats, tagCounts, rollShrine, describeCard } from "../src/game/items.js";
import { createRng } from "../src/core/rng.js";

assert.ok(ITEMS.length >= 28);
assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
const counts = tagCounts(ITEMS.map((i) => i.id));
for (const t of Object.keys(TAGS)) assert.ok(counts[t] >= 5, t + " has " + counts[t]);
assert.ok(ITEMS.some((i) => i.tags.length === 2));
for (const i of ITEMS) { assert.ok(i.name && i.desc); i.tags.forEach((t) => assert.ok(TAGS[t])); }

const byTag = (t, n) => ITEMS.filter((i) => i.tags.length === 1 && i.tags[0] === t).slice(0, n).map((i) => i.id);

// 0 items
const s0 = computeStats([], { upgrades: { vigor: 0 } });
for (const k of Object.keys(BASE_STATS)) assert.equal(s0[k], BASE_STATS[k]);
assert.equal(s0.burnPct, 0); assert.equal(s0.summons, 0);

// 2 and 3 tag items
const f2 = byTag("fire", 2);
const s2 = computeStats(f2, null);
assert.equal(s2.burnPct, 0.10); assert.equal(s2.burnSpread, false);
const f3 = byTag("fire", 3);
assert.equal(computeStats(f3, null).burnSpread, true);
const c3 = computeStats(byTag("crit", 3), null);
assert.ok(c3.critMult >= 2.0 && c3.critChance >= 0.05 + 0.10);
assert.equal(computeStats(byTag("frost", 3), null).freezeEvery, 4);
assert.equal(computeStats(byTag("frost", 2), null).slowPct, 0.2);
assert.equal(computeStats(byTag("bleed", 3), null).bleedAmp, 0.15);
assert.equal(computeStats(byTag("shield", 3), null).shieldOnDodge, true);
assert.equal(computeStats(byTag("shield", 2), null).roomShield, 0.15);
assert.equal(computeStats(byTag("summon", 2), null).summons, 1);
assert.equal(computeStats(byTag("summon", 3), null).summons, 2);
const sp1 = computeStats(byTag("speed", 1), null), sp3 = computeStats(byTag("speed", 3), null);
assert.ok(sp3.dodgeCooldown < 0.8 * 0.75);
assert.ok(sp1.moveSpeed < 4.2 + 0.5);
assert.deepEqual(tagCounts(["smoldering-fang"]), { fire: 1, bleed: 1 });

// vigor
const v = (n) => computeStats([], { upgrades: { vigor: n } }).maxHp;
assert.equal(v(1), 105); assert.equal(v(2), 110); assert.equal(v(5), 110);

// rollShrine
const owned = ["ember-blade", "rime-ring"];
const a = rollShrine(createRng(7), owned), b = rollShrine(createRng(7), owned);
assert.deepEqual(a, b);
for (let seed = 1; seed < 300; seed++) {
  const r = rollShrine(createRng(seed), owned, 3);
  assert.equal(r.length, 3); assert.equal(new Set(r).size, 3);
  r.forEach((id) => assert.ok(!owned.includes(id)));
}
assert.equal(rollShrine(createRng(1), ITEMS.slice(2).map((i) => i.id), 3).length, 2);

// describeCard
const d = describeCard("candle-stub", ["ember-blade"]);
assert.equal(d.pairsWith, "Ember Blade");
assert.equal(d.bonusNote, "Fire ×2: hits burn");
assert.deepEqual(d.tags, [{ id: "fire", name: "Fire", owned: true }]);
const d2 = describeCard("swift-boots", ["ember-blade"]);
assert.equal(d2.pairsWith, null); assert.equal(d2.bonusNote, null);
assert.equal(d2.tags[0].owned, false);
assert.match(describeCard("ash-cloak", ["ember-blade", "candle-stub"]).bonusNote, /Fire ×3/);
console.log("items.test OK");
