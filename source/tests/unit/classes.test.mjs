// Unit tests for character classes: data, stats, saves, the player's class attacks and skills, the hero models, the camp picker.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeWorld, installDom } from "./helpers.mjs";
import { CLASSES, CLASS_IDS, classOf } from "../../src/game/classes.js";
import { ASSETS, makeAsset } from "../../src/engine/assets.js";
import { createPlayer, SKILLS } from "../../src/game/player.js";
import { createEnemy } from "../../src/game/enemies.js";
import { spawnProjectile } from "../../src/game/combat.js";
import { computeStats, BASE_STATS } from "../../src/game/items.js";
import * as P from "../../src/game/progress.js";

describe("class data", () => {
  it("has four classes, each with a model, a skill, a blurb and stat changes; shooters define their shot", () => {
    assert.deepEqual(CLASS_IDS, ["warrior", "rogue", "ranger", "mage"]);
    for (const id of CLASS_IDS) {
      const c = CLASSES[id];
      assert.equal(c.id, id);
      assert.ok(ASSETS[c.hero], `${id} model`);
      assert.ok(SKILLS[c.skill], `${id} skill`);
      assert.ok(c.name && c.blurb.length > 20 && c.skillName && c.icon);
      assert.equal(typeof c.mods, "object");
      assert.ok(["melee", "shot"].includes(c.attack));
      assert.equal(!!c.shot, c.attack === "shot");
    }
  });
  it("classOf falls back to the warrior for an unknown id", () => {
    assert.equal(classOf("mage"), CLASSES.mage);
    assert.equal(classOf("bard"), CLASSES.warrior);
    assert.equal(classOf(undefined), CLASSES.warrior);
  });
});

describe("class stats and saves", () => {
  it("computeStats adds extra mods on top of the base, including stats the base does not have, and keeps sane floors", () => {
    const s = computeStats([], {}, [CLASSES.rogue.mods, { luck: 2 }]);
    assert.equal(s.maxHp, BASE_STATS.maxHp - 20);
    assert.ok(Math.abs(s.attackRate - (BASE_STATS.attackRate + 0.9)) < 1e-9);
    assert.equal(s.luck, 2);
    const low = computeStats([], {}, [{ maxHp: -500, attackRate: -50, damage: -99 }]);
    assert.deepEqual([low.maxHp, low.attackRate, low.damage], [20, 0.6, 1]);
    assert.equal(computeStats([], {}).maxHp, BASE_STATS.maxHp);
  });
  it("a new run records its class and model; saves with an unknown class read back as warrior", () => {
    const r = P.newRun("s", "mage");
    assert.deepEqual([r.cls, r.hero], ["mage", "hero-mage"]);
    assert.deepEqual([P.newRun("s", "bard").cls, P.newRun("s").cls], ["warrior", "warrior"]);
    P.saveRun({ ...r, cls: "bard" }); assert.equal(P.loadRun().cls, "warrior");
    P.saveRun(r); assert.equal(P.loadRun().cls, "mage");
    P.resetProgress();
    assert.equal(P.normalizeMeta({ cls: "ranger" }).cls, "ranger");
    assert.equal(P.normalizeMeta({ cls: 7 }).cls, "warrior");
  });
});

const setup = (id, rng = 0.99) => {
  const world = makeWorld(); world.rng = Object.assign(() => rng, { int: (a) => a });
  world.stats = computeStats([], {}, [CLASSES[id].mods]);
  const p = createPlayer(world, CLASSES[id].hero, CLASSES[id]); world.player = p;
  const run = (sec, input = {}) => { for (let t = 0; t < sec - 1e-9; t += 1 / 60) { world.dt = 1 / 60; world.time += 1 / 60; p.update(world, 1 / 60, input); } };
  return { world, p, run };
};
const foe = (world, x, z) => { const e = createEnemy(world, "brute", x, z); e.brain = null; return e; };
const mine = (world) => world.projectiles.filter((q) => !q.hostile);

describe("class attacks", () => {
  it("the ranger's attack looses one friendly arrow ahead and does no melee damage", () => {
    const { world, p, run } = setup("ranger");
    const e = foe(world, 0, 0.8), hp = e.hp;
    run(1 / 60, { attack: true }); run(0.2);
    const shots = mine(world);
    assert.equal(shots.length, 1);
    assert.equal(shots[0].sourceName, "You");
    assert.ok(Math.abs(shots[0].damage - world.stats.damage) < 1e-9);
    assert.ok(shots[0].z > p.z, "it starts in front of the hero, who faces +z");
    assert.equal(shots[0].range, CLASSES.ranger.shot.range);
    assert.equal(e.hp, hp, "the arrow has not landed yet and there is no sword arc");
    const fx = world.root.children.find((c) => c.name === "player-fx");
    assert.equal(fx.children[0].visible, false, "no slash wedge for a shooter");
  });
  it("a critical shot carries the crit multiplier", () => {
    const { world, run } = setup("mage", 0);
    run(1 / 60, { attack: true }); run(0.4);
    assert.ok(Math.abs(mine(world)[0].damage - world.stats.damage * world.stats.critMult) < 1e-9);
  });
  it("the warrior still swings a visible arc", () => {
    const { world, run } = setup("warrior");
    run(1 / 60, { attack: true }); run(2 / 60);
    assert.equal(world.root.children.find((c) => c.name === "player-fx").children[0].visible, true);
    assert.equal(mine(world).length, 0);
  });
});

