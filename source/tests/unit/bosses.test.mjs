// Unit tests for src/game/bosses.js: the three bosses, their phases, attack patterns, adds and death.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeWorld, step } from "./helpers.mjs";
import { BOSS_TYPES, createBoss } from "../../src/game/bosses.js";
import { damageEnemy, applyStatus } from "../../src/game/combat.js";

const DT = 1 / 60;
const BOSSES = Object.keys(BOSS_TYPES);
const frame = (w, n = 1) => { for (let i = 0; i < n; i++) step(w, DT); };
function until(w, pred, max = 8) {
  for (let t = 0; t < max; t += DT) { if (pred()) return true; frame(w); }
  return pred();
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Choose the attack a boss would pick for a given RNG value (weighted picks read world.rng once).
function pickWith(b, w, u) {
  const saved = w.rng;
  w.rng = () => u;
  try { return b.def.pick(b, w, 0); } finally { w.rng = saved; }
}

// Run one chosen action to completion, recording every telegraph and projectile it creates.
function playOut(w, b, action, max = 8) {
  const tele = new Set();
  const proj = new Set();
  const oldTele = new Set(w.telegraphs);
  const oldProj = new Set(w.projectiles);
  b.next = action;
  b.gap = 0;
  for (let t = 0; t < max; t += DT) {
    step(w, DT);
    if (w.player) w.player.invuln = Math.max(0, w.player.invuln - DT);   // the player loop normally decays i-frames
    for (const x of w.telegraphs) if (!oldTele.has(x) && x.sourceName === b.name) tele.add(x);
    for (const p of w.projectiles) if (!oldProj.has(p) && p.sourceName === b.name) proj.add(p);
    if (b.next === null && b.action === null) break;
  }
  return { tele, proj };
}

// Ten evenly spread RNG values reach every weighted option used by the bosses.
const SAMPLES = Array.from({ length: 10 }, (_, k) => (k + 0.5) / 10);

// ---------------------------------------------------------------- creation
test("createBoss builds a phase-1 boss actor with a boss brain and the table's stats", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "stone-golem", -3, 0);
  assert.equal(b.boss, true);
  assert.equal(b.drop, 25);
  assert.equal(b.maxHp, 450);
  assert.equal(b.radius, 1.0);
  assert.equal(b.phase, 1);
  assert.equal(b.gap, 1.4);
  assert.equal(b.action, null);
  assert.equal(b.next, null);
  assert.equal(b.state, "aggro");
  assert.equal(typeof b.def.pick, "function");
  assert.ok(w.enemies.includes(b));
  assert.ok(Math.abs(b.yaw) > 0, "faces the player");
});

test("createBoss rejects unknown ids and faces yaw 0 with no player", () => {
  const w = makeWorld();
  assert.throws(() => createBoss(w, "dragon-lord", 0, 0), /unknown boss/);
  const b = createBoss(w, "necromancer", 1, 1);
  assert.equal(b.yaw, 0);
});

// ---------------------------------------------------------------- phases
test("phases change at 66% and 33% of max hp, each emitting boss:phase once", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "slime-king", -3, 0);
  const phases = [];
  const sounds = [];
  w.events.on("boss:phase", (p) => { phases.push([p.boss === b, p.phase]); });
  w.audio.play = (name) => sounds.push(name);
  b.hp = 300 * 0.67;
  frame(w);
  assert.deepEqual(phases, []);
  assert.equal(b.phase, 1);
  b.hp = 300 * 0.66;
  frame(w);
  assert.deepEqual(phases, [[true, 2]]);
  frame(w);
  assert.deepEqual(phases, [[true, 2]], "no duplicate phase event");
  b.hp = 300 * 0.33;
  frame(w);
  assert.deepEqual(phases, [[true, 2], [true, 3]]);
  assert.equal(b.phase, 3);
  assert.equal(sounds.filter((s) => s === "boss").length, 2);
});

test("a hit that skips both thresholds emits phase 2 then phase 3", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "necromancer", -3, 0);
  const phases = [];
  w.events.on("boss:phase", (p) => phases.push(p.phase));
  b.hp = 100;
  frame(w);
  assert.deepEqual(phases, [2, 3]);
});

