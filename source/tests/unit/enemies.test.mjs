// Unit tests for src/game/enemies.js: the shared actor kit and every regular enemy type.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeWorld, spy, step } from "./helpers.mjs";
import {
  ENEMY_TYPES, createEnemy, createActor, angDiff, turn, walk, lerp, say, tele,
  killTelegraphs, shoot, aimLine, clampInside,
} from "../../src/game/enemies.js";
import { damageEnemy, applyStatus } from "../../src/game/combat.js";

const DT = 1 / 60;
const TYPES = Object.keys(ENEMY_TYPES);
const APPROACH = ["skeleton", "slime", "slimeling", "rats", "brute", "spider", "ghost", "knight", "mushroom"];
const KEEP_DISTANCE = ["archer", "wisp", "cultist"];
// every type, slimeling included, winds up against a stationary player
const WINDUP_TYPES = TYPES;

const frame = (w, n = 1) => { for (let i = 0; i < n; i++) step(w, DT); };
function until(w, pred, max = 8) {
  for (let t = 0; t < max; t += DT) { if (pred()) return true; frame(w); }
  return pred();
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------------------------------------------------------------- helper exports
test("angDiff returns the shortest signed turn, wrapping across the pi seam", () => {
  assert.equal(angDiff(0, 0), 0);
  assert.ok(Math.abs(angDiff(Math.PI / 2, 0) - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(angDiff(0, Math.PI / 2) + Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(angDiff(3.0, -3.0) - (6.0 - 2 * Math.PI)) < 1e-12);
});

test("turn steps yaw toward the target by at most maxStep and lands on it when in reach", () => {
  const e = { yaw: 0 };
  turn(e, 1, 0.25);
  assert.equal(e.yaw, 0.25);
  turn(e, 1, 5);
  assert.equal(e.yaw, 1);
  turn(e, -1, 0.5);
  assert.equal(e.yaw, 0.5);
});

test("walk moves along the heading scaled by speed, speedMul and dt", () => {
  const e = { x: 0, z: 0, speed: 2, speedMul: 0.5 };
  walk(e, 1, 0, 2, 0.5);
  assert.deepEqual([e.x, e.z], [0.5, 0]);
  e.speedMul = 0;
  walk(e, 0, 1, 2, 1);
  assert.equal(e.z, 0);
});

test("lerp interpolates linearly between a and b", () => {
  assert.equal(lerp(2, 10, 0.25), 4);
  assert.equal(lerp(2, 10, 0), 2);
});

test("say plays a named sound only when audio with play() exists", () => {
  const w = makeWorld();
  say(w, "slam");
  assert.deepEqual(w.audio.play.calls, [["slam"]]);
  w.audio = null;
  assert.doesNotThrow(() => say(w, "slam"));
  w.audio = {};
  assert.doesNotThrow(() => say(w, "slam"));
});

test("tele spawns a telegraph owned by the actor, defaulting source and damage from it", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createEnemy(w, "skeleton", -3, 0);
  const t = tele(e, w, { shape: "circle", x: 1, z: 1, radius: 1, windup: 0.6 });
  assert.equal(t.sourceName, e.name);
  assert.equal(t.damage, e.damage);
  assert.ok(e.tels.includes(t));
  assert.ok(w.telegraphs.includes(t));
  const t2 = tele(e, w, { shape: "circle", x: 1, z: 1, windup: 0.6, damage: 3, sourceName: "Custom" });
  assert.equal(t2.damage, 3);
  assert.equal(t2.sourceName, "Custom");
});

test("tele drops finished telegraphs from the actor list once it holds more than eight", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createEnemy(w, "skeleton", -3, 0);
  const alive = [{ dead: false }, { dead: false }];
  e.tels = [...Array.from({ length: 7 }, () => ({ dead: true })), ...alive];
  const t = tele(e, w, { shape: "circle", x: 1, z: 1, windup: 0.6 });
  assert.deepEqual(e.tels, [...alive, t]);
});

test("killTelegraphs cancels real telegraphs and marks plain entries dead", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createEnemy(w, "skeleton", -3, 0);
  const t = tele(e, w, { shape: "circle", x: 1, z: 1, windup: 0.6 });
  const plain = { dead: false };
  e.tels.push(plain);
  killTelegraphs(e);
  assert.equal(t.dead, true);
  assert.equal(plain.dead, true);
  assert.equal(e.tels.length, 0);
});

test("shoot fires a hostile projectile from the actor along the given yaw, with defaults", () => {
  const w = makeWorld({ withPlayer: true });
  const e = { x: 1, z: 1, name: "Foe", damage: 6 };
  const p = shoot(e, w, 0, {});
  assert.equal(p.hostile, true);
  assert.equal(p.kind, "orb");
  assert.equal(p.damage, 6);
  assert.equal(p.speed, 5);
  assert.equal(p.range, 12);
  assert.equal(p.radius, 0.2);
  assert.equal(p.y, 0.7);
  assert.equal(p.sourceName, "Foe");
  assert.ok(Math.abs(p.x - 1) < 1e-12 && Math.abs(p.z - 1.4) < 1e-12);
  assert.ok(w.projectiles.includes(p));
});

