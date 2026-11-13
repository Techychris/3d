// Unit tests for src/engine/rig.js (shared biped rig and pose function) and the poses the game feeds its models.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { biped, fill, poseBiped, accents, STYLES, REST_POSE } from "../../src/engine/rig.js";
import { makeAsset, ASSETS } from "../../src/engine/assets.js";
import { makeWorld, step } from "./helpers.mjs";
import { createEnemy } from "../../src/game/enemies.js";
import { createBoss } from "../../src/game/bosses.js";
import { applyStatus } from "../../src/game/combat.js";

const SPEC = { leg: 0.4, torso: 0.3, arm: 0.3, shoulders: 0.2, hips: 0.1, limb: 0.05, depth: 0.7, shadow: 0.3 };
const make = () => biped(THREE, "dummy", { ...SPEC, mats: fill(new THREE.MeshStandardMaterial()) });
const angles = (rig) => ["hips", "chest", "head", "armL", "armR", "foreL", "foreR", "handL", "handR", "legL", "legR", "shinL", "shinR"]
  .map((n) => [rig[n].rotation.x, rig[n].rotation.y, rig[n].rotation.z, rig[n].position.y].map((v) => Math.round(v * 1e6)).join(",")).join("|");
const posed = (t, pose, style = STYLES.melee) => { const b = make(); poseBiped(b.group, t, pose, style); return b.rig; };

test("biped builds a named group with a shadow, a jointed skeleton and helpers to add gear", () => {
  const { group, rig, mesh, seg } = make();
  assert.equal(group.name, "dummy");
  assert.equal(group.children[0].name, "shadow");
  assert.equal(group.userData.rig, rig);
  assert.equal(rig.hips.parent, group); assert.equal(rig.chest.parent, rig.hips); assert.equal(rig.head.parent, rig.chest);
  for (const n of ["L", "R"]) {
    assert.equal(rig["leg" + n].parent, rig.hips); assert.equal(rig["shin" + n].parent, rig["leg" + n]);
    assert.equal(rig["arm" + n].parent, rig.chest); assert.equal(rig["fore" + n].parent, rig["arm" + n]); assert.equal(rig["hand" + n].parent, rig["fore" + n]);
  }
  assert.ok(rig.armR.position.x < 0 && rig.armL.position.x > 0, "the right hand is at -x");
  assert.equal(rig.baseY, SPEC.leg);
  const hat = mesh(rig.head, new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial(), "hat", 0, 0.2, 0);
  assert.equal(hat.parent, rig.head); assert.equal(hat.position.y, 0.2);
  assert.deepEqual(mesh(rig.head, new THREE.BoxGeometry(), hat.material, "dot").position.toArray(), [0, 0, 0]);
  const g = seg(0.5, 0.1, 0.05); g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox.max.y) < 1e-9 && Math.abs(g.boundingBox.min.y + 0.5) < 1e-9, "a segment hangs down from its pivot");
  assert.equal(seg(0.5, 0.1, 0.05, 8).parameters.radialSegments, 8);
});

test("poseBiped leaves a group without a rig alone, and a missing pose is the rest pose", () => {
  const bare = new THREE.Group();
  assert.doesNotThrow(() => poseBiped(bare, 1, { move: 1, act: "attack", k: 1 }, STYLES.melee));
  assert.equal(bare.children.length, 0);
  assert.equal(angles(posed(1.3, undefined)), angles(posed(1.3, REST_POSE)));
});

test("the pose is a pure function of time and pose, and an unknown act plays as idle", () => {
  const p = { move: 0.7, act: "windup", k: 0.4 };
  assert.equal(angles(posed(2.2, p)), angles(posed(2.2, p)));
  assert.notEqual(angles(posed(2.2, p)), angles(posed(2.3, p)));
  assert.equal(angles(posed(0.8, { move: 0, act: "juggle", k: 0.9 })), angles(posed(0.8, REST_POSE)));
});

test("a melee windup raises the weapon arm, the strike brings it down early and holds, and progress is clamped", () => {
  const rest = posed(0, REST_POSE), up = posed(0, { move: 0, act: "windup", k: 1 });
  assert.ok(up.armR.rotation.x < -2 && up.armR.rotation.x < rest.armR.rotation.x - 1.5, "arm goes overhead");
  assert.equal(angles(posed(0, { move: 0, act: "attack", k: 0 })), angles(up), "the strike starts where the windup ended");
  const struck = posed(0, { move: 0, act: "attack", k: 1 });
  assert.ok(struck.armR.rotation.x > -1 && struck.chest.rotation.x > 0.2, "arm down, body leaning in");
  assert.equal(angles(posed(0, { move: 0, act: "attack", k: 0.5 })), angles(struck), "the blow has landed by the halfway point");
  assert.equal(angles(posed(0, { move: 0, act: "windup", k: 7 })), angles(up));
  assert.equal(angles(posed(0, { move: 0, act: "windup", k: -3 })), angles(rest));
  assert.equal(angles(posed(0, { move: 0, act: "recover", k: 1 })), angles(rest), "recovery ends at rest");
});

