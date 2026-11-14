// Unit tests for src/game/gear.js (gear, consumables and the inventory rules).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as G from "../../src/game/gear.js";
import { computeStats, BASE_STATS } from "../../src/game/items.js";

const rngOf = (v, pick = 0) => Object.assign(() => v, { int: () => pick });

describe("gear data", () => {
  it("has four pieces per slot, each with a name and stat changes that computeStats understands", () => {
    const bySlot = {};
    for (const [id, g] of Object.entries(G.GEAR)) {
      (bySlot[g.slot] = bySlot[g.slot] || []).push(id);
      assert.ok(g.name && Object.keys(g.mods).length > 0, id);
      for (const k of Object.keys(g.mods)) assert.ok(k in BASE_STATS, `${id}.${k}`);
    }
    assert.deepEqual(Object.keys(bySlot).sort(), [...G.SLOTS].sort());
    for (const s of G.SLOTS) { assert.equal(bySlot[s].length, 4); assert.ok(G.SLOT_NAMES[s]); }
    for (const c of Object.values(G.CONSUMABLES)) assert.ok(c.name && c.desc && c.icon && c.key);
  });
});

describe("gearInfo", () => {
  it("describes a common piece plainly", () => {
    assert.deepEqual(G.gearInfo("iron-sword:common"), { key: "iron-sword:common", id: "iron-sword", rarity: "common", rarityName: "Common", slot: "weapon", name: "Iron Sword", mods: { damage: 3 }, effect: "+3 damage" });
  });
  it("scales bonuses with rarity, rounds them, names the rarity, and leaves drawbacks alone", () => {
    const rare = G.gearInfo("war-hammer:rare"), epic = G.gearInfo("chain-mail:epic");
    assert.equal(rare.name, "Rare War Hammer");
    assert.deepEqual(rare.mods, { damage: 8, attackRate: -0.2 });
    assert.deepEqual(epic.mods, { maxHp: 67, moveSpeed: -0.2 });
    assert.deepEqual(G.gearInfo("hawk-charm:epic").mods, { critChance: 0.12 });
  });
  it("returns null for anything that is not a real piece", () => {
    for (const bad of ["iron-sword", "iron-sword:shiny", "spoon:rare", "", null, undefined, 7]) assert.equal(G.gearInfo(bad), null);
  });
});

describe("rollGear", () => {
  it("picks the base from the rng and the rarity from the roll", () => {
    assert.equal(G.rollGear(rngOf(0.9, 0)), "iron-sword:common");
    assert.equal(G.rollGear(rngOf(0.3, 11)), "heart-locket:rare");
    assert.equal(G.rollGear(rngOf(0.05, 4)), "leather-jerkin:epic");
  });
  it("rolls rarer on deeper floors and from better sources", () => {
    assert.equal(G.rollGear(rngOf(0.5), 1), "iron-sword:common");
    assert.equal(G.rollGear(rngOf(0.5), 3), "iron-sword:rare");
    assert.equal(G.rollGear(rngOf(0.5), 1, 0.4), "iron-sword:epic");
  });
  it("only ever makes real pieces", () => {
    let s = 7; const rng = Object.assign(() => (s = (s * 16807) % 2147483647) / 2147483647, { int: (a, b) => a + Math.floor(rng() * (b - a + 1)) });
    for (let i = 0; i < 300; i++) assert.ok(G.gearInfo(G.rollGear(rng, 1 + (i % 3), (i % 4) * 0.2)));
  });
});