test("shoot honours explicit options, including a zero offset and zero damage", () => {
  const w = makeWorld({ withPlayer: true });
  const e = { x: 1, z: 1, name: "Foe", damage: 6 };
  const q = shoot(e, w, Math.PI / 2, { off: 0, y: 1.2, speed: 9, damage: 0, radius: 0.5, kind: "arrow", range: 4 });
  assert.ok(Math.abs(q.x - 1) < 1e-12 && Math.abs(q.z - 1) < 1e-12);
  assert.equal(q.damage, 0);
  assert.equal(q.speed, 9);
  assert.equal(q.range, 4);
  assert.equal(q.kind, "arrow");
  assert.equal(q.y, 1.2);
  assert.ok(Math.abs(q.dirX - 1) < 1e-12);
});

test("aimLine draws a harmless line telegraph, with default and explicit geometry", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createEnemy(w, "skeleton", -3, 0);
  const t = aimLine(e, w, 0.5, 0.7);
  assert.equal(t.shape, "line");
  assert.equal(t.damage, 0);
  assert.equal(t.windup, 0.7);
  assert.equal(t.length, 8);
  assert.equal(t.width, 0.3);
  assert.equal(t.angle, 0.5);
  assert.equal(t.x, e.x);
  assert.equal(t.z, e.z);
  const u = aimLine(e, w, 0, 0.9, 5, 0.6, 2, 3);
  assert.equal(u.length, 5);
  assert.equal(u.width, 0.6);
  assert.equal(u.x, 2);
  assert.equal(u.z, 3);
});

test("clampInside writes into out, keeps the room bounds, and pushes out of obstacles", () => {
  const w = makeWorld();
  const out = {};
  assert.equal(clampInside(w, 0.5, 0.5, 0.3, out), out);
  assert.equal(out.x, 0.5);
  assert.equal(out.z, 0.5);
  clampInside(w, 50, -50, 0.3, out);
  assert.ok(out.x <= w.bounds.maxX && out.x >= w.bounds.minX);
  assert.ok(out.z <= w.bounds.maxZ && out.z >= w.bounds.minZ);
  w.obstacles.push({ x: 0, z: 0, r: 1 });
  clampInside(w, 0.2, 0, 0.3, out);
  assert.ok(Math.hypot(out.x, out.z) >= 1.3 - 1e-9);
  clampInside(w, 0, 0, 0.3, out);
  assert.ok(Math.hypot(out.x, out.z) >= 1.3 - 1e-9);
});

// ---------------------------------------------------------------- actor kit
test("createActor builds a bare actor with defaults and registers it with the world", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createActor(w, { type: "dummy", name: "Dummy", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 2, x: 1, z: 1 });
  assert.equal(e.hp, 5);
  assert.equal(e.maxHp, 5);
  assert.equal(e.tip, "");
  assert.equal(e.boss, false);
  assert.equal(e.drop, 0);
  assert.equal(e.yaw, 0);
  assert.equal(e.baseScale, 1);
  assert.equal(e.brain, null);
  assert.equal(e.def, null);
  assert.equal(e.state, "idle");
  assert.equal(e.dead, false);
  assert.ok(w.enemies.includes(e));
  assert.ok(w.root.children.includes(e.group));
  assert.equal(e.group.position.x, 1);
  const f = createActor(w, { type: "dummy", name: "Dummy", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 2, x: 1, z: 1, tip: "Watch out", boss: 1, drop: 7, yaw: 1.2, scale: 2 });
  assert.equal(f.tip, "Watch out");
  assert.equal(f.boss, true);
  assert.equal(f.drop, 7);
  assert.equal(f.yaw, 1.2);
  assert.equal(f.baseScale, 2);
  assert.equal(f.group.scale.x, 2);
});

test("a bare actor killed by damage never pays out, since step() skips dead actors", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createActor(w, { type: "dummy", name: "Dummy", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 2, x: 2, z: 0, drop: 4 });
  const drops = [];
  w.events.on("currency", (p) => drops.push(p.amount));
  damageEnemy(w, e, 10);
  frame(w, 2);
  assert.equal(e.dead, true);
  assert.deepEqual(drops, []);
});

test("the death listener ignores events with no enemy, a foreign enemy, or a brainless one", () => {
  const w = makeWorld();
  const other = makeWorld();
  const e = createActor(w, { type: "dummy", name: "Dummy", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 2, x: 1, z: 1, drop: 3 });
  const got = spy();
  w.events.on("currency", got);
  w.events.emit("enemy:death");
  w.events.emit("enemy:death", { enemy: { world: other, brain: () => {} } });
  w.events.emit("enemy:death", { enemy: e });
  assert.equal(got.calls.length, 0);
  assert.equal(e._done, false);
});