describe("class skills", () => {
  it("each class reports its own skill cooldown", () => {
    for (const id of CLASS_IDS) assert.equal(setup(id).p.skillMax, SKILLS[CLASSES[id].skill].cd);
  });
  it("Volley fires five arrows in a fan at 80% damage and hits nothing directly", () => {
    const { world, p, run } = setup("ranger");
    const e = foe(world, 0, 1), hp = e.hp;
    run(1 / 60, { skill: true });
    const shots = mine(world);
    assert.equal(shots.length, 5);
    assert.ok(shots.every((s) => Math.abs(s.damage - world.stats.damage * 0.8) < 1e-9));
    assert.equal(new Set(shots.map((s) => s.x.toFixed(3))).size, 5, "five different directions");
    assert.equal(e.hp, hp);
    assert.equal(p.skillCd > 5.9, true);
  });
  it("Flurry cuts foes all around, grants a moment of invulnerability, and leaves enemy shots alone", () => {
    const { world, p, run } = setup("rogue");
    const front = foe(world, 0, 1.2), back = foe(world, 0, -1.2), far = foe(world, 4, 0);
    const shot = spawnProjectile(world, { x: 0.5, z: 0, y: 0.6, dirX: 1, dirZ: 0, speed: 0, damage: 1, hostile: true });
    run(1 / 60, { skill: true });
    assert.ok(front.hp < front.maxHp && back.hp < back.maxHp, "both sides are hit");
    assert.equal(far.hp, far.maxHp);
    assert.ok(p.invuln > 0.3);
    assert.equal(shot.dead, false);
    assert.equal(front.status.stunT, 0);
    assert.equal(front.z, 1.2, "no knock-back");
  });
  it("Nova freezes and hurts everything close and wipes enemy shots in range", () => {
    const { world, run } = setup("mage");
    const near = foe(world, -2, 0), far = foe(world, 5, 0);
    const shot = spawnProjectile(world, { x: 0, z: -1, y: 0.6, dirX: 1, dirZ: 0, speed: 0, damage: 1, hostile: true });
    run(1 / 60, { skill: true });
    assert.ok(near.hp < near.maxHp && near.status.frozenT > 1);
    assert.equal(far.hp, far.maxHp);
    assert.equal(shot.dead, true);
  });
});

describe("hero models", () => {
  const snap = (g) => { const out = []; g.traverse((o) => out.push([...o.position.toArray(), o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x].map((v) => Math.round(v * 1e5)).join(","))); return out.join("|"); };
  for (const id of ["hero-rogue", "hero-ranger", "hero-mage"]) {
    it(`${id}: attack, skill and dodge each pose the model differently`, () => {
      const a = makeAsset(id), at = (pose) => { a.update(0.9, pose); return snap(a.group); };
      const poses = [undefined, { move: 0, act: "windup", k: 1 }, { move: 0, act: "attack", k: 1 }, { move: 0, act: "bash", k: 1 }, { move: 0, act: "dodge", k: 1 }, { move: 1, act: "idle", k: 0 }].map(at);
      assert.equal(new Set(poses).size, poses.length);
      assert.equal(at({ move: 0, act: "idle", k: 0 }), poses[0]);
    });
  }
  it("the mage's orb flares while casting and settles when idle or dodging", () => {
    const a = makeAsset("hero-mage"), glow = (pose) => { a.update(0.5, pose); return a.group.userData.orbMat.emissiveIntensity; };
    const idle = glow(undefined);
    assert.equal(glow({ move: 0, act: "idle", k: 0 }), idle);
    assert.equal(glow({ move: 0, act: "dodge", k: 1 }), idle);
    assert.ok(glow({ move: 0, act: "attack", k: 0.5 }) > idle + 0.5);
  });
});

describe("camp class picker", () => {
  let dom, createUI, root, ui;
  before(async () => { dom = await installDom(); ({ createUI } = await import("../../src/ui/ui.js")); root = dom.window.document.createElement("div"); dom.window.document.body.append(root); ui = createUI(root); });
  after(() => { ui.hideAll(); dom.cleanup(); });
  const classes = CLASS_IDS.map((id) => CLASSES[id]);
  const btn = (name) => [...root.querySelectorAll("button")].find((b) => b.textContent === name);

  it("shows the four classes, marks the chosen one, shows its blurb and reports a pick", () => {
    const picked = [];
    ui.showHub({}, { classes, classId: "ranger", onClass: (id) => picked.push(id) });
    assert.deepEqual([...root.querySelectorAll("button.cls")].map((b) => b.textContent), ["Warrior", "Rogue", "Ranger", "Mage"]);
    assert.equal(btn("Ranger").getAttribute("aria-pressed"), "true");
    assert.equal(btn("Mage").getAttribute("aria-pressed"), "false");
    assert.ok(btn("Ranger").classList.contains("on") && !btn("Mage").classList.contains("on"));
    assert.equal(root.querySelector(".clsblurb").textContent, CLASSES.ranger.blurb);
    btn("Mage").click();
    assert.deepEqual(picked, ["mage"]);
    assert.ok(btn("Start run") && !btn("Resume run") && !btn("New run"));
    assert.equal(btn("Mage").disabled, false);
  });
  it("with a saved run it offers Resume and New run and locks the other classes", () => {
    const calls = [];
    ui.showHub({}, { classes, classId: "mage", resumable: true, onStart: () => calls.push("start"), onNew: () => calls.push("new") });
    assert.ok(!btn("Start run"));
    btn("Resume run").click(); btn("New run").click();
    assert.deepEqual(calls, ["start", "new"]);
    assert.equal(btn("Warrior").disabled, true);
    assert.equal(btn("Mage").disabled, false);
  });
  it("without class data the picker is empty and the blurb blank", () => {
    ui.showHub({}, {});
    assert.equal(root.querySelectorAll("button.cls").length, 0);
    assert.equal(root.querySelector(".clsblurb").textContent, "");
  });
});