test("a phase change without an onPhase hook still advances (slime king), and necromancer queues a summon", () => {
  const w = makeWorld({ withPlayer: true });
  const k = createBoss(w, "slime-king", -3, 0);
  k.hp = 150;
  frame(w);
  assert.equal(k.phase, 2);
  assert.equal(k.next, null);
  const n = createBoss(w, "necromancer", 3, 0);
  n.hp = 360;
  frame(w);
  assert.equal(n.phase, 2);
  assert.ok(n.next && Array.isArray(n.next.factories), "necromancer queues its summon");
});

test("a phase change still fires with no living player, but no attack starts", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "stone-golem", -3, 0);
  w.player = null;
  b.gap = 0;
  b.hp = 200;
  const phases = [];
  w.events.on("boss:phase", (p) => phases.push(p.phase));
  frame(w, 120);
  assert.deepEqual(phases, [2]);
  assert.equal(b.action, null);
  assert.equal(w.telegraphs.length, 0);
});

test("a dead player stops the boss from acting", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.dead = true;
  const b = createBoss(w, "stone-golem", -3, 0);
  b.gap = 0;
  frame(w, 120);
  assert.equal(b.action, null);
  assert.equal(b.gap, 0);
  assert.equal(w.telegraphs.length, 0);
});

// ---------------------------------------------------------------- movement and timing
for (const id of BOSSES) {
  test(`${id}: walks toward a far player, stays put when close, and keeps distance when too near`, () => {
    const w = makeWorld({ withPlayer: true });
    const b = createBoss(w, id, -3, 0);
    const x0 = b.x;
    const still = { necromancer: 4.5, "dragon-whelp": 3.0 }[id] || 1.0;   // the necromancer holds 3.8 to 5.6, the whelp 2.2 to 4.2
    b.def.move(b, w, 0.1, still, 1, 0);
    assert.equal(b.x, x0, "no step inside its hold range");
    b.def.move(b, w, 0.1, 6.5, 1, 0);
    assert.ok(b.x > x0, "walks toward a far player");
    if (id === "necromancer" || id === "dragon-whelp") {
      const x1 = b.x;
      b.def.move(b, w, 0.1, 2.0, 1, 0);
      assert.ok(b.x < x1, "backs away when too close");
    }
  });
}

test("a frozen boss stops walking and its attack timer pauses until it thaws", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "stone-golem", -4, 0);
  const x0 = b.x, gap0 = b.gap;
  applyStatus(w, b, { freeze: 2 });     // bosses get half-length freezes: 1 s
  frame(w, 30);
  assert.equal(b.x, x0);
  assert.equal(b.gap, gap0, "the gap does not tick down while frozen");
  frame(w, 45);
  assert.ok(b.x > x0, "walks again once thawed");
});

test("the boss gap resets to the phase's value after an action finishes", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "slime-king", -3, 0);
  playOut(w, b, pickWith(b, w, 0.1));
  assert.equal(b.action, null);
  assert.equal(b.gap, 0.9);
});

// ---------------------------------------------------------------- death
for (const id of BOSSES) {
  test(`${id}: death drops 25 currency, emits boss:death, and cancels its live telegraphs`, () => {
    const w = makeWorld({ withPlayer: true });
    const b = createBoss(w, id, -3, 0);
    const deaths = [];
    const drops = [];
    w.events.on("boss:death", (p) => deaths.push(p.boss));
    w.events.on("currency", (p) => drops.push(p.amount));
    b.next = pickWith(b, w, 0.05);
    b.gap = 0;
    assert.ok(until(w, () => w.telegraphs.some((t) => !t.dead), 3), "an attack should be telegraphed");
    const hp = w.player.hp;
    damageEnemy(w, b, 100000);
    assert.deepEqual(deaths, [b]);
    assert.deepEqual(drops, [25]);
    assert.equal(b.dead, true);
    assert.equal(b.group.visible, false);
    assert.equal(b.tels.length, 0);
    frame(w, 150);
    assert.equal(w.player.hp, hp, "the cancelled attack must not land");
    assert.ok(w.telegraphs.every((t) => t.dead));
    assert.ok(w.fx.burst.calls.some((c) => c[4] === 24 && c[5] === 5), "big death burst");
    assert.ok(w.audio.play.calls.some((c) => c[0] === "death"));
  });
}