test("a bare actor is pushed out of an overlapping actor, and of the player", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.x = 0; w.player.z = 0;
  const a = createActor(w, { type: "dummy", name: "A", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 0.1, z: 0 });
  const b = createActor(w, { type: "dummy", name: "B", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: -2, z: 2 });
  frame(w);
  assert.ok(dist(a, { x: -2, z: 2 }) > 0);
  const c = createActor(w, { type: "dummy", name: "C", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 3, z: 3 });
  c.x = 0.1; c.z = 0;
  frame(w);
  assert.ok(Math.abs(Math.hypot(c.x, c.z) - 0.54) < 1e-9, "pushed out to radius + 0.8 * player radius");
  assert.ok(Number.isFinite(b.x));
});

test("separation pushes two overlapping actors apart, and ignores dead or noSep neighbours", () => {
  const w = makeWorld();
  const a = createActor(w, { type: "dummy", name: "A", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 0, z: 0 });
  const b = createActor(w, { type: "dummy", name: "B", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 0.1, z: 0 });
  frame(w);
  assert.ok(dist(a, b) > 0.1);

  const w2 = makeWorld();
  const p = createActor(w2, { type: "dummy", name: "P", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 0, z: 0 });
  const q = createActor(w2, { type: "dummy", name: "Q", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 0.1, z: 0 });
  q.noSep = true;
  const r = createActor(w2, { type: "dummy", name: "R", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 0, z: 0.1 });
  r.dead = true;
  frame(w2);
  assert.equal(p.x, 0);
  assert.equal(p.z, 0);
  assert.equal(q.x, 0.1);
});

test("an actor sitting exactly on a dead player or on another actor is not thrown around", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.dead = true;
  const a = createActor(w, { type: "dummy", name: "A", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 0.1, z: 0 });
  frame(w);
  assert.equal(a.x, 0.1);
});

test("finish runs even without fx, and only drops when the actor carries a drop value", () => {
  const w = makeWorld({ withPlayer: true });
  w.fx = null;
  const e = createActor(w, { type: "dummy", name: "A", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 2, z: 2 });
  const drops = [];
  w.events.on("currency", (p) => drops.push(p.amount));
  e.hp = 0;
  frame(w);
  assert.equal(e.dead, true);
  assert.deepEqual(drops, []);
});

test("finish calls the def die hook and onDeath callback exactly once", () => {
  const w = makeWorld();
  const e = createActor(w, { type: "dummy", name: "A", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 2, z: 2 });
  e.def = { die: spy() };
  e.onDeath = spy();
  e.hp = 0;
  frame(w, 3);
  assert.equal(e.def.die.calls.length, 1);
  assert.equal(e.onDeath.calls.length, 1);
});

test("dispose removes the actor's group, cancels its telegraphs and frees array materials", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createEnemy(w, "skeleton", -3, 0);
  e.group.add(new THREE.Group());
  e.group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]));
  const t = tele(e, w, { shape: "circle", x: 1, z: 1, windup: 0.6 });
  e.dispose(w);
  assert.equal(e.group.parent, null);
  assert.equal(t.dead, true);
  assert.equal(e.tels.length, 0);
});

// ---------------------------------------------------------------- createEnemy
test("createEnemy rejects unknown types and builds guards and yaw from the player", () => {
  const w = makeWorld();
  assert.throws(() => createEnemy(w, "dragon", 0, 0), /unknown enemy type/);
  const s = createEnemy(w, "skeleton", 1, 1);
  assert.equal(s.yaw, 0);
  assert.equal(s.guard, false);
  assert.equal(Object.getOwnPropertyDescriptor(s, "hp").value, 30);
  const w2 = makeWorld({ withPlayer: true });
  w2.player.x = 0; w2.player.z = 0;
  const k = createEnemy(w2, "knight", 0, -2);
  assert.equal(k.guard, true);
  assert.ok(Object.getOwnPropertyDescriptor(k, "hp").get, "knight hp is an accessor");
  assert.equal(k.yaw, 0, "faces the player, which is at +z");
});

test("createEnemy with aggro starts in the aggro state with a short first cooldown", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createEnemy(w, "rats", -2, 0, { aggro: true });
  assert.equal(e.state, "aggro");
  assert.ok(e.cd >= 0.9 && e.cd <= 1.3);
});

test("slimeling drops exactly one currency; other types drop between two and four", () => {
  const w = makeWorld();
  assert.equal(createEnemy(w, "slimeling", 0, 0).drop, 1);
  const d = createEnemy(w, "rats", 0, 0).drop;
  assert.ok(d >= 2 && d <= 4);
});