describe("inventory", () => {
  it("starts empty with one potion", () => {
    assert.deepEqual(G.newInventory(), { equip: { weapon: null, armour: null, trinket: null }, bag: [], potions: 1, bombs: 0 });
  });
  it("normalizeInventory keeps valid data and repairs the rest", () => {
    assert.deepEqual(G.normalizeInventory(null), G.newInventory());
    assert.deepEqual(G.normalizeInventory("x"), G.newInventory());
    const inv = G.normalizeInventory({ equip: { weapon: "iron-sword:rare", armour: "iron-sword:rare", trinket: "nope" }, bag: ["hawk-charm:common", "junk", 5, ...Array(12).fill("ember-ring:epic")], potions: 9, bombs: -2 });
    assert.deepEqual(inv.equip, { weapon: "iron-sword:rare", armour: null, trinket: null }, "a piece only fits its own slot");
    assert.equal(inv.bag.length, G.BAG_SIZE);
    assert.equal(inv.bag[0], "hawk-charm:common");
    assert.deepEqual([inv.potions, inv.bombs], [3, 0]);
    assert.deepEqual(G.normalizeInventory({ equip: 3, bag: "no", potions: "two" }), { ...G.newInventory(), potions: 0 });
  });
  it("addGear fills the bag and refuses when it is full", () => {
    const inv = G.newInventory();
    for (let i = 0; i < G.BAG_SIZE; i++) assert.equal(G.addGear(inv, "ember-ring:common"), true);
    assert.equal(G.addGear(inv, "iron-sword:epic"), false);
    assert.equal(inv.bag.length, G.BAG_SIZE);
  });
  it("equip moves a piece into its slot; a replaced piece takes its place in the bag", () => {
    const inv = G.newInventory();
    G.addGear(inv, "iron-sword:common"); G.addGear(inv, "hawk-charm:rare"); G.addGear(inv, "war-hammer:epic");
    assert.equal(G.equip(inv, 0), true);
    assert.deepEqual([inv.equip.weapon, inv.bag], ["iron-sword:common", ["hawk-charm:rare", "war-hammer:epic"]]);
    assert.equal(G.equip(inv, 1), true);
    assert.deepEqual([inv.equip.weapon, inv.bag], ["war-hammer:epic", ["hawk-charm:rare", "iron-sword:common"]]);
    assert.equal(G.equip(inv, 9), false);
  });
  it("unequip returns a piece to the bag unless the slot is empty or the bag is full", () => {
    const inv = G.newInventory();
    assert.equal(G.unequip(inv, "weapon"), false);
    G.addGear(inv, "iron-sword:common"); G.equip(inv, 0);
    for (let i = 0; i < G.BAG_SIZE; i++) G.addGear(inv, "ember-ring:common");
    assert.equal(G.unequip(inv, "weapon"), false);
    G.dropGear(inv, 0);
    assert.equal(G.unequip(inv, "weapon"), true);
    assert.equal(inv.equip.weapon, null);
    assert.equal(inv.bag.at(-1), "iron-sword:common");
  });
  it("dropGear removes one bag item and ignores bad positions", () => {
    const inv = G.newInventory(); G.addGear(inv, "iron-sword:common"); G.addGear(inv, "hawk-charm:rare");
    assert.equal(G.dropGear(inv, -1), false); assert.equal(G.dropGear(inv, 2), false);
    assert.equal(G.dropGear(inv, 0), true);
    assert.deepEqual(inv.bag, ["hawk-charm:rare"]);
  });
  it("consumables stack up to the cap", () => {
    const inv = G.newInventory();
    assert.equal(G.addConsumable(inv, "potions"), true); assert.equal(G.addConsumable(inv, "potions"), true);
    assert.equal(G.addConsumable(inv, "potions"), false);
    assert.equal(inv.potions, G.MAX_CONSUMABLE);
    assert.equal(G.addConsumable(inv, "bombs"), true);
    assert.equal(inv.bombs, 1);
  });
  it("gearMods lists what is equipped, and computeStats applies it", () => {
    const inv = G.newInventory();
    assert.deepEqual(G.gearMods(inv), []);
    G.addGear(inv, "iron-sword:rare"); G.addGear(inv, "leather-jerkin:common"); G.equip(inv, 0); G.equip(inv, 0);
    assert.deepEqual(G.gearMods(inv), [{ damage: 5 }, { maxHp: 15 }]);
    const s = computeStats([], {}, G.gearMods(inv));
    assert.deepEqual([s.damage, s.maxHp], [BASE_STATS.damage + 5, BASE_STATS.maxHp + 15]);
  });
});

// ---- the inventory in the UI, the save, and the player
import { before, after } from "node:test";
import { installDom, makeWorld } from "./helpers.mjs";
import * as P from "../../src/game/progress.js";
import { createPlayer } from "../../src/game/player.js";

describe("inventory in saves and on the player", () => {
  it("a new run carries a fresh inventory, and a saved one survives a round trip with bad data repaired", () => {
    const r = P.newRun("s");
    assert.deepEqual(r.inv, G.newInventory());
    r.inv.bag.push("iron-sword:rare", "junk"); r.inv.potions = 2;
    P.saveRun(r);
    assert.deepEqual(P.loadRun().inv, { ...G.newInventory(), bag: ["iron-sword:rare"], potions: 2 });
    P.saveRun({ ...r, inv: undefined });
    assert.deepEqual(P.loadRun().inv, G.newInventory());
    P.resetProgress();
  });
  it("syncMaxHp takes a new max health without healing, and trims health that no longer fits", () => {
    const w = makeWorld(); const p = createPlayer(w, "hero-warrior"); w.player = p;
    p.hp = 50;
    p.syncMaxHp(130); w.stats.maxHp = 130; w.dt = 1 / 60; w.time += 1 / 60; p.update(w, 1 / 60, {});
    assert.deepEqual([p.maxHp, p.hp], [130, 50], "no free heal from swapping gear");
    p.syncMaxHp(40);
    assert.deepEqual([p.maxHp, p.hp], [40, 40]);
  });
});