test("walking swings the legs against each other, bends a knee and bobs the hips; standing keeps the legs still", () => {
  const t = Math.PI / 2 / STYLES.melee.stride; // sin(phase) = 1
  const w = posed(t, { move: 1, act: "idle", k: 0 }), s = posed(t, REST_POSE);
  assert.ok(w.legL.rotation.x > 0.5 && Math.abs(w.legL.rotation.x + w.legR.rotation.x) < 1e-9);
  assert.ok(w.hips.position.y > s.hips.position.y + 0.02);
  assert.equal(s.legL.rotation.x, 0); assert.equal(s.shinL.rotation.x, 0);
  const k = posed(0, { move: 1, act: "idle", k: 0 });
  assert.ok(k.shinL.rotation.x > 0.9 && k.shinR.rotation.x === 0, "one knee bends at a time");
});

test("every style has the four core acts with full key poses; the hero adds a shield bash and a tucked dodge", () => {
  for (const [name, S] of Object.entries(STYLES)) {
    for (const act of ["idle", "windup", "attack", "recover"]) {
      assert.equal(S.keys[act].length, 2, `${name}.${act}`);
      for (const kf of S.keys[act]) for (const f of ["aRx", "aLx", "fRx", "fLx", "wR", "wL", "cX", "cY", "hX", "lg", "sh", "hY"]) assert.equal(typeof kf[f], "number", `${name}.${act}.${f}`);
    }
    assert.equal(S.keys.windup[1], S.keys.attack[0]); assert.equal(S.keys.attack[1], S.keys.recover[0]); assert.equal(S.keys.recover[1], S.keys.idle[0]);
  }
  const bash = posed(0, { move: 0, act: "bash", k: 1 }, STYLES.hero), rest = posed(0, REST_POSE, STYLES.hero);
  assert.ok(bash.armL.rotation.x < rest.armL.rotation.x - 0.8, "shield arm punches forward");
  const dodge = posed(0, { move: 0, act: "dodge", k: 1 }, STYLES.hero);
  assert.ok(dodge.hips.position.y < rest.hips.position.y - 0.04 && dodge.shinL.rotation.x > 1, "tucked low with bent knees");
  assert.equal(STYLES.melee.keys.bash, undefined);
});

test("accents reads windup, strike and movement from a pose, and is all zero without one", () => {
  assert.deepEqual(accents(undefined), { wind: 0, hit: 0, move: 0 });
  assert.deepEqual(accents({ move: 0.5, act: "windup", k: 0.25 }), { wind: 0.25, hit: 0, move: 0.5 });
  assert.deepEqual(accents({ move: 0, act: "attack", k: 0.25 }), { wind: 0, hit: 0.75, move: 0 });
  assert.deepEqual(accents({ move: 1, act: "recover", k: 0.5 }), { wind: 0, hit: 0, move: 1 });
});

// ---- every model the game spawns reacts to its pose
const snap = (g) => { const out = []; g.traverse((o) => { out.push([...o.position.toArray(), o.rotation.x, o.rotation.y, o.rotation.z, ...o.scale.toArray()].map((v) => Math.round(v * 1e5)).join(",")); if (o.isMesh) for (const m of [].concat(o.material)) out.push(Math.round((m.emissiveIntensity || 0) * 1e4)); }); return out.join("|"); };
const POSED = ["hero-warrior", "enemy-skeleton", "enemy-skeleton-knight", "enemy-goblin-archer", "enemy-brute", "enemy-cultist", "boss-necromancer", "boss-golem",
  "enemy-slime", "boss-slime-king", "enemy-rat-swarm", "enemy-bat", "enemy-spider", "enemy-wisp", "enemy-mushroom", "enemy-scorpion", "enemy-imp", "enemy-totem", "enemy-ghost"];
for (const id of POSED) {
  test(`${id}: windup, strike and (where it walks) movement each change the model, and the pose is repeatable`, () => {
    const a = makeAsset(id);
    const at = (pose) => { a.update(1.37, pose); return snap(a.group); };
    const idle = at({ move: 0, act: "idle", k: 0 });
    assert.equal(at(undefined), idle, "no pose is the idle pose");
    const wind = at({ move: 0, act: "windup", k: 1 }), hit = at({ move: 0, act: "attack", k: 0.1 });
    assert.notEqual(wind, idle); assert.notEqual(hit, idle); assert.notEqual(hit, wind);
    assert.equal(at({ move: 0, act: "windup", k: 1 }), wind);
    assert.equal(at({ move: 0, act: "idle", k: 0 }), idle, "going back to idle leaves nothing behind");
    for (const act of ["recover", "bash", "dodge", "something-else"]) assert.doesNotThrow(() => at({ move: 1, act, k: 0.5 }));
  });
}
for (const id of ["enemy-skeleton", "enemy-cultist", "boss-necromancer", "boss-golem"]) {
  test(`${id}: update on a bare group does nothing`, () => {
    const bare = new THREE.Group();
    assert.doesNotThrow(() => ASSETS[id].update(bare, 1.5, { move: 1, act: "windup", k: 1 }));
    assert.equal(bare.children.length, 0);
  });
}