// ---------------------------------------------------------------- per-type behaviour
for (const type of TYPES) {
  test(`${type}: idles while far and unhurt, and wakes when the player comes close`, () => {
    const w = makeWorld({ withPlayer: true });
    w.player.x = -3.5;
    const e = createEnemy(w, type, 1.7, 0);
    frame(w, 30);
    assert.equal(e.state, "idle");
    assert.equal(e.x, 1.7);
    assert.equal(w.telegraphs.length, 0);
    w.player.x = 0;
    frame(w);
    assert.equal(e.state, "aggro");
  });

  test(`${type}: wakes from afar once it has been hurt`, () => {
    const w = makeWorld({ withPlayer: true });
    w.player.x = -3.5;
    const e = createEnemy(w, type, 1.7, 0);
    e.hp -= 1;
    frame(w);
    assert.equal(e.state, "aggro");
  });

  test(`${type}: does nothing while the player is dead`, () => {
    const w = makeWorld({ withPlayer: true });
    w.player.dead = true;
    const e = createEnemy(w, type, -1, 0, { aggro: true });
    frame(w, 30);
    assert.equal(e.state, "aggro");
    assert.equal(e.x, -1);
    assert.equal(w.telegraphs.length, 0);
  });

  if (WINDUP_TYPES.includes(type)) test(`${type}: shows a telegraph before every hit, with windup of at least 0.3 s`, () => {
    const w = makeWorld({ withPlayer: true });
    createEnemy(w, type, -2.5, 0, { aggro: true });
    const seen = new Set();
    let hurtFirst = false;
    until(w, () => {
      for (const t of w.telegraphs) seen.add(t);
      if (w.player.hp < 100 && seen.size === 0) hurtFirst = true;
      return w.player.hp < 100;
    }, 6);
    assert.ok(seen.size > 0, "no telegraph was shown");
    assert.equal(hurtFirst, false, "took damage before any telegraph");
    assert.ok(w.player.hp < 100, "a stationary player should be hit within 6 s");
    for (const t of seen) assert.ok(t.windup >= 0.3, `windup ${t.windup} < 0.3`);
  });

  if (WINDUP_TYPES.includes(type)) for (const status of [{ stun: 1 }, { freeze: 1 }]) {
    const label = Object.keys(status)[0];
    test(`${type}: a ${label} during its windup cancels the attack`, () => {
      const w = makeWorld({ withPlayer: true });
      const e = createEnemy(w, type, -2.5, 0, { aggro: true });
      assert.ok(until(w, () => e.state === "windup", 8), "never started a windup");
      applyStatus(w, e, status);
      frame(w);
      assert.equal(e.state, "recover");
      assert.equal(e.tels.length, 0);
      assert.ok(w.telegraphs.every((t) => t.dead));
      const hp = w.player.hp;
      frame(w, 40);
      assert.equal(w.player.hp, hp);
    });
  }

  if (WINDUP_TYPES.includes(type)) test(`${type}: frozen while recovering, it stays put until the freeze wears off`, () => {
    const w = makeWorld({ withPlayer: true });
    const e = createEnemy(w, type, -2.5, 0, { aggro: true });
    assert.ok(until(w, () => e.state === "windup", 8));
    applyStatus(w, e, { stun: 0.1 });
    frame(w);
    assert.equal(e.state, "recover");
    applyStatus(w, e, { freeze: 2 });
    frame(w, 90);
    assert.equal(e.state, "recover");
    frame(w, 150);
    assert.notEqual(e.state, "recover");
  });

  test(`${type}: drops currency exactly once on death`, () => {
    const w = makeWorld({ withPlayer: true });
    const e = createEnemy(w, type, 2, 0);
    const drops = [];
    w.events.on("currency", (p) => drops.push(p.amount));
    damageEnemy(w, e, 1000);
    frame(w, 2);
    assert.equal(e.dead, true);
    assert.deepEqual(drops, [e.drop]);
    if (type === "slimeling") assert.equal(e.drop, 1);
    else assert.ok(e.drop >= 2 && e.drop <= 4);
  });

  test(`${type}: runs with no fx or audio hooks`, () => {
    const w = makeWorld({ withPlayer: true });
    w.fx = null;
    w.audio = null;
    createEnemy(w, type, -2.5, 0, { aggro: true });
    assert.doesNotThrow(() => frame(w, 240));
  });
}

for (const type of APPROACH) {
  test(`${type}: closes in on a player it has noticed`, () => {
    const w = makeWorld({ withPlayer: true });
    const e = createEnemy(w, type, -4, 0, { aggro: true });
    const d0 = dist(e, w.player);
    frame(w, 30);
    assert.ok(dist(e, w.player) < d0, `${type} did not close in`);
  });
}

for (const type of KEEP_DISTANCE) {
  test(`${type}: backs off when the player gets too close`, () => {
    const w = makeWorld({ withPlayer: true });
    const e = createEnemy(w, type, -2, 0, { aggro: true });
    frame(w, 30);
    assert.ok(dist(e, w.player) > 2);
  });
}