describe("inventory UI", () => {
  let dom, root, ui;
  before(async () => { dom = await installDom(); const { createUI } = await import("../../src/ui/ui.js"); root = dom.window.document.createElement("div"); dom.window.document.body.append(root); ui = createUI(root); });
  after(() => { ui.hideAll(); dom.cleanup(); });
  const btns = (name) => [...root.querySelectorAll("button")].filter((b) => b.textContent === name);
  const item = (key) => { const g = G.gearInfo(key); return { name: g.name, rarity: g.rarity, effect: g.effect }; };

  it("the HUD belt shows consumable counts, disables an empty one, and reports use and bag presses", () => {
    root.querySelector(".belt .beltbtn").click(); // no handlers yet: nothing happens
    const used = []; let bag = 0;
    ui.hud.onUse((k) => used.push(k)); ui.hud.onBag(() => bag++);
    ui.hud.update({ hp: 5, maxHp: 10, potions: 2, bombs: 0 });
    const [potion, bomb, bagBtn] = root.querySelectorAll(".belt .beltbtn");
    assert.equal(potion.querySelector("b").textContent, "2");
    assert.equal(potion.disabled, false); assert.equal(bomb.disabled, true);
    assert.equal(potion.getAttribute("aria-label"), "Health potion, 2 left");
    potion.click(); bagBtn.click();
    assert.deepEqual([used, bag], [["potions"], 1]);
    ui.hud.update({ hp: 5, maxHp: 10, potions: 2, bombs: 1 });
    assert.equal(bomb.disabled, false);
    ui.hud.update({ hp: 5, maxHp: 10 });
    assert.equal(potion.querySelector("b").textContent, "0");
  });
  it("the pause menu offers the inventory", () => {
    let opened = 0;
    ui.showPause({ onInventory: () => opened++ });
    btns("Inventory")[0].click();
    assert.equal(opened, 1);
  });
  it("lists equipped slots, the bag with Equip and Drop, consumables and stats, and reports each action", () => {
    const calls = [];
    ui.showInventory({
      equip: [{ slot: "weapon", slotName: "Weapon", item: item("iron-sword:rare") }, { slot: "armour", slotName: "Armour", item: null }, { slot: "trinket", slotName: "Trinket", item: null }],
      bag: [item("hawk-charm:common"), item("war-hammer:epic")], bagSize: 8,
      consumables: [{ ...G.CONSUMABLES.potions, count: 2 }, { ...G.CONSUMABLES.bombs, count: 0 }],
      stats: [["Max health", "100"], ["Damage", "15"]],
    }, { onEquip: (i) => calls.push(["equip", i]), onUnequip: (s) => calls.push(["unequip", s]), onDrop: (i) => calls.push(["drop", i]), onClose: () => calls.push(["close"]) });
    assert.deepEqual([...root.querySelectorAll(".eqslot .eqhead span:last-child")].map((e) => e.textContent), ["Weapon", "Armour", "Trinket"]);
    assert.equal(root.querySelector(".eqslot .gear.rare .gname").textContent, "Rare Iron Sword");
    assert.equal(root.querySelectorAll(".eqslot .gear.empty").length, 2);
    assert.deepEqual([...root.querySelectorAll(".baggrid .gname")].map((e) => e.textContent), ["Hawk Charm", "Epic War Hammer"]);
    assert.ok(root.querySelector(".baggrid .gear.epic .geffect").textContent.includes("damage"));
    assert.ok([...root.querySelectorAll("h3")].some((e) => e.textContent === "Bag (2 of 8)"));
    assert.deepEqual([...root.querySelectorAll(".consum span:nth-child(2)")].map((e) => e.textContent), ["Health potion x2", "Fire bomb x0"]);
    assert.equal(root.querySelectorAll(".inventory .stat").length, 2);
    btns("Unequip")[0].click(); btns("Equip")[1].click(); btns("Drop")[0].click(); btns("Close")[0].click();
    dom.window.document.body.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.deepEqual(calls, [["unequip", "weapon"], ["equip", 1], ["drop", 0], ["close"], ["close"]]);
  });
  it("an empty inventory says where gear comes from, and missing data shows an empty screen", () => {
    ui.showInventory({ equip: [], bag: [], bagSize: 8, consumables: [], stats: [] }, {});
    assert.ok(root.querySelector(".inventory p.muted").textContent.includes("Chests"));
    assert.equal(root.querySelector(".baggrid"), null);
    ui.showInventory();
    assert.ok([...root.querySelectorAll("h3")].some((e) => e.textContent === "Bag (0 of 0)"));
  });
});
