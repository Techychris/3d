import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TAGS, ITEMS, BASE_STATS, getItem, tagCounts, computeStats, rollShrine, effectText, describeCard,
} from "../../src/game/items.js";
import { createRng } from "../../src/core/rng.js";

// Single-tag items of one tag, first n in table order.
const byTag = (t, n) => ITEMS.filter((i) => i.tags.length === 1 && i.tags[0] === t).slice(0, n).map((i) => i.id);

describe("item table", () => {
  it("has at least 28 items with unique ids, names and descriptions", () => {
    assert.ok(ITEMS.length >= 28);
    assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
    for (const i of ITEMS) assert.ok(i.name && i.desc, i.id);
  });

  it("gives every tag at least 5 single-or-combo items, and uses only known tags", () => {
    const counts = tagCounts(ITEMS.map((i) => i.id));
    for (const t of Object.keys(TAGS)) assert.ok(counts[t] >= 5, `${t} has ${counts[t]}`);
    for (const i of ITEMS) i.tags.forEach((t) => assert.ok(TAGS[t], `unknown tag ${t} on ${i.id}`));
    assert.ok(ITEMS.some((i) => i.tags.length === 2));
  });
});

describe("getItem", () => {
  it("returns the item for a known id and null for an unknown one", () => {
    assert.equal(getItem("ember-blade").name, "Ember Blade");
    assert.equal(getItem("no-such-item"), null);
  });
});

describe("tagCounts", () => {
  it("counts tags across items, counting a two-tag item toward both tags", () => {
    assert.deepEqual(tagCounts(["smoldering-fang"]), { fire: 1, bleed: 1 });
    assert.deepEqual(tagCounts(["ember-blade", "candle-stub", "thorn-glove"]), { fire: 2, bleed: 1 });
  });

  it("skips unknown ids and treats a missing list as empty", () => {
    assert.deepEqual(tagCounts(["ember-blade", "ghost"]), { fire: 1 });
    assert.deepEqual(tagCounts(), {});
    assert.deepEqual(tagCounts(null), {});
  });
});