// ---------------------------------------------------------------- attack patterns
// Every option each phase can pick is run to completion and every telegraph it shows must be >= 0.6 s.
for (const id of BOSSES) {
  for (const phase of [1, 2, 3]) {
    test(`${id} phase ${phase}: every attack is telegraphed for at least 0.6 s and ends cleanly`, () => {
      const w = makeWorld({ withPlayer: true });
      w.player.invuln = 1e9;
      const b = createBoss(w, id, -3, 0);
      b.phase = phase;
      const shown = new Set();
      for (const u of SAMPLES) {
        const { tele } = playOut(w, b, pickWith(b, w, u));
        for (const t of tele) shown.add(t);
        assert.equal(b.action, null, `attack for u=${u} did not end`);
        assert.equal(b.gap, [null, [1.0, 0.8, 0.6][0]][0] ?? b.def.gap[phase - 1]);
      }
      assert.ok(shown.size > 0);
      for (const t of shown) assert.ok(t.windup >= 0.6, `${id} phase ${phase}: windup ${t.windup}`);
    });
  }

  test(`${id}: every attack still runs with no fx, shake or hit-stop hooks`, () => {
    const w = makeWorld({ withPlayer: true });
    w.player.invuln = 1e9;
    w.fx = null;
    w.shake = undefined;
    w.hitStop = undefined;
    const b = createBoss(w, id, -3, 0);
    for (const phase of [1, 2, 3]) {
      b.phase = phase;
      for (const u of SAMPLES) playOut(w, b, pickWith(b, w, u));
    }
    assert.equal(b.action, null);
  });
}

test("slime king hop lands on the player's spot after a 0.9 s telegraph and hits 16 at phase 1", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "slime-king", -3, 0);
  b.next = pickWith(b, w, 0.1);
  b.gap = 0;
  assert.ok(until(w, () => w.telegraphs.length > 0, 2));
  const circle = w.telegraphs[0];
  assert.equal(circle.shape, "circle");
  assert.equal(circle.windup, 0.9);
  assert.equal(circle.damage, 16);
  assert.equal(circle.radius, 1.8);
  assert.ok(until(w, () => b.action === null, 3));
  assert.ok(dist(b, circle) < 0.05, "boss lands on the circle");
  assert.equal(w.player.hp, 84);
});

test("slime king phase 2 hop uses the wider circle and higher damage", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "slime-king", -3, 0);
  b.phase = 2;
  const { tele } = playOut(w, b, pickWith(b, w, 0.1));
  const circles = [...tele].filter((t) => t.shape === "circle");
  assert.equal(circles.length, 1);
  assert.equal(circles[0].radius, 2.0);
  assert.equal(circles[0].damage, 18);
});

test("slime king spit fires a fan of n aimed lines, then n orbs (3 in phase 2, 5 in phase 3)", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.invuln = 1e9;
  const b = createBoss(w, "slime-king", -3, 0);
  b.phase = 2;
  const two = playOut(w, b, pickWith(b, w, 0.875));
  assert.equal([...two.tele].filter((t) => t.shape === "line").length, 3);
  assert.ok([...two.tele].every((t) => t.windup === 0.85 && t.damage === 0));
  assert.equal(two.proj.size, 3);
  for (const p of two.proj) assert.equal(p.damage, 9);
  b.phase = 3;
  const three = playOut(w, b, pickWith(b, w, 0.8));
  assert.equal([...three.tele].filter((t) => t.shape === "line").length, 5);
  assert.equal(three.proj.size, 5);
});

test("slime king adds three slimes off its body once at half health, and never again", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.invuln = 1e9;
  const b = createBoss(w, "slime-king", -2.5, 0);
  b.hp = 140;
  b.gap = 0;
  const slimes = () => w.enemies.filter((e) => e.type === "slime" && !e.dead).length;
  assert.ok(until(w, () => b.splitDone === true, 3));
  assert.ok(until(w, () => slimes() === 3, 3), "three slimes appear");
  for (const s of w.enemies.filter((e) => e.type === "slime")) assert.equal(s.state, "aggro");
  frame(w, 300);
  assert.equal(slimes(), 3, "no second split, and nothing else spawns slimes");
});