// ---- the game tells its models what to play
test("an enemy's model walks while it chases, plays the windup with rising progress, then the strike and the recovery", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.x = 0; w.player.z = 0;
  const e = createEnemy(w, "skeleton", 3, 0, { aggro: true });
  const seen = new Map(); let topK = 0;
  const legs = () => Math.abs(e.asset.group.userData.rig.legL.rotation.x);
  let walked = 0;
  step(w, 6, 1 / 60, () => {
    if (!seen.has(e.act)) seen.set(e.act, e.k);
    if (e.act === "windup") topK = Math.max(topK, e.k);
    if (e.act === "idle" && e.mv > 0.5) walked = Math.max(walked, legs());
    w.player.hp = w.player.maxHp; w.player.invuln = 0;
  });
  assert.deepEqual([...seen.keys()].sort(), ["attack", "idle", "recover", "windup"]);
  assert.ok(topK > 0.9, "windup progress climbs to 1");
  assert.ok(walked > 0.3, "legs swing while it closes in");
  assert.ok(e.k >= 0 && e.k <= 1);
});

test("a standing enemy's model stops walking", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.x = 0; w.player.z = 0;
  const e = createEnemy(w, "totem", 2, 0, { aggro: true });
  step(w, 1);
  assert.equal(e.mv, 0);
});

test("a boss's model idles between attacks, winds up for the first 60% of an attack and strikes for the rest", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.x = 0; w.player.z = 3;
  const b = createBoss(w, "stone-golem", 0, 0);
  assert.equal(b.act, "idle");
  const acts = [];
  step(w, 6, 1 / 60, () => { if (acts[acts.length - 1] !== b.act) acts.push(b.act); w.player.hp = w.player.maxHp; assert.ok(b.k >= 0 && b.k <= 1); });
  assert.deepEqual(acts.slice(0, 3), ["idle", "windup", "attack"]);
  assert.ok(acts.indexOf("idle", 3) > 0, "it idles again once the attack is over");
  // interrupted mid-attack: back to idle
  b.gap = 0; step(w, 0.2);
  assert.equal(b.state, "attack");
  applyStatus(w, b, { stun: 1 }); step(w, 1 / 60);
  assert.equal(b.act, "idle");
});

test("the hero's model walks, swings, bashes and tucks into the dodge as the player does", async () => {
  const { createPlayer } = await import("../../src/game/player.js");
  const w = makeWorld(); w.rng = () => 0.99;
  const p = createPlayer(w, "hero-warrior"); w.player = p;
  let rig = null; p.group.traverse((o) => { if (o.userData.rig) rig = o.userData.rig; });
  const run = (sec, input) => { for (let t = 0; t < sec; t += 1 / 60) { w.dt = 1 / 60; w.time += 1 / 60; p.update(w, 1 / 60, input); } };
  run(0.1, {});
  const restArm = rig.armR.rotation.x, restShield = rig.armL.rotation.x, restHips = rig.hips.position.y;
  let swing = 0; for (let i = 0; i < 40; i++) { run(1 / 60, { move: { x: 1, y: 0 } }); swing = Math.max(swing, Math.abs(rig.legL.rotation.x)); }
  assert.ok(swing > 0.4, "legs swing while walking");
  run(0.5, {});
  let top = 0; run(1 / 60, { attack: true }); for (let i = 0; i < 12; i++) { run(1 / 60, {}); top = Math.min(top, rig.armR.rotation.x); }
  assert.ok(top < restArm - 1, "the sword arm goes up and over during a swing");
  run(1, {});
  let punch = 0; run(1 / 60, { skill: true }); for (let i = 0; i < 12; i++) { run(1 / 60, {}); punch = Math.min(punch, rig.armL.rotation.x); }
  assert.ok(punch < restShield - 0.5, "the shield arm punches out on a bash");
  run(1, {});
  run(2 / 60, { dodge: true });
  assert.ok(rig.hips.position.y < restHips - 0.04, "tucked low during the dodge");
  run(1, {});
  assert.ok(Math.abs(rig.hips.position.y - restHips) < 0.02, "back on its feet afterwards");
});