describe("computeStats", () => {
  it("returns base stats for no items and no meta", () => {
    const s0 = computeStats([], { upgrades: { vigor: 0 } });
    for (const k of Object.keys(BASE_STATS)) assert.equal(s0[k], BASE_STATS[k], k);
    assert.equal(s0.burnPct, 0);
    assert.equal(s0.summons, 0);
    assert.equal(computeStats(undefined, undefined).maxHp, BASE_STATS.maxHp);
  });

  it("applies flat mods from items and ignores unknown ids", () => {
    const s = computeStats(["ember-blade", "ash-cloak", "ghost"], null);
    assert.equal(s.damage, BASE_STATS.damage + 2);
    assert.equal(s.maxHp, BASE_STATS.maxHp + 10);
  });

  it("adds mod keys that are not base stats as new numbers", () => {
    // Shipped items only use base-stat keys, so inject one temporarily to reach that path.
    const item = getItem("ember-blade");
    item.mods.bogus = 3;
    try {
      assert.equal(computeStats(["ember-blade"], null).bogus, 3);
    } finally {
      delete item.mods.bogus;
    }
  });

  it("turns fire on at two and spreading flames on at three", () => {
    const s2 = computeStats(byTag("fire", 2), null);
    assert.equal(s2.burnPct, 0.10);
    assert.equal(s2.burnSpread, false);
    assert.equal(computeStats(byTag("fire", 3), null).burnSpread, true);
    const s1 = computeStats(byTag("fire", 1), null);
    assert.equal(s1.burnPct, 0);
  });

  it("turns frost slow on at two and freezing on at three", () => {
    assert.equal(computeStats(byTag("frost", 1), null).slowPct, 0);
    assert.equal(computeStats(byTag("frost", 2), null).slowPct, 0.2);
    assert.equal(computeStats(byTag("frost", 2), null).freezeEvery, 0);
    assert.equal(computeStats(byTag("frost", 3), null).freezeEvery, 4);
  });

  it("turns bleed bonuses on at two and three", () => {
    assert.equal(computeStats(byTag("bleed", 1), null).bleedPct, 0);
    assert.equal(computeStats(byTag("bleed", 2), null).bleedPct, 0.15);
    assert.equal(computeStats(byTag("bleed", 2), null).bleedAmp, 0);
    assert.equal(computeStats(byTag("bleed", 3), null).bleedAmp, 0.15);
  });

  it("adds crit chance and damage bonuses at two and three crit items", () => {
    // lucky-coin +0.04, keen-whetstone (damage only), owl-feather +0.03.
    const c1 = computeStats(byTag("crit", 1), null);
    assert.equal(c1.critChance, 0.09);
    assert.equal(c1.critMult, 1.5);
    const c2 = computeStats(byTag("crit", 2), null);
    assert.equal(c2.critChance, 0.19);
    assert.equal(c2.critMult, 1.5);
    const c3 = computeStats(byTag("crit", 3), null);
    assert.ok(c3.critMult >= 2.0 && c3.critChance >= 0.05 + 0.10);
    assert.equal(c3.critMult, 2);
    assert.equal(c3.critChance, 0.22);
  });

  it("gives room shields at two shield items and shield on dodge at three", () => {
    assert.equal(computeStats(byTag("shield", 1), null).roomShield, 0);
    assert.equal(computeStats(byTag("shield", 2), null).roomShield, 0.15);
    assert.equal(computeStats(byTag("shield", 2), null).shieldOnDodge, false);
    assert.equal(computeStats(byTag("shield", 3), null).shieldOnDodge, true);
  });

  it("speeds movement at two speed items and shortens dodge cooldown at three", () => {
    // swift-boots +0.3 move, dusk-ribbon +0.3 move, hare-foot -0.05 dodge cooldown.
    const sp1 = computeStats(byTag("speed", 1), null);
    assert.equal(sp1.moveSpeed, 4.5);
    assert.equal(sp1.dodgeCooldown, BASE_STATS.dodgeCooldown);
    const sp2 = computeStats(byTag("speed", 2), null);
    assert.equal(sp2.moveSpeed, 5.28);
    assert.equal(sp2.dodgeCooldown, BASE_STATS.dodgeCooldown);
    const sp3 = computeStats(byTag("speed", 3), null);
    assert.equal(sp3.dodgeCooldown, 0.525);
    assert.ok(sp3.dodgeCooldown < 0.8 * 0.75);
  });

  it("summons one spirit at two summon items and two at three", () => {
    assert.equal(computeStats(byTag("summon", 1), null).summons, 0);
    assert.equal(computeStats(byTag("summon", 2), null).summons, 1);
    assert.equal(computeStats(byTag("summon", 3), null).summons, 2);
  });

  it("clamps the dodge cooldown floor at 0.2 seconds and crit chance at 1", () => {
    const many = Array(20).fill("hare-foot");
    assert.equal(computeStats(many, null).dodgeCooldown, 0.2);
    const crits = Array(30).fill("icicle-pin");
    assert.equal(computeStats(crits, null).critChance, 1);
  });

  describe("vigor upgrade", () => {
    const hp = (meta) => computeStats([], meta).maxHp;
    it("adds 5% max health per level, capped at two levels", () => {
      assert.equal(hp({ upgrades: { vigor: 1 } }), 105);
      assert.equal(hp({ upgrades: { vigor: 2 } }), 110);
      assert.equal(hp({ upgrades: { vigor: 5 } }), 110);
    });
    it("ignores negative, fractional or missing levels", () => {
      assert.equal(hp({ upgrades: { vigor: -1 } }), 100);
      assert.equal(hp({ upgrades: { vigor: 1.9 } }), 105);
      assert.equal(hp({ upgrades: {} }), 100);
      assert.equal(hp({}), 100);
      assert.equal(hp(null), 100);
    });
  });
});

describe("rollShrine", () => {
  it("returns the requested number of distinct items that the player does not own", () => {
    const owned = ["ember-blade", "rime-ring"];
    for (let seed = 1; seed < 300; seed++) {
      const r = rollShrine(createRng(seed), owned, 3);
      assert.equal(r.length, 3);
      assert.equal(new Set(r).size, 3);
      r.forEach((id) => assert.ok(!owned.includes(id)));
    }
  });

  it("is repeatable for the same seed", () => {
    const owned = ["ember-blade", "rime-ring"];
    assert.deepEqual(rollShrine(createRng(7), owned), rollShrine(createRng(7), owned));
  });

  it("defaults to three choices and to no owned items", () => {
    assert.equal(rollShrine(createRng(4)).length, 3);
    assert.equal(rollShrine(createRng(4), null).length, 3);
  });

  it("returns fewer items when the pool runs out, and none when everything is owned", () => {
    assert.equal(rollShrine(createRng(1), ITEMS.slice(2).map((i) => i.id), 3).length, 2);
    assert.deepEqual(rollShrine(createRng(1), ITEMS.map((i) => i.id), 3), []);
    assert.deepEqual(rollShrine(createRng(1), [], 0), []);
  });

  it("picks in table order when the random source always returns 0", () => {
    assert.deepEqual(rollShrine(() => 0, [], 3), ["ember-blade", "candle-stub", "ash-cloak"]);
  });

  it("favours items that would form a tag combo with what the player owns", () => {
    // candle-stub (Fire) pairs with ember-blade (Fire); swift-boots (Speed) does not.
    const owned = ["ember-blade"];
    let combo = 0, plain = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const r = rollShrine(createRng(seed), owned, 1)[0];
      if (r === "candle-stub") combo++;
      if (r === "swift-boots") plain++;
    }
    assert.ok(combo > plain, `combo ${combo} vs plain ${plain}`);
  });
});