test("slimeling attacks a stationary player: it stops just outside hop range (> 0.9) and telegraphs a hop", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createEnemy(w, "slimeling", -2.5, 0, { aggro: true });
  let telegraphed = false;
  for (let i = 0; i < 480 && !telegraphed; i++) { frame(w); if (w.telegraphs.length) telegraphed = true; }
  assert.ok(telegraphed, "slimeling should telegraph a hop at a stationary player");
  assert.ok(dist(e, w.player) > 0.9, `stopped at ${dist(e, w.player)}`);
});

// ---------------------------------------------------------------- type-specific behaviour
test("skeleton: an attack with no hold time set falls back to 0.12 s", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createEnemy(w, "skeleton", -1.2, 0, { aggro: true });
  e.def = { ...e.def, hold: undefined };
  assert.ok(until(w, () => e.state === "attack", 4));
  let n = 0;
  while (e.state === "attack" && n < 100) { frame(w); n++; }
  assert.equal(n, 8);
});

test("knight guard: frontal hits are cut to 25%, hits from behind are not", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.z = 2;
  const k = createEnemy(w, "knight", 0, 0);
  assert.equal(k.yaw, 0);
  damageEnemy(w, k, 10);
  assert.equal(k.hp, 52.5);
  assert.ok(w.fx.burst.calls.some((c) => c[3] === 0xa9a7c4), "guard should spark");
  k.yaw = Math.PI;
  damageEnemy(w, k, 10);
  assert.equal(k.hp, 42.5);
});

test("knight guard: no reduction when healing, dead, without a player, or with the guard down", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.z = 2;
  const p = w.player;
  const k = createEnemy(w, "knight", 0, 0);
  k.hp = 60;
  assert.equal(k.hp, 60, "raising hp is not reduced");
  k.hp = 50;
  assert.equal(k.hp, 57.5, "frontal drop is reduced");
  k.guard = false;
  k.hp = 40;
  assert.equal(k.hp, 40, "guard down: full damage");
  k.guard = true;
  k.dead = true;
  k.hp = 10;
  assert.equal(k.hp, 10, "a dead knight is not reduced");
  k.dead = false;
  w.player = null;
  k.hp = 5;
  assert.equal(k.hp, 5, "no player: no facing, no reduction");
  w.player = p;
  w.fx = null;
  k.hp = 4;
  assert.equal(k.hp, 4.75, "reduction still applies with no fx");
});

test("knight: charges a distant player along a long red line, bashes a close one in a cone", () => {
  const w = makeWorld({ withPlayer: true });
  const k = createEnemy(w, "knight", -3, 0, { aggro: true });
  k.cd = 0;
  assert.ok(until(w, () => k.state === "windup", 2));
  assert.equal(k.mode, "charge");
  const line = k.tels[0];
  assert.equal(line.shape, "line");
  assert.equal(line.length, 5.5);
  assert.equal(line.damage, 14);
  assert.ok(until(w, () => k.state === "attack", 3));
  assert.ok(Math.abs(k.x - 2.5) < 0.05, `charged to ${k.x}`);
  assert.equal(w.player.hp, 86);

  const w2 = makeWorld({ withPlayer: true });
  const b = createEnemy(w2, "knight", -1.2, 0, { aggro: true });
  b.cd = 0;
  assert.ok(until(w2, () => b.state === "windup", 2));
  assert.equal(b.mode, "bash");
  const cone = b.tels[0];
  assert.equal(cone.shape, "cone");
  assert.equal(cone.damage, 12);
  assert.equal(cone.windup, 0.55);
  assert.ok(until(w2, () => b.state === "attack", 2));
  assert.equal(w2.player.hp, 88);
});

test("knight: lowers its guard to strike and raises it again after recovering", () => {
  const w = makeWorld({ withPlayer: true });
  const k = createEnemy(w, "knight", -2.5, 0, { aggro: true });
  assert.equal(k.guard, true);
  assert.ok(until(w, () => k.state === "windup", 8));
  assert.equal(k.guard, false);
  assert.ok(until(w, () => k.state === "recover", 3));
  assert.ok(until(w, () => k.state === "aggro", 4));
  assert.equal(k.guard, true);
});