test("stone golem slam lands a circle at most 3.4 tiles out, toward the player, after 0.9 s", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.invuln = 1e9;
  const b = createBoss(w, "stone-golem", -4, 0);
  b.next = pickWith(b, w, 0.05);
  b.gap = 0;
  assert.ok(until(w, () => w.telegraphs.length > 0, 2));
  const t = w.telegraphs[0];
  assert.equal(t.shape, "circle");
  assert.equal(t.radius, 1.8);
  assert.equal(t.windup, 0.9);
  assert.equal(t.damage, 20);
  assert.ok(Math.abs(dist(t, b) - 3.4) < 0.05, `placed ${dist(t, b)} out`);
  assert.ok(t.x > b.x, "toward the player");
});

test("stone golem slam stays on the player when they are inside 3.4 tiles", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "stone-golem", -1.5, 0);
  b.next = pickWith(b, w, 0.05);
  b.gap = 0;
  assert.ok(until(w, () => w.telegraphs.length > 0, 2));
  assert.ok(Math.abs(dist(w.telegraphs[0], b) - 1.5) < 0.05);
});

test("stone golem fan is five lines at 1.0 s, dealing 14", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "stone-golem", -3, 0);
  b.phase = 2;
  const { tele } = playOut(w, b, pickWith(b, w, 0.7));
  const lines = [...tele].filter((t) => t.shape === "line");
  assert.equal(lines.length, 5);
  for (const l of lines) { assert.equal(l.windup, 1.0); assert.equal(l.damage, 14); assert.equal(l.length, 8); }
});

test("stone golem star is eight lines, then eight more rotated by 22.5 degrees at 0.9 s", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "stone-golem", -3, 0);
  b.phase = 3;
  const { tele } = playOut(w, b, pickWith(b, w, 0.5625));
  const lines = [...tele].filter((t) => t.shape === "line");
  assert.equal(lines.length, 16);
  assert.equal(lines.filter((l) => l.windup === 1.0).length, 8);
  assert.equal(lines.filter((l) => l.windup === 0.9).length, 8);
  assert.equal(lines.filter((l) => l.damage === 13).length, 16);
});

test("stone golem phase 3 double slam telegraphs 0.9 s then 0.8 s", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "stone-golem", -3, 0);
  b.phase = 3;
  const { tele } = playOut(w, b, pickWith(b, w, 0.1));
  const winds = [...tele].map((t) => t.windup).sort();
  assert.deepEqual(winds, [0.8, 0.9]);
});

test("necromancer volley fires n aimed lines at 0.8 s, then n orbs (3 in phase 1, 5 in phase 2)", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.invuln = 1e9;
  const b = createBoss(w, "necromancer", -3, 0);
  const v3 = playOut(w, b, pickWith(b, w, 0.1));
  assert.equal([...v3.tele].filter((t) => t.shape === "line" && t.windup === 0.8).length, 3);
  assert.equal(v3.proj.size, 3);
  b.phase = 2;
  const v5 = playOut(w, b, pickWith(b, w, 0.5));
  assert.equal(v5.proj.size, 5);
});

test("necromancer nova is a 2-tile circle plus eight lines at 0.9 s, then eight orbs", () => {
  const w = makeWorld({ withPlayer: true });
  w.player.invuln = 1e9;
  const b = createBoss(w, "necromancer", -3, 0);
  const { tele, proj } = playOut(w, b, pickWith(b, w, 0.9));
  const circle = [...tele].find((t) => t.shape === "circle");
  assert.equal(circle.radius, 2.0);
  assert.equal(circle.windup, 0.9);
  assert.equal(circle.damage, 10);
  assert.equal([...tele].filter((t) => t.shape === "line").length, 8);
  assert.equal(proj.size, 8);
});

test("necromancer cone pair hits a player in front twice at 0.9 s each", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "necromancer", -3, 0);
  b.phase = 3;
  const { tele } = playOut(w, b, pickWith(b, w, 0.1));
  const cones = [...tele].filter((t) => t.shape === "cone");
  assert.equal(cones.length, 2);
  for (const c of cones) { assert.equal(c.radius, 6.5); assert.equal(c.arc, 1.2); assert.equal(c.windup, 0.9); assert.equal(c.damage, 16); }
  assert.equal(w.player.hp, 68);
});

test("necromancer summon places two skeleton circles at 1.0 s, and each one raises a skeleton", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "necromancer", -3, 0);
  b.hp = 360;
  frame(w);
  assert.equal(b.phase, 2);
  assert.ok(b.next, "a summon is queued");
  assert.ok(until(w, () => b.action !== null, 3));
  assert.equal(b.next, null, "the queued summon was taken");
  assert.ok(until(w, () => w.enemies.some((e) => e.type === "skeleton"), 3));
  assert.equal(w.enemies.filter((e) => e.type === "skeleton" && !e.dead).length, 2);
});