describe("effectText", () => {
  it("describes each mod key in player-facing words", () => {
    assert.equal(effectText({ damage: 2 }), "+2 damage");
    assert.equal(effectText({ maxHp: 10 }), "+10 max health");
    assert.equal(effectText({ critChance: 0.04 }), "+4% crit chance");
    assert.equal(effectText({ critMult: 0.1 }), "+10% crit damage");
    assert.equal(effectText({ dodgeCooldown: -0.05 }), "-0.05s dodge cooldown");
  });

  it("expresses attack and move speed as a percentage of the base value", () => {
    assert.equal(effectText({ attackRate: 0.2 }), "+9% attack speed");
    assert.equal(effectText({ moveSpeed: 0.3 }), "+7% move speed");
    assert.equal(effectText({ attackRate: -0.2 }), "-9% attack speed");
  });

  it("falls back to the raw key name for anything else", () => {
    assert.equal(effectText({ burnBonus: 3 }), "burnBonus +3");
    assert.equal(effectText({ burnBonus: -1 }), "burnBonus -1");
  });

  it("joins several mods with commas and returns empty text for none", () => {
    assert.equal(effectText({ damage: 1, maxHp: 5 }), "+1 damage, +5 max health");
    assert.equal(effectText({}), "");
    assert.equal(effectText(), "");
  });
});

describe("describeCard", () => {
  it("returns null for an unknown item", () => {
    assert.equal(describeCard("no-such-item", []), null);
  });

  it("describes a card with a combo note and the item it pairs with", () => {
    const d = describeCard("candle-stub", ["ember-blade"]);
    assert.equal(d.pairsWith, "Ember Blade");
    assert.equal(d.bonusNote, "Fire ×2: hits burn");
    assert.deepEqual(d.tags, [{ id: "fire", name: "Fire", owned: true }]);
    assert.equal(d.effect, "+9% attack speed");
  });

  it("has no pairing or combo note when nothing owned shares its tags", () => {
    const d = describeCard("swift-boots", ["ember-blade"]);
    assert.equal(d.pairsWith, null);
    assert.equal(d.bonusNote, null);
    assert.equal(d.tags[0].owned, false);
  });

  it("uses the three-stack wording at the third matching item", () => {
    assert.match(describeCard("ash-cloak", ["ember-blade", "candle-stub"]).bonusNote, /Fire ×3/);
    assert.equal(describeCard("ash-cloak", ["ember-blade", "candle-stub"]).bonusNote,
      "Fire ×3: burning foes spread flames");
  });

  it("ignores its own id and unknown ids when looking for a pairing", () => {
    const self = describeCard("candle-stub", ["candle-stub"]);
    assert.equal(self.pairsWith, null);
    assert.equal(self.bonusNote, "Fire ×2: hits burn");
    const unknown = describeCard("swift-boots", ["ghost"]);
    assert.equal(unknown.pairsWith, null);
  });

  it("notes the bigger of two combo tags when an item completes two of them", () => {
    // smoldering-fang is Fire + Bleed. Both tags make a combo here; the note picks the higher count.
    const bleedHeavy = describeCard("smoldering-fang", ["thorn-glove", "red-thread", "ember-blade"]);
    assert.equal(bleedHeavy.bonusNote, "Bleed ×3: bleeding foes take more damage");
    const fireHeavy = describeCard("smoldering-fang", ["ember-blade", "candle-stub", "thorn-glove"]);
    assert.equal(fireHeavy.bonusNote, "Fire ×3: burning foes spread flames");
    // A tie keeps the first tag on the item.
    const tie = describeCard("smoldering-fang", ["ember-blade", "thorn-glove"]);
    assert.equal(tie.bonusNote, "Fire ×2: hits burn");
  });

  it("marks a tag as owned only when the player already has an item with it", () => {
    const d = describeCard("smoldering-fang", ["ember-blade"]);
    const byId = Object.fromEntries(d.tags.map((t) => [t.id, t.owned]));
    assert.deepEqual(byId, { fire: true, bleed: false });
  });

  it("treats a missing owned list as empty", () => {
    const d = describeCard("ember-blade");
    assert.equal(d.pairsWith, null);
    assert.equal(d.bonusNote, null);
  });
});