test("ghost: fades while winding up, reappears on its circle, then fades back in", () => {
  const w = makeWorld({ withPlayer: true });
  const g = createEnemy(w, "ghost", -2.5, 0, { aggro: true });
  g.group.add(new THREE.Group());
  g.group.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), [new THREE.MeshBasicMaterial({ opacity: 0.8 }), new THREE.MeshBasicMaterial({ opacity: 0.5 })]));
  assert.ok(until(w, () => g.state === "windup", 8));
  const circle = g.tels[0];
  assert.ok(until(w, () => g.t >= 0.6, 2));
  assert.ok(g.mats.length > 2);
  for (const r of g.mats) assert.ok(Math.abs(r.m.opacity - r.base * 0.12) < 1e-9, "dimmed to 12%");
  assert.ok(until(w, () => g.state === "attack", 2));
  assert.ok(dist(g, circle) < 0.05, "reappears on its circle");
  assert.ok(until(w, () => g.state !== "attack", 2));
  for (const r of g.mats) assert.equal(r.m.opacity, r.base);
});

test("ghost: a stun mid-fade brings it back to full opacity", () => {
  const w = makeWorld({ withPlayer: true });
  const g = createEnemy(w, "ghost", -2.5, 0, { aggro: true });
  assert.ok(until(w, () => g.state === "windup" && g.t >= 0.6, 8));
  applyStatus(w, g, { stun: 1 });
  frame(w);
  for (const r of g.mats) assert.equal(r.m.opacity, r.base);
});

test("spider: leaps out of sight, then drops onto its circle", () => {
  const w = makeWorld({ withPlayer: true });
  const s = createEnemy(w, "spider", -2.5, 0, { aggro: true });
  assert.ok(until(w, () => s.state === "windup", 8));
  const circle = s.tels[0];
  assert.equal(circle.radius, 1.1);
  assert.ok(until(w, () => !s.group.visible, 2));
  assert.ok(s.y >= 3.5);
  assert.ok(until(w, () => s.state === "attack", 2));
  assert.equal(s.y, 0);
  assert.equal(s.group.visible, true);
  assert.ok(dist(s, circle) < 0.05);
});

test("spider: a stun mid-leap brings it back to the ground", () => {
  const w = makeWorld({ withPlayer: true });
  const s = createEnemy(w, "spider", -2.5, 0, { aggro: true });
  assert.ok(until(w, () => s.y > 1, 8));
  applyStatus(w, s, { stun: 1 });
  frame(w);
  assert.equal(s.y, 0);
  assert.equal(s.group.visible, true);
});

test("bat: winds up a dash line through the player, then lunges along it", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createEnemy(w, "bat", -2.5, 0, { aggro: true });
  assert.ok(until(w, () => b.state === "windup", 8));
  const line = b.tels[0];
  assert.equal(line.shape, "line");
  assert.equal(line.damage, 8);
  const start = { x: b.sx0, z: b.sz0 };
  assert.ok(until(w, () => b.state === "attack", 3));
  assert.ok(Math.hypot(b.x - start.x, b.z - start.z) > 4, "bat did not lunge");
  assert.equal(w.player.hp, 92);
});

test("bat: holds still when it already sits on its orbit point", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createEnemy(w, "bat", 2.8, 0);
  b.orb = 0;
  b.orbDir = 1;
  b.def.move(b, w, 0, 2.8, -1, 0);
  assert.equal(b.x, 2.8);
  assert.equal(b.z, 0);
});

test("archer: its red line is followed by an arrow that hits a player standing on it", () => {
  const w = makeWorld({ withPlayer: true });
  const a = createEnemy(w, "archer", -3, 0, { aggro: true });
  assert.ok(until(w, () => a.state === "windup", 8));
  assert.equal(a.tels[0].shape, "line");
  assert.equal(a.tels[0].damage, 0);
  assert.ok(until(w, () => w.projectiles.length > 0, 2));
  const arrow = w.projectiles[0];
  assert.equal(arrow.kind, "arrow");
  assert.equal(arrow.hostile, true);
  assert.equal(arrow.damage, 8);
  frame(w, 60);
  assert.equal(w.player.hp, 92);
});

test("wisp: fires three orbs along its lines, and only the centre one hits a player straight ahead", () => {
  const w = makeWorld({ withPlayer: true });
  const wisp = createEnemy(w, "wisp", -4, 0, { aggro: true });
  assert.ok(until(w, () => wisp.state === "windup", 8));
  assert.equal(wisp.tels.length, 3);
  assert.ok(until(w, () => w.projectiles.length === 3, 3));
  const shots = [...w.projectiles];
  for (const p of shots) {
    assert.equal(p.hostile, true);
    assert.equal(p.kind, "orb");
    assert.equal(p.damage, 7);
  }
  frame(w, 120);
  assert.equal(w.player.hp, 93);
});