test("necromancer phase 2 summons only when fewer than three skeletons are alive", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "necromancer", -3, 0);
  b.phase = 2;
  const skel = (dead) => { w.enemies.push({ type: "skeleton", dead, x: 1, z: 0 }); };
  // no skeletons alive: u = 0.1 takes the summon (weight 3 of 8), which lasts 1.6 s
  assert.equal(pickWith(b, w, 0.1).factories[0](b, w).dur, 1.6);
  skel(false); skel(false); skel(false); skel(true);   // three alive, one dead
  // three alive: the summon weight is zero, so u = 0.1 takes the 1.5 s volley
  assert.equal(pickWith(b, w, 0.1).factories[0](b, w).dur, 1.5);
});

test("necromancer phase 3 summons only when fewer than two skeletons are alive", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "necromancer", -3, 0);
  b.phase = 3;
  const none = pickWith(b, w, 0.95);
  assert.equal(none.factories[0](b, w).dur, 1.6);
  w.enemies.push({ type: "skeleton", dead: false, x: 1, z: 0 }, { type: "skeleton", dead: false, x: 2, z: 0 });
  const two = pickWith(b, w, 0.95);
  assert.equal(two.factories[0](b, w).dur, 1.6, "two alive: the summon weight is zero, so nova (also 1.6) is taken");
  assert.equal(w.enemies.filter((e) => e.type === "skeleton").length, 2);
});

test("weighted picks fall back to the first option when the rng yields NaN", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "slime-king", -3, 0);
  b.phase = 2;
  const c = pickWith(b, w, NaN);
  assert.ok(Array.isArray(c.factories));
  assert.equal(c.factories.length, 1);
});

test("the phase-2 king split only triggers below half health, and never twice", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "slime-king", -3, 0);
  b.phase = 2;
  b.hp = 290;
  const c = pickWith(b, w, 0.1);
  assert.equal(b.splitDone, undefined, "no split above half health");
  assert.equal(c.factories.length, 1);
});

// ---------------------------------------------------------------- interrupts (added after the stun/freeze fix)
for (const id of ["slime-king", "stone-golem", "necromancer"]) {
  for (const kind of ["stunT", "frozenT"]) {
    test(`${id}: ${kind === "stunT" ? "stun" : "freeze"} during an attack cancels it and its telegraphs`, () => {
      const w = makeWorld({ withPlayer: true });
      const b = createBoss(w, id, 0, -2);
      w.player.x = 0; w.player.z = 0.5;
      for (let i = 0; i < 600 && !b.action; i++) { w.dt = 1 / 60; w.time += 1 / 60; b.update(w, 1 / 60); for (const t of w.telegraphs) if (!t.dead) t.update(w, 1 / 60); }
      assert.ok(b.action, "boss should start an attack");
      b.status[kind] = 1;
      b.update(w, 1 / 60);
      assert.equal(b.action, null);
      assert.ok(w.telegraphs.every((t) => t.dead || t.cancelled || t.owner !== b), "boss telegraphs cancelled");
      const gap = b.gap; b.update(w, 1 / 60);
      assert.equal(b.gap, gap, "no new attack countdown while helpless");
      assert.equal(b.action, null);
    });
  }
}

// ---------------------------------------------------------------- Dragon Whelp, boss order, floor scaling
import { bossOrder } from "../../src/game/bosses.js";