test("keepDistance: backs off when near, closes in when far, and strafes at mid range", () => {
  const w = makeWorld({ withPlayer: true });
  const a = createEnemy(w, "archer", -2, 0);
  w.rng = () => 0.2;
  a.def.move(a, w, 0.1, 2, 1, 0);
  assert.ok(a.x < -2, "backs away");
  a.x = -7;
  a.def.move(a, w, 0.1, 7, 1, 0);
  assert.ok(a.x > -7, "closes in");
  a.x = -4;
  a.z = 0;
  a.strafeT = 0;
  a.def.move(a, w, 0.1, 4, 1, 0);
  assert.equal(a.strafe, -1);
  assert.ok(Math.abs(a.x + 4) < 1e-9, "strafing keeps the range");
  assert.ok(a.z < 0, "strafes sideways");
  a.strafeT = 0;
  w.rng = () => 0.8;
  const z0 = a.z;
  a.def.move(a, w, 0.1, 4, 1, 0);
  assert.equal(a.strafe, 1);
  assert.ok(a.z > z0);
});

test("mushroom: its circle lays a lingering spore cloud that hurts while you stand in it", () => {
  const w = makeWorld({ withPlayer: true });
  createEnemy(w, "mushroom", -2.5, 0, { aggro: true });
  assert.ok(until(w, () => w.hazards.length > 0, 8));
  assert.equal(w.player.hp, 95);
  w.player.invuln = 0;   // nothing in this world decays invuln, so clear the hit's i-frames by hand
  frame(w, 96);
  assert.ok(w.player.hp < 95, "cloud should tick while the player stands in it");
  w.player.x = 3;
  const hp = w.player.hp;
  frame(w, 60);
  assert.equal(w.player.hp, hp);
  assert.equal(w.hazards.length, 0, "cloud expires after 2 s");
});

test("spore cloud ignores a dead or missing player", () => {
  const w = makeWorld({ withPlayer: true });
  createEnemy(w, "mushroom", -2.5, 0, { aggro: true });
  assert.ok(until(w, () => w.hazards.length > 0, 8));
  w.player.dead = true;
  frame(w, 30);
  assert.equal(w.player.hp, 95);
  w.player = null;
  assert.doesNotThrow(() => frame(w, 60));
});

test("slime: hops onto the circle it marked and lands there", () => {
  const w = makeWorld({ withPlayer: true });
  const s = createEnemy(w, "slime", -3, 0, { aggro: true });
  assert.ok(until(w, () => s.state === "windup", 8));
  const circle = s.tels[0];
  assert.ok(until(w, () => s.state === "attack", 3));
  assert.ok(dist(s, circle) < 0.05);
  assert.equal(s.y, 0);
});

test("slime: hops toward the player only while it is beyond arm's length", () => {
  const w = makeWorld({ withPlayer: true });
  const s = createEnemy(w, "slime", -3, 0);
  s.def.move(s, w, 0.1, 0.5, 1, 0);
  assert.equal(s.x, -3);
  s.def.move(s, w, 0.1, 3, 1, 0);
  assert.ok(s.x > -3);
});

test("slime: dying splits it into two aggro slimelings and drops currency once", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.x = -4.5;
  const s = createEnemy(w, "slime", 2, 0);
  const drops = [];
  w.events.on("currency", (p) => drops.push(p.amount));
  damageEnemy(w, s, 1000);
  const kids = w.enemies.filter((e) => e.type === "slimeling");
  assert.equal(kids.length, 2);
  for (const k of kids) {
    assert.equal(k.state, "aggro");
    assert.ok(dist(k, { x: 2, z: 0 }) <= 0.5 + 1e-9);
  }
  assert.equal(drops.length, 1);
  assert.ok(drops[0] >= 2 && drops[0] <= 4);
  frame(w, 2);
  assert.equal(w.enemies.filter((e) => e.type === "slimeling").length, 2);
  assert.equal(drops.length, 1);
});

test("slime: an hp drop to zero outside any hit still splits it, exactly once", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.x = -4.5;
  const s = createEnemy(w, "slime", 2, 0);
  const drops = [];
  w.events.on("currency", (p) => drops.push(p.amount));
  s.hp = 0;
  frame(w, 3);
  assert.equal(w.enemies.filter((e) => e.type === "slimeling").length, 2);
  assert.equal(drops.length, 1);
});

test("an actor whose brain kills it mid-frame still finishes that frame", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createEnemy(w, "skeleton", 2, 0);
  e.brain = (en) => { en.hp = 0; };
  const drops = [];
  w.events.on("currency", (p) => drops.push(p.amount));
  frame(w);
  assert.equal(e.dead, true);
  assert.deepEqual(drops, [e.drop]);
});

test("a burn tick that kills runs the same death as a hit", () => {
  const w = makeWorld({ withPlayer: true });
  const e = createEnemy(w, "skeleton", 2, 0);
  const drops = [];
  w.events.on("currency", (p) => drops.push(p.amount));
  applyStatus(w, e, { burn: { dps: 1000, time: 1 } });
  frame(w, 60);
  assert.equal(e.dead, true);
  assert.deepEqual(drops, [e.drop]);
});

test("boss-flagged actors push harder when separating and burst bigger on death", () => {
  const w = makeWorld();
  const big = createActor(w, { type: "dummy", name: "Big", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 0, z: 0, boss: true });
  const small = createActor(w, { type: "dummy", name: "Small", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 0.1, z: 0 });
  frame(w);
  assert.ok(dist(big, small) > 0.4, "overlap is pushed apart harder when a boss is involved");
  const bursts = [];
  w.fx.burst = (...args) => bursts.push(args);
  big.hp = 0;
  frame(w);
  assert.ok(bursts.some((a) => a[4] === 24 && a[5] === 5), "boss death burst is large");
});

test("bat orbit direction is chosen by the rng when first set", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createEnemy(w, "bat", 2.8, 0);
  const c = createEnemy(w, "bat", 2.8, 0);
  w.rng = () => 0.2;
  b.def.move(b, w, 0, 2.8, -1, 0);
  assert.equal(b.orbDir, -1);
  w.rng = () => 0.8;
  c.def.move(c, w, 0, 2.8, -1, 0);
  assert.equal(c.orbDir, 1);
});

test("two actors on exactly the same spot produce finite positions (no divide by zero)", () => {
  const w = makeWorld();
  const a = createActor(w, { type: "dummy", name: "A", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 0, z: 0 });
  const b = createActor(w, { type: "dummy", name: "B", asset: "enemy-skeleton", hp: 5, speed: 1, radius: 0.3, damage: 1, x: 0, z: 0 });
  frame(w);
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z) && Number.isFinite(b.x) && Number.isFinite(b.z));
});

// ---------------------------------------------------------------- imp, scorpion, totem
for (const [roll, side] of [[0.2, -1], [0.8, 1]]) {
  test(`imp: throws one fireball straight and one ${side < 0 ? "to its right" : "to its left"}, each along a harmless aim line`, () => {
    const w = makeWorld({ withPlayer: true });
    const imp = createEnemy(w, "imp", -4, 0, { aggro: true });
    w.rng = () => roll;
    assert.ok(until(w, () => imp.state === "windup", 8));
    assert.equal(imp.side, side);
    assert.equal(imp.tels.length, 2);
    for (const t of imp.tels) { assert.equal(t.shape, "line"); assert.equal(t.damage, 0); }
    const aim = imp.aim;
    assert.ok(until(w, () => w.projectiles.length === 2, 3));
    const [straight, wide] = w.projectiles;
    for (const p of [straight, wide]) { assert.equal(p.kind, "fireball"); assert.equal(p.hostile, true); assert.equal(p.damage, 7); }
    assert.ok(Math.abs(angDiff(Math.atan2(straight.dirX, straight.dirZ), aim)) < 1e-9, "first shot flies along the aim");
    assert.ok(Math.abs(angDiff(Math.atan2(wide.dirX, wide.dirZ), aim) - side * 0.3) < 1e-9, "second shot is 0.3 rad to the rolled side");
    frame(w, 120);
    assert.equal(w.player.hp, 93, "only the straight fireball hits a player who stands still");
  });
}

test("scorpion: closes to sting range, then stings along a short line from its body", () => {
  const w = makeWorld({ withPlayer: true });
  const s = createEnemy(w, "scorpion", -4, 0, { aggro: true });
  assert.ok(until(w, () => s.state === "windup", 8));
  assert.ok(dist(s, w.player) < 2.3, "stings only from close range");
  const [t] = s.tels;
  assert.equal(t.shape, "line");
  assert.equal(t.length, 2.8);
  assert.equal(t.width, 0.7);
  assert.deepEqual([t.x, t.z], [s.x, s.z]);
  assert.ok(until(w, () => s.state === "attack", 2));
  frame(w);
  assert.equal(s.pitch, -0.3, "tail snaps forward on the hit");
  assert.equal(w.player.hp, 91);
});

test("totem: stays put, ignores a distant player, and pulses a circle around itself when the player is near", () => {
  const w = makeWorld({ withPlayer: true });
  const far = createEnemy(w, "totem", -4.5, 0, { aggro: true });
  frame(w, 240);
  assert.deepEqual([far.x, far.z], [-4.5, 0], "never walks");
  assert.equal(far.state, "aggro", "a player 4.5 tiles away is out of reach");
  assert.equal(w.telegraphs.length, 0);
  far.dead = true;

  const near = createEnemy(w, "totem", -2, 0, { aggro: true });
  assert.ok(until(w, () => near.state === "windup", 8));
  const [t] = near.tels;
  assert.equal(t.shape, "circle");
  assert.equal(t.radius, 2.4);
  assert.deepEqual([t.x, t.z], [-2, 0]);
  const slams = () => w.audio.play.calls.filter((c) => c[0] === "slam").length;
  const before = slams();
  assert.ok(until(w, () => near.state === "attack", 2));
  assert.equal(slams(), before + 1, "the pulse plays the slam sound");
  assert.equal(w.player.hp, 87);
  assert.deepEqual([near.x, near.z], [-2, 0]);
});