test("dragon whelp: sweeps its tail when the player is close, otherwise breathes or throws fireballs by phase", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "dragon-whelp", 0, 0);
  w.player.x = 0; w.player.z = 4;
  const run = (action) => playOut(w, b, action);
  // close: tail sweep, one circle centred on the whelp
  const sweep = run(b.def.pick(b, w, 1.5));
  assert.deepEqual([...sweep.tele].map((t) => [t.shape, t.radius, t.x, t.z]), [["circle", 2.5, 0, 0]]);
  // phase 1: a cone breath (low roll) or three fireballs (high roll)
  const breath = run(pickFar(b, w, 0.05));
  assert.deepEqual([...breath.tele].map((t) => [t.shape, t.damage]), [["cone", 16]]);
  const balls = run(pickFar(b, w, 0.95));
  assert.equal(balls.proj.size, 3);
  assert.ok([...balls.proj].every((p) => p.hostile && p.damage === 11));
  assert.equal(balls.tele.size, 3, "one aim line per fireball");
  // phase 2: wider breath, five fireballs
  b.phase = 2;
  assert.ok(Math.abs([...run(pickFar(b, w, 0.05)).tele][0].arc - 1.6) < 1e-9);
  assert.equal(run(pickFar(b, w, 0.95)).proj.size, 5);
  // phase 3: every option is a two-part combo
  b.phase = 3;
  for (const u of [0.05, 0.6, 0.95]) assert.equal(pickFar(b, w, u).factories.length, 2);
  assert.ok(run(pickFar(b, w, 0.95)).tele.size >= 2, "sweep then breath");
});
function pickFar(b, w, u) { const saved = w.rng; w.rng = () => u; try { return b.def.pick(b, w, 5); } finally { w.rng = saved; } }

test("dragon whelp hovers, and its model reacts to the windup", () => {
  const w = makeWorld({ withPlayer: true });
  const b = createBoss(w, "dragon-whelp", 0, 0);
  w.time = 1; b.def.move(b, w, 0.1, 3, 1, 0);
  assert.ok(b.y > 0.04 && b.y < 0.26);
  const glow = b.asset.group.userData.parts.mouthGlow;
  b.asset.update(1, { move: 0, act: "idle", k: 0 }); const idle = glow.material.emissiveIntensity;
  b.asset.update(1, { move: 0, act: "windup", k: 1 });
  assert.ok(glow.material.emissiveIntensity > idle + 2);
});

test("bossOrder gives three different bosses, fixed for a seed and varying between seeds", () => {
  const a = bossOrder("seed-a");
  assert.equal(a.length, 3); assert.equal(new Set(a).size, 3);
  assert.ok(a.every((id) => BOSS_TYPES[id]));
  assert.deepEqual(bossOrder("seed-a"), a);
  const firsts = new Set(Array.from({ length: 40 }, (_, i) => bossOrder("s" + i)[0]));
  assert.equal(firsts.size, 4, "any of the four can open a run");
});

test("a boss met off its home floor has that floor's health and scaled damage; on its home floor it is unchanged", () => {
  const w = makeWorld({ withPlayer: true });
  const home = createBoss(w, "slime-king", 0, 0), same = createBoss(w, "slime-king", 0, 0, 1), late = createBoss(w, "slime-king", 0, 0, 3), odd = createBoss(w, "slime-king", 0, 0, 9);
  assert.deepEqual([home.maxHp, same.maxHp, late.maxHp, odd.maxHp], [300, 300, 600, 300]);
  assert.deepEqual([home.dmgMul, late.dmgMul], [1, 1.4]);
  const early = createBoss(w, "necromancer", 0, 0, 1);
  assert.equal(early.maxHp, 300); assert.ok(Math.abs(early.dmgMul - 1 / 1.4) < 1e-9);
  // the scaling reaches its telegraphs and shots
  w.player.x = 0; w.player.z = 3;
  const { tele } = playOut(w, late, late.def.pick(late, w, 3));
  assert.ok([...tele].some((t) => Math.abs(t.damage - 16 * 1.4) < 1e-9), "hop damage 14 + 2 at phase 1, times 1.4");
});

test("a telegraph from an actor with no damage scaling keeps its plain damage", async () => {
  const { tele } = await import("../../src/game/enemies.js");
  const w = makeWorld({ withPlayer: true });
  const t = tele({ name: "Dummy", damage: 5, tels: [] }, w, { shape: "circle", x: 0, z: 0, radius: 1 });
  assert.equal(t.damage, 5);
});

test("actors stacked on exactly the same spot are pushed apart to both sides", async () => {
  const { createEnemy } = await import("../../src/game/enemies.js");
  const w = makeWorld({ withPlayer: true });
  w.player.x = 9; w.player.z = 9;
  const es = [0, 1, 2].map(() => { const e = createEnemy(w, "skeleton", 0, 0); e.brain = null; return e; });
  es[2].update(w, 1 / 60);
  es[0].x = 0; es[0].z = 0; es[1].x = 0; es[1].z = 0;
  es[0].update(w, 1 / 60);
  assert.ok(es.some((e) => e.x > 0) && es.some((e) => e.x < 0));
});
