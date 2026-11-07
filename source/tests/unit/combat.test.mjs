// Unit tests for src/game/combat.js: damage, status effects, telegraphs, projectiles, sector geometry.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeWorld, spy, step } from "./helpers.mjs";
import {
  damageEnemy, damagePlayer, applyStatus, tickStatus,
  spawnTelegraph, spawnProjectile, makeSectorGeometry,
} from "../../src/game/combat.js";
import { COLORS } from "../../src/engine/assets.js";

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

function makeEnemy(over = {}) {
  return { x: 1, z: 0, hp: 50, maxHp: 50, radius: 0.4, boss: false, name: "Bat", dead: false, group: new THREE.Group(), ...over };
}

// World with a player (100 hp) and empty stats so no item tags fire unless a test sets them.
function fresh({ withPlayer = true } = {}) {
  const w = makeWorld({ withPlayer });
  w.stats = {};
  return w;
}

// Telegraph spawn with the origin as default position (tests that don't care about placement).
const tele = (w, o) => spawnTelegraph(w, { x: 0, z: 0, ...o });

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

describe("makeSectorGeometry", () => {
  test("builds a flat fan with the apex at the origin and the arc spanning from -45 to +45 degrees", () => {
    const g = makeSectorGeometry(2, Math.PI / 2, 4);
    const pos = g.attributes.position.array;
    assert.equal(g.attributes.position.count, 1 + 5);
    assert.deepEqual([pos[0], pos[1], pos[2]], [0, 0, 0]);
    for (let i = 1; i <= 5; i++) assert.equal(pos[i * 3 + 1], 0, "rim vertices are flat");
    assert.ok(near(pos[3], -Math.SQRT2, 1e-5), "first rim vertex sits at -45 degrees");
    assert.ok(near(pos[5], Math.SQRT2, 1e-5));
    assert.ok(near(pos[15], Math.SQRT2, 1e-5), "last rim vertex sits at +45 degrees");
    assert.ok(near(pos[17], Math.SQRT2, 1e-5));
    assert.deepEqual(Array.from(g.index.array), [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
    assert.ok(Math.abs(Math.abs(g.attributes.normal.array[1]) - 1) < 1e-6, "normals point along y");
  });

  test("defaults to 20 segments when none is given", () => {
    const g = makeSectorGeometry(1, Math.PI);
    assert.equal(g.attributes.position.count, 1 + 21);
    assert.equal(g.index.count, 20 * 3);
  });
});

// ---------------------------------------------------------------------------
// damageEnemy
// ---------------------------------------------------------------------------

describe("damageEnemy", () => {
  test("ignores missing, dead, already-empty and non-positive hits", () => {
    const w = fresh();
    const hits = spy();
    w.events.on("enemy:hit", hits);
    const live = makeEnemy();
    assert.equal(damageEnemy(w, null, 5), 0);
    assert.equal(damageEnemy(w, makeEnemy({ dead: true, hp: 10 }), 5), 0);
    assert.equal(damageEnemy(w, makeEnemy({ hp: 0 }), 5), 0);
    assert.equal(damageEnemy(w, live, 0), 0);
    assert.equal(damageEnemy(w, live, -3), 0);
    assert.equal(live.hp, 50);
    assert.equal(hits.calls.length, 0);
    assert.equal(w.audio.play.calls.length, 0);
  });

  test("a plain player hit subtracts hp, reports dealt damage and plays hit feedback", () => {
    const w = fresh();
    const e = makeEnemy();
    const hits = spy();
    w.events.on("enemy:hit", hits);
    assert.equal(damageEnemy(w, e, 10), 10);
    assert.equal(e.hp, 40);
    assert.equal(e.dead, false);
    assert.equal(hits.calls[0][0].amount, 10);
    assert.equal(hits.calls[0][0].crit, false);
    assert.equal(hits.calls[0][0].enemy, e);
    assert.deepEqual(w.audio.play.calls, [["hit"]]);
    assert.deepEqual(w.shake.calls, [[0.06]]);
    assert.deepEqual(w.hitStop.calls, [[0.033]]);
    assert.deepEqual(w.fx.number.calls[0].slice(3), ["10", 0xffffff]);
    assert.equal(w.fx.flash.calls[0][0], e.group);
    assert.equal(w.fx.flash.calls[0][1], 0.08);
    assert.equal(w.fx.burst.calls[0][4], 6);
  });

  test("crits show a gold bang number, a heavier shake and a longer hit-stop", () => {
    const w = fresh();
    const e = makeEnemy({ height: 1.5 });
    assert.equal(damageEnemy(w, e, 10, { crit: true }), 10);
    assert.deepEqual(w.audio.play.calls, [["crit"]]);
    const [x, y, z, text, color] = w.fx.number.calls[0];
    assert.equal(x, 1);
    assert.equal(y, 1.5 + 0.2, "floating number sits above the enemy height");
    assert.equal(z, 0);
    assert.equal(text, "10!");
    assert.equal(color, COLORS.gold);
    assert.deepEqual(w.shake.calls, [[0.15]]);
    assert.deepEqual(w.hitStop.calls, [[0.05]]);
    assert.equal(w.fx.flash.calls[0][1], 0.12);
    assert.deepEqual(w.fx.burst.calls[0].slice(3), [COLORS.gold, 12, 4]);
  });

  test("heavy hits without a crit use the big feedback but keep a white number", () => {
    const w = fresh();
    const e = makeEnemy();
    damageEnemy(w, e, 10, { heavy: true });
    assert.deepEqual(w.audio.play.calls, [["hit"]]);
    assert.equal(w.fx.number.calls[0][3], "10");
    assert.equal(w.fx.number.calls[0][4], 0xffffff);
    assert.deepEqual(w.shake.calls, [[0.15]]);
    assert.deepEqual(w.fx.burst.calls[0].slice(3), [0xfff0e0, 12, 4]);
  });

  test("a lethal hit clamps the dealt damage, kills, and emits enemy:death but not boss:death", () => {
    const w = fresh();
    const e = makeEnemy({ hp: 4 });
    const deaths = spy(), bossDeaths = spy();
    w.events.on("enemy:death", deaths);
    w.events.on("boss:death", bossDeaths);
    assert.equal(damageEnemy(w, e, 10), 4);
    assert.equal(e.hp, 0);
    assert.equal(e.dead, true);
    assert.equal(deaths.calls.length, 1);
    assert.equal(deaths.calls[0][0].enemy, e);
    assert.equal(bossDeaths.calls.length, 0);
    assert.equal(w.fx.burst.calls.at(-1)[4], 16, "non-boss death bursts 16 pieces");
    assert.equal(w.audio.play.calls.some(c => c[0] === "death"), false);
  });

  test("killing a boss plays the death sound, emits boss:death and bursts gold", () => {
    const w = fresh();
    const e = makeEnemy({ hp: 5, boss: true, name: "Golem" });
    const bossDeaths = spy();
    w.events.on("boss:death", bossDeaths);
    assert.equal(damageEnemy(w, e, 10), 5);
    assert.equal(bossDeaths.calls.length, 1);
    assert.equal(bossDeaths.calls[0][0].boss, e);
    assert.ok(w.audio.play.calls.some(c => c[0] === "death"));
    assert.deepEqual(w.fx.burst.calls.at(-1).slice(3), [COLORS.gold, 40, 6]);
  });

  test("a non-lethal boss hit does not play the death sound", () => {
    const w = fresh();
    const e = makeEnemy({ hp: 50, boss: true });
    damageEnemy(w, e, 10);
    assert.deepEqual(w.audio.play.calls, [["hit"]]);
  });

  test("works with no fx, no audio and no stats attached", () => {
    const w = fresh();
    w.fx = null;
    w.audio = null;
    w.stats = null;
    const e = makeEnemy({ hp: 3, boss: true });
    const bossDeaths = spy();
    w.events.on("boss:death", bossDeaths);
    assert.equal(damageEnemy(w, e, 1, { crit: true }), 1);
    assert.equal(e.hp, 2);
    assert.equal(damageEnemy(w, e, 5), 2);
    assert.equal(e.dead, true);
    assert.equal(bossDeaths.calls.length, 1);
  });

  test("non-player damage skips shake, hit-stop and on-hit tags", () => {
    const w = fresh();
    w.stats = { burnPct: 0.5, slowPct: 0.3, freezeEvery: 1 };
    const e = makeEnemy();
    assert.equal(damageEnemy(w, e, 10, { fromPlayer: false }), 10);
    assert.deepEqual(w.shake.calls, []);
    assert.deepEqual(w.hitStop.calls, []);
    assert.deepEqual(w.audio.play.calls, [["hit"]]);
    assert.equal(e.status.burnT, 0);
    assert.equal(e.status.slowT, 0);
    assert.equal(e.status.frozenT, 0);
  });

  test("dot ticks show ember numbers and skip flash, sound and shake", () => {
    const w = fresh();
    const e = makeEnemy();
    const hits = spy();
    w.events.on("enemy:hit", hits);
    assert.equal(damageEnemy(w, e, 2, { fromPlayer: false, dot: true }), 2);
    assert.equal(e.hp, 48);
    assert.deepEqual(w.fx.number.calls[0].slice(3), ["2", COLORS.ember]);
    assert.equal(w.fx.flash.calls.length, 0);
    assert.equal(w.fx.burst.calls.length, 0);
    assert.equal(w.audio.play.calls.length, 0);
    assert.equal(w.shake.calls.length, 0);
    assert.equal(hits.calls[0][0].amount, 2);
  });

  test("an explicit dot colour overrides the default ember", () => {
    const w = fresh();
    const e = makeEnemy();
    damageEnemy(w, e, 1, { dot: true, color: COLORS.danger });
    assert.equal(w.fx.number.calls[0][4], COLORS.danger);
  });

  test("bleed amplifies direct player damage only while it is active", () => {
    const w = fresh();
    w.stats = { bleedAmp: 0.5 };
    const e = makeEnemy({ hp: 100 });
    applyStatus(w, e, { bleed: { dps: 0, time: 2 } });
    assert.equal(damageEnemy(w, e, 10), 15, "player hit is amplified by 50%");
    assert.equal(e.hp, 85);
    assert.equal(damageEnemy(w, e, 10, { dot: true }), 10, "dot is not amplified");
    assert.equal(damageEnemy(w, e, 10, { fromPlayer: false }), 10, "environment is not amplified");
    assert.equal(e.hp, 65);
    e.status.bleedT = 0;
    assert.equal(damageEnemy(w, e, 10), 10, "expired bleed does not amplify");
    w.stats = {};
    e.status.bleedT = 2;
    assert.equal(damageEnemy(w, e, 10), 10, "no bleedAmp stat means no amplification");
  });

  test("direct player hits apply burn, slow and then freeze tags on a living target", () => {
    const w = fresh();
    w.stats = { burnPct: 0.5, slowPct: 0.3, freezeEvery: 2 };
    const e = makeEnemy({ hp: 100 });
    damageEnemy(w, e, 10);
    assert.equal(e.status.burnT, 3);
    assert.equal(e.status.burnDps, 5);
    assert.equal(e.status.slowT, 2);
    assert.ok(near(e.speedMul, 0.7));
    assert.equal(e.status.frozenT, 0);
    assert.equal(e.status.hits, 1);
    damageEnemy(w, e, 10);
    assert.equal(e.status.frozenT, 1, "every second hit freezes");
    assert.equal(e.speedMul, 0);
    assert.equal(e.status.hits, 0, "hit counter resets after freezing");
    assert.ok(w.fx.burst.calls.some(c => c[3] === 0x9fe8ff), "freeze bursts ice colour");
  });

  test("crit hits apply bleed scaled by bleedPct, and non-crits do not", () => {
    const w = fresh();
    w.stats = { bleedPct: 0.4 };
    const a = makeEnemy({ hp: 100 });
    damageEnemy(w, a, 10);
    assert.equal(a.status.bleedT, 0);
    const b = makeEnemy({ hp: 100 });
    damageEnemy(w, b, 10, { crit: true });
    assert.equal(b.status.bleedT, 4);
    assert.ok(near(b.status.bleedDps, 1), "10 * 0.4 / 4");
  });

  test("tags do not land on the hit that kills the target", () => {
    const w = fresh();
    w.stats = { burnPct: 0.5, slowPct: 0.3, freezeEvery: 1 };
    const e = makeEnemy({ hp: 5 });
    damageEnemy(w, e, 10);
    assert.equal(e.dead, true);
    assert.equal(e.status.burnT, 0);
    assert.equal(e.status.slowT, 0);
    assert.equal(e.status.frozenT, 0);
  });

  test("a dying burning enemy spreads its burn to living neighbours within 2.5", () => {
    const w = fresh();
    w.stats = { burnSpread: true };
    const dying = makeEnemy({ x: 0, z: 0, hp: 5 });
    const near1 = makeEnemy({ x: 1.5, z: 0 });
    const far = makeEnemy({ x: 4, z: 0 });
    const corpse = makeEnemy({ x: 0.5, z: 0.5, dead: true });
    w.enemies.push(dying, near1, far, corpse);
    applyStatus(w, dying, { burn: { dps: 4, time: 3 } });
    damageEnemy(w, dying, 10);
    assert.equal(near1.status.burnT, 3);
    assert.equal(near1.status.burnDps, 4);
    assert.equal(far.status, undefined, "out of range");
    assert.equal(corpse.status, undefined, "dead neighbours are skipped");
    assert.equal(dying.status.burnT, 3, "the dying enemy does not re-apply to itself");
  });

  test("no burn spread when the dying enemy was not burning or the stat is off", () => {
    const w = fresh();
    w.stats = { burnSpread: true };
    const cold = makeEnemy({ x: 0, hp: 5 });
    const neighbour = makeEnemy({ x: 1 });
    w.enemies.push(cold, neighbour);
    damageEnemy(w, cold, 10);
    assert.equal(neighbour.status, undefined);

    w.stats = {};
    const burning = makeEnemy({ x: 0, hp: 5 });
    const other = makeEnemy({ x: 1 });
    w.enemies.push(burning, other);
    applyStatus(w, burning, { burn: { dps: 4, time: 3 } });
    damageEnemy(w, burning, 10);
    assert.equal(other.status, undefined, "burnSpread stat is off");
  });

  test("floating number height uses enemy.height when set and falls back otherwise", () => {
    const w = fresh();
    damageEnemy(w, makeEnemy({ height: 2 }), 1);
    damageEnemy(w, makeEnemy(), 1);
    assert.equal(w.fx.number.calls[0][1], 2.2);
    assert.equal(w.fx.number.calls[1][1], 0.7 + 0.2);
  });

  test("a DoT that kills a boss emits both death events through tickStatus", () => {
    const w = fresh();
    const e = makeEnemy({ hp: 2, boss: true });
    const deaths = spy(), bossDeaths = spy();
    w.events.on("enemy:death", deaths);
    w.events.on("boss:death", bossDeaths);
    applyStatus(w, e, { burn: { dps: 4, time: 1 } });
    for (let i = 0; i < 4; i++) tickStatus(w, e, 0.125);
    assert.equal(e.dead, true);
    assert.equal(deaths.calls.length, 1);
    assert.equal(bossDeaths.calls.length, 1);
    tickStatus(w, e, 0.125);
    assert.equal(deaths.calls.length, 1, "a dead enemy is not ticked again");
  });
});

// ---------------------------------------------------------------------------
// damagePlayer
// ---------------------------------------------------------------------------

describe("damagePlayer", () => {
  test("returns 0 and changes nothing when there is no live, vulnerable player or no damage", () => {
    const none = makeWorld();
    assert.equal(damagePlayer(none, 5), 0);

    const w = fresh();
    const hits = spy();
    w.events.on("player:hit", hits);
    w.player.dead = true;
    assert.equal(damagePlayer(w, 5), 0);
    w.player.dead = false;
    w.player.invuln = 0.2;
    assert.equal(damagePlayer(w, 5), 0);
    w.player.invuln = 0;
    assert.equal(damagePlayer(w, 0), 0);
    assert.equal(damagePlayer(w, -2), 0);
    assert.equal(w.player.hp, 100);
    assert.equal(hits.calls.length, 0);
  });

  test("a small hit reduces hp, shakes, flashes and emits player:hit with the source", () => {
    const w = fresh();
    const hits = spy();
    w.events.on("player:hit", hits);
    assert.equal(damagePlayer(w, 3, "Bat"), 3);
    assert.equal(w.player.hp, 97);
    assert.equal(w.player.invuln, 0, "hits under 5 give no invulnerability");
    assert.deepEqual(w.shake.calls, [[0.2]]);
    assert.deepEqual(w.audio.play.calls, [["hurt"]]);
    assert.deepEqual(w.fx.number.calls[0].slice(3), ["3", COLORS.danger]);
    assert.equal(w.fx.flash.calls[0][0], w.player.group);
    assert.equal(hits.calls[0][0].amount, 3);
    assert.equal(hits.calls[0][0].source, "Bat");
  });

  test("sub-1 damage still reduces hp but gives no feedback or event", () => {
    const w = fresh();
    const hits = spy();
    w.events.on("player:hit", hits);
    assert.equal(damagePlayer(w, 0.5), 0.5);
    assert.equal(w.player.hp, 99.5);
    assert.equal(w.shake.calls.length, 0);
    assert.equal(w.audio.play.calls.length, 0);
    assert.equal(hits.calls.length, 0);
  });

  test("a hit of 5 or more opens a short invulnerability window that blocks the next hit", () => {
    const w = fresh();
    assert.equal(damagePlayer(w, 6), 6);
    assert.equal(w.player.hp, 94);
    assert.equal(w.player.invuln, 0.4);
    assert.equal(damagePlayer(w, 6), 0, "still invulnerable");
    assert.equal(w.player.hp, 94);
  });

  test("shield soaks damage before hp, and a shield bigger than the hit absorbs it fully", () => {
    const w = fresh();
    w.player.shield = 4;
    assert.equal(damagePlayer(w, 10), 10);
    assert.equal(w.player.shield, 0);
    assert.equal(w.player.hp, 94);

    w.player.invuln = 0;
    w.player.hp = 100;
    w.player.shield = 20;
    assert.equal(damagePlayer(w, 6), 6);
    assert.equal(w.player.shield, 14);
    assert.equal(w.player.hp, 100);
  });

  test("lethal damage kills the player, emits player:death with the killer and stops time briefly", () => {
    const w = fresh();
    w.player.hp = 4;
    const deaths = spy();
    w.events.on("player:death", deaths);
    assert.equal(damagePlayer(w, 10, "Ogre"), 10);
    assert.equal(w.player.hp, 0);
    assert.equal(w.player.dead, true);
    assert.equal(deaths.calls.length, 1);
    assert.equal(deaths.calls[0][0].killer, "Ogre");
    assert.ok(w.audio.play.calls.some(c => c[0] === "death"));
    assert.deepEqual(w.hitStop.calls, [[0.12]]);
    assert.equal(w.fx.burst.calls.at(-1)[4], 30);
  });

  test("defaults the source name to Something", () => {
    const w = fresh();
    const hits = spy();
    w.events.on("player:hit", hits);
    damagePlayer(w, 3);
    assert.equal(hits.calls[0][0].source, "Something");
  });

  test("works without audio or fx attached, including on death", () => {
    const w = fresh();
    w.audio = null;
    w.fx = null;
    assert.equal(damagePlayer(w, 3), 3);
    assert.equal(w.player.hp, 97);
    const deaths = spy();
    w.events.on("player:death", deaths);
    w.player.hp = 4;
    assert.equal(damagePlayer(w, 5, "X"), 5);
    assert.equal(w.player.dead, true);
    assert.equal(deaths.calls[0][0].killer, "X");
  });
});

// ---------------------------------------------------------------------------
// Status effects
// ---------------------------------------------------------------------------

describe("applyStatus", () => {
  test("ignores missing and dead enemies without creating status", () => {
    const w = fresh();
    assert.equal(applyStatus(w, null, { burn: { dps: 1, time: 1 } }), undefined);
    const dead = makeEnemy({ dead: true });
    applyStatus(w, dead, { burn: { dps: 1, time: 1 } });
    assert.equal(dead.status, undefined);
    assert.equal(w.fx.burst.calls.length, 0);
  });

  test("burn keeps the longer duration and the stronger dps while it runs, and resets after it ends", () => {
    const w = fresh();
    const e = makeEnemy();
    applyStatus(w, e, { burn: { dps: 3, time: 2 } });
    assert.equal(e.status.burnT, 2);
    assert.equal(e.status.burnDps, 3);
    applyStatus(w, e, { burn: { dps: 1, time: 1 } });
    assert.equal(e.status.burnT, 2, "shorter reapply does not shorten");
    assert.equal(e.status.burnDps, 3, "weaker reapply does not weaken");
    applyStatus(w, e, { burn: { dps: 1, time: 5 } });
    assert.equal(e.status.burnT, 5, "longer reapply extends");
    assert.equal(e.status.burnDps, 3);
    e.status.burnT = 0;
    applyStatus(w, e, { burn: { dps: 1 } });
    assert.equal(e.status.burnDps, 1, "a fresh burn takes the new dps");
    assert.equal(e.status.burnT, 3, "time defaults to 3 seconds");
  });

  test("a burn with no dps does nothing to damage per second", () => {
    const w = fresh();
    const e = makeEnemy();
    applyStatus(w, e, { burn: { time: 1 } });
    assert.equal(e.status.burnDps, 0);
    assert.equal(e.status.burnT, 1);
  });

  test("slow defaults to 20 percent and keeps the stronger active slow", () => {
    const w = fresh();
    const e = makeEnemy();
    applyStatus(w, e, { slow: { time: 1 } });
    assert.equal(e.status.slowPct, 0.2);
    assert.equal(e.status.slowT, 1);
    assert.ok(near(e.speedMul, 0.8));
    applyStatus(w, e, { slow: { pct: 0.5, time: 0.5 } });
    assert.equal(e.status.slowPct, 0.5);
    assert.equal(e.status.slowT, 1);
    assert.ok(near(e.speedMul, 0.5));
    applyStatus(w, e, { slow: { pct: 0.1 } });
    assert.equal(e.status.slowPct, 0.5, "weaker slow does not replace a stronger active one");
    assert.equal(e.status.slowT, 2, "time defaults to 2 seconds");
    e.status.slowT = 0;
    applyStatus(w, e, { slow: { pct: 0.1 } });
    assert.equal(e.status.slowPct, 0.1, "expired slow is replaced");
    assert.ok(near(e.speedMul, 0.9));
  });

  test("bleed keeps the stronger dps and the longer duration, and defaults to 4 seconds", () => {
    const w = fresh();
    const e = makeEnemy();
    applyStatus(w, e, { bleed: { dps: 2, time: 1 } });
    assert.equal(e.status.bleedDps, 2);
    assert.equal(e.status.bleedT, 1);
    applyStatus(w, e, { bleed: { dps: 1 } });
    assert.equal(e.status.bleedDps, 2);
    assert.equal(e.status.bleedT, 4);
    e.status.bleedT = 0;
    applyStatus(w, e, { bleed: { dps: 1, time: 1 } });
    assert.equal(e.status.bleedDps, 1);
  });

  test("freeze and stun halve on bosses, stop movement and burst colour", () => {
    const w = fresh();
    const e = makeEnemy();
    applyStatus(w, e, { freeze: 2 });
    assert.equal(e.status.frozenT, 2);
    assert.equal(e.speedMul, 0);
    assert.deepEqual(w.fx.burst.calls.at(-1), [e.x, 0.5, e.z, 0x9fe8ff, 8, 2.2]);

    const boss = makeEnemy({ boss: true });
    applyStatus(w, boss, { freeze: 2 });
    assert.equal(boss.status.frozenT, 1, "boss freeze is half length");
    applyStatus(w, boss, { stun: { time: 3 } });
    assert.equal(boss.status.stunT, 1.5, "boss stun is half length");
    assert.equal(boss.speedMul, 0);
    assert.deepEqual(w.fx.burst.calls.at(-1).slice(3), [COLORS.gold, 6, 1.8]);
  });

  test("freeze and stun only ever extend, and accept number, t and duration forms", () => {
    const w = fresh();
    const e = makeEnemy();
    applyStatus(w, e, { freeze: { t: 1.5 } });
    assert.equal(e.status.frozenT, 1.5);
    applyStatus(w, e, { freeze: { duration: 2 } });
    assert.equal(e.status.frozenT, 2);
    applyStatus(w, e, { freeze: {} });
    assert.equal(e.status.frozenT, 2, "shorter reapply does not shorten");
    const f = makeEnemy();
    applyStatus(w, f, { freeze: {} });
    assert.equal(f.status.frozenT, 1, "freeze defaults to 1 second");
    applyStatus(w, f, { stun: 0.5 });
    assert.equal(f.status.stunT, 0.5);
  });

  test("statuses still apply and skip bursts when no fx is attached", () => {
    const w = fresh();
    w.fx = null;
    const e = makeEnemy();
    applyStatus(w, e, { freeze: 1, stun: 1 });
    assert.equal(e.status.frozenT, 1);
    assert.equal(e.status.stunT, 1);
    assert.equal(e.speedMul, 0);
  });
});

describe("tickStatus", () => {
  test("does nothing to a dead enemy", () => {
    const w = fresh();
    const e = makeEnemy({ dead: true });
    tickStatus(w, e, 0.5);
    assert.equal(e.status, undefined);
  });

  test("burn damage is applied in chunks of dps times 0.5 seconds", () => {
    const w = fresh();
    const e = makeEnemy({ hp: 50 });
    const hits = spy();
    w.events.on("enemy:hit", hits);
    applyStatus(w, e, { burn: { dps: 4, time: 1 } });
    for (let i = 0; i < 3; i++) tickStatus(w, e, 0.125);
    assert.equal(e.hp, 50, "no chunk yet");
    tickStatus(w, e, 0.125);
    assert.equal(e.hp, 48, "fourth tick flushes two damage");
    for (let i = 0; i < 4; i++) tickStatus(w, e, 0.125);
    assert.equal(e.hp, 46, "second chunk after the burn timer runs out");
    assert.equal(e.status.burnT, 0);
    tickStatus(w, e, 0.125);
    assert.equal(e.hp, 46, "no damage once the burn is over");
    assert.equal(e.speedMul, 1);
    assert.deepEqual(hits.calls.map(c => c[0].amount), [2, 2]);
  });

  test("leftover burn damage is flushed when the last burn timer runs out", () => {
    const w = fresh();
    const e = makeEnemy({ hp: 50 });
    applyStatus(w, e, { burn: { dps: 4, time: 0.25 } });
    tickStatus(w, e, 0.125);
    assert.equal(e.hp, 50, "timer still running, chunk not full");
    tickStatus(w, e, 0.125);
    assert.equal(e.hp, 49, "timer ended with 1 damage banked, so it flushes");
    tickStatus(w, e, 0.125);
    assert.equal(e.hp, 49);
  });

  test("a sliver of banked damage under half a unit is dropped when the timers end", () => {
    const w = fresh();
    const e = makeEnemy({ hp: 50 });
    applyStatus(w, e, { burn: { dps: 4, time: 0.125 } });
    tickStatus(w, e, 0.125);
    assert.equal(e.hp, 50, "0.5 banked is not flushed");
    tickStatus(w, e, 0.125);
    assert.equal(e.hp, 50);
    assert.equal(e.status.dotAcc, 0);
  });

  test("dot numbers take the danger colour for bleed alone and ember otherwise", () => {
    const w = fresh();
    const bleeder = makeEnemy({ hp: 50 });
    applyStatus(w, bleeder, { bleed: { dps: 4, time: 1 } });
    for (let i = 0; i < 4; i++) tickStatus(w, bleeder, 0.125);
    assert.equal(bleeder.hp, 48);
    assert.equal(w.fx.number.calls.at(-1)[4], COLORS.danger);

    const both = makeEnemy({ hp: 50 });
    applyStatus(w, both, { burn: { dps: 4, time: 1 }, bleed: { dps: 4, time: 1 } });
    for (let i = 0; i < 4; i++) tickStatus(w, both, 0.125);
    assert.equal(w.fx.number.calls.at(-1)[4], COLORS.ember, "burn active makes it ember");

    const burner = makeEnemy({ hp: 50 });
    applyStatus(w, burner, { burn: { dps: 4, time: 1 } });
    for (let i = 0; i < 4; i++) tickStatus(w, burner, 0.125);
    assert.equal(w.fx.number.calls.at(-1)[4], COLORS.ember, "burn alone is ember");
  });

  test("slow expires and restores speed on the tick its timer runs out", () => {
    const w = fresh();
    const e = makeEnemy();
    applyStatus(w, e, { slow: { pct: 0.5, time: 0.25 } });
    assert.equal(e.speedMul, 0.5);
    tickStatus(w, e, 0.125);
    assert.equal(e.speedMul, 0.5);
    tickStatus(w, e, 0.125);
    assert.equal(e.status.slowT, 0);
    assert.equal(e.speedMul, 1);
  });

  test("frozen and stunned enemies stand still until their timers run out", () => {
    const w = fresh();
    const e = makeEnemy();
    applyStatus(w, e, { freeze: 0.25 });
    tickStatus(w, e, 0.125);
    assert.equal(e.status.frozenT, 0.125);
    assert.equal(e.speedMul, 0);
    assert.ok(w.fx.burst.calls.some(c => c[3] === 0x9fe8ff), "frozen puff uses ice colour");
    tickStatus(w, e, 0.125);
    assert.equal(e.speedMul, 1);

    applyStatus(w, e, { stun: 0.125 });
    assert.equal(e.speedMul, 0);
    tickStatus(w, e, 0.125);
    assert.equal(e.status.stunT, 0);
    assert.equal(e.speedMul, 1);
    assert.ok(w.fx.burst.calls.some(c => c[3] === COLORS.gold && c[4] === 1), "stun puff");
  });

  test("a slowed and frozen enemy is at speed zero, and frozen wins over slow", () => {
    const w = fresh();
    const e = makeEnemy();
    applyStatus(w, e, { slow: { pct: 0.5, time: 2 }, freeze: 1 });
    tickStatus(w, e, 0.125);
    assert.equal(e.speedMul, 0);
  });

  test("status ticks still work with no fx attached", () => {
    const w = fresh();
    w.fx = null;
    const e = makeEnemy({ hp: 50 });
    applyStatus(w, e, { burn: { dps: 4, time: 1 }, freeze: 1, stun: 1 });
    for (let i = 0; i < 4; i++) tickStatus(w, e, 0.125);
    assert.equal(e.hp, 48);
    assert.equal(e.speedMul, 0);
  });

  test("the first tick always puffs, and puffs repeat every 0.22 seconds", () => {
    const w = fresh();
    const e = makeEnemy({ hp: 50 });
    applyStatus(w, e, { burn: { dps: 0, time: 1 } });
    tickStatus(w, e, 0.125);
    const first = w.fx.burst.calls.length;
    assert.equal(first, 1, "first tick puffs");
    tickStatus(w, e, 0.125);
    assert.equal(w.fx.burst.calls.length, first, "no puff within 0.22 seconds");
    tickStatus(w, e, 0.125);
    assert.equal(w.fx.burst.calls.length, first + 1, "puff again after 0.22 seconds");
  });
});

// ---------------------------------------------------------------------------
// Telegraphs
// ---------------------------------------------------------------------------

describe("spawnTelegraph", () => {
  test("uses circle defaults, registers itself in the world and plays a windup sound", () => {
    const w = fresh();
    const t = tele(w, { x: 2, z: -1 });
    assert.equal(t.shape, "circle");
    assert.equal(t.radius, 1);
    assert.equal(t.length, 3);
    assert.equal(t.width, 0.8);
    assert.equal(t.arc, Math.PI / 2);
    assert.equal(t.windup, 0.6);
    assert.equal(t.damage, 10);
    assert.equal(t.sourceName, "Something");
    assert.equal(t.onResolve, null);
    assert.equal(t.resolved, false);
    assert.equal(t.progress, 0);
    assert.equal(w.telegraphs.length, 1);
    assert.equal(w.telegraphs[0], t);
    assert.equal(t.group.parent, w.root);
    assert.equal(t.group.position.x, 2);
    assert.equal(t.group.position.z, -1);
    assert.equal(t.group.rotation.y, 0);
    assert.deepEqual(w.audio.play.calls, [["windup"]]);
  });

  test("windup is clamped to at least 0.05 seconds", () => {
    const w = fresh();
    assert.equal(tele(w, { windup: 0 }).windup, 0.05);
  });

  test("explicit options are kept and no windup sound plays without audio", () => {
    const w = fresh();
    w.audio = null;
    const onResolve = spy();
    const t = tele(w, {
      shape: "cone", x: 1, z: 2, angle: 0.7, radius: 4, arc: 1.2, windup: 0.9,
      damage: 3, sourceName: "Goblin", onResolve,
    });
    assert.equal(t.shape, "cone");
    assert.equal(t.angle, 0.7);
    assert.equal(t.radius, 4);
    assert.equal(t.arc, 1.2);
    assert.equal(t.windup, 0.9);
    assert.equal(t.damage, 3);
    assert.equal(t.sourceName, "Goblin");
    assert.equal(t.onResolve, onResolve);
    assert.equal(t.group.rotation.y, 0.7);
  });

  test("each shape gets its own outline geometry, and rotation follows the angle only for non-circles", () => {
    const w = fresh();
    const bbox = (t) => { const g = t.group.children[2].geometry; g.computeBoundingBox(); return g.boundingBox; };
    const c = tele(w, { shape: "circle", radius: 2, angle: 1 });
    const l = tele(w, { shape: "line", length: 4, width: 1, angle: 0.5 });
    const k = tele(w, { shape: "cone", radius: 3, arc: Math.PI, angle: 0 });
    assert.ok(Math.abs(bbox(c).max.x - 2) < 0.1, "circle reaches its radius");
    assert.ok(Math.abs(bbox(l).max.z - 4) < 0.1, "line extends its length along +z");
    assert.ok(Math.abs(bbox(l).min.z) < 0.1);
    assert.ok(Math.abs(bbox(k).max.z - 3) < 0.1, "cone reaches its radius along +z");
    assert.ok(Math.abs(bbox(k).max.x - 3) < 0.1, "half-circle cone spans to the side");
    assert.equal(c.group.rotation.y, 0, "circles ignore angle");
    assert.equal(l.group.rotation.y, 0.5);
    assert.equal(k.group.rotation.y, 0);
  });

  test("a zero-length line still yields a finite outline", () => {
    const w = fresh();
    const t = tele(w, { shape: "line", length: 0 });
    const arr = t.group.children[2].geometry.attributes.position.array;
    assert.ok(arr.length > 0);
    assert.ok(Array.from(arr).every(Number.isFinite));
  });

  test("windup scales the fill in, resolves exactly at completion, and reports a miss", () => {
    const w = fresh({ withPlayer: true });
    w.player.x = 50;
    const onResolve = spy();
    const t = tele(w, { x: 0, z: 0, radius: 1, windup: 0.5, onResolve });
    t.update(w, 0.25);
    assert.equal(t.progress, 0.5);
    assert.equal(t.resolved, false);
    assert.equal(t.group.children[1].scale.x, 0.5, "fill grows with progress");
    assert.equal(onResolve.calls.length, 0);
    t.update(w, 0.25);
    assert.equal(t.resolved, true);
    assert.equal(onResolve.calls.length, 1);
    assert.equal(onResolve.calls[0][0], w);
    assert.equal(onResolve.calls[0][1], false);
    assert.equal(w.player.hp, 100);
    assert.equal(t.group.children[1].scale.x, 1, "fill snaps to full on resolve");
  });

  test("a circle hits anyone within its radius plus the player's radius", () => {
    const w = fresh();
    w.player.x = 1.25;
    const onResolve = spy();
    const t = tele(w, { radius: 1, windup: 0.1, damage: 10, onResolve });
    t.update(w, 0.1);
    assert.equal(w.player.hp, 90, "edge of the pad counts as a hit");
    assert.equal(onResolve.calls[0][1], true);
  });

  test("a circle misses a player just outside radius plus pad", () => {
    const w = fresh();
    w.player.x = 1.4;
    const onResolve = spy();
    tele(w, { radius: 1, windup: 0.1, damage: 10, onResolve }).update(w, 0.1);
    assert.equal(w.player.hp, 100);
    assert.equal(onResolve.calls[0][1], false);
  });

  test("a player without a radius uses a 0.3 pad", () => {
    const w = fresh();
    w.player.radius = undefined;
    w.player.x = 1.25;
    const onResolve = spy();
    tele(w, { radius: 1, windup: 0.1, damage: 4, onResolve }).update(w, 0.1);
    assert.equal(w.player.hp, 96);
    assert.equal(onResolve.calls[0][1], true);
  });

  test("a line hits along its length and across its width, and misses off to the side", () => {
    const w = fresh();
    const onResolve = spy();
    w.player.x = 0; w.player.z = 1.5;
    tele(w, { shape: "line", angle: 0, length: 3, width: 0.8, windup: 0.1, damage: 4, onResolve }).update(w, 0.1);
    assert.equal(w.player.hp, 96, "straight ahead is hit");
    assert.equal(onResolve.calls[0][1], true);

    const w2 = fresh();
    const onResolve2 = spy();
    w2.player.x = 0.9; w2.player.z = 1;
    tele(w2, { shape: "line", angle: 0, length: 3, width: 0.8, windup: 0.1, damage: 4, onResolve: onResolve2 }).update(w2, 0.1);
    assert.equal(w2.player.hp, 100, "beside the line is missed");
    assert.equal(onResolve2.calls[0][1], false);
  });

  test("a cone hits inside its arc and misses outside it", () => {
    const w = fresh();
    w.player.x = 0; w.player.z = 1;
    const a = spy();
    tele(w, { shape: "cone", angle: 0, radius: 2, arc: Math.PI / 2, windup: 0.1, damage: 3, onResolve: a }).update(w, 0.1);
    assert.equal(w.player.hp, 97);
    assert.equal(a.calls[0][1], true);

    const w2 = fresh();
    w2.player.x = -1.5; w2.player.z = 0.1;
    const b = spy();
    tele(w2, { shape: "cone", angle: 0, radius: 2, arc: Math.PI / 2, windup: 0.1, damage: 3, onResolve: b }).update(w2, 0.1);
    assert.equal(w2.player.hp, 100);
    assert.equal(b.calls[0][1], false);
  });

  test("resolution with no living player reports a miss and does not throw", () => {
    const none = makeWorld();
    const a = spy();
    tele(none, { windup: 0.1, onResolve: a }).update(none, 0.1);
    assert.equal(a.calls[0][1], false);

    const w = fresh();
    w.player.dead = true;
    const b = spy();
    tele(w, { windup: 0.1, onResolve: b }).update(w, 0.1);
    assert.equal(b.calls[0][1], false);
  });

  test("dodging inside a telegraph grants a shield up to the room shield amount when the item allows it", () => {
    const w = fresh();
    w.stats = { shieldOnDodge: true, roomShield: 0.2 };
    w.player.dodging = true;
    const onResolve = spy();
    tele(w, { radius: 1, windup: 0.1, damage: 10, onResolve }).update(w, 0.1);
    assert.equal(w.player.hp, 100, "the shield absorbs the whole hit");
    assert.equal(w.player.shield, 10, "shield set to 20 then reduced by 10");
    assert.equal(onResolve.calls[0][1], true);
    assert.ok(w.fx.number.calls.some(c => c[3] === "Shielded"));
  });

  test("dodge shield defaults to 15 percent, never lowers an existing shield, and needs the item flag", () => {
    const w = fresh();
    w.stats = { shieldOnDodge: true };
    w.player.dodging = true;
    tele(w, { radius: 1, windup: 0.1, damage: 10 }).update(w, 0.1);
    assert.equal(w.player.shield, 5, "15 percent of 100 is 15, minus 10 absorbed");

    const w2 = fresh();
    w2.stats = { shieldOnDodge: true, roomShield: 0.2 };
    w2.player.dodging = true;
    w2.player.shield = 30;
    tele(w2, { radius: 1, windup: 0.1, damage: 10 }).update(w2, 0.1);
    assert.equal(w2.player.shield, 20, "existing bigger shield is kept, then absorbs 10");

    const w3 = fresh();
    w3.stats = { roomShield: 0.2 };
    w3.player.dodging = true;
    tele(w3, { radius: 1, windup: 0.1, damage: 10 }).update(w3, 0.1);
    assert.equal(w3.player.shield, 0, "no shieldOnDodge flag means no shield");
    assert.equal(w3.player.hp, 90);
  });

  test("no dodge shield without dodging, without stats, or for a zero-damage telegraph", () => {
    const a = fresh();
    a.stats = { shieldOnDodge: true };
    tele(a, { radius: 1, windup: 0.1, damage: 10 }).update(a, 0.1);
    assert.equal(a.player.shield, 0);
    assert.equal(a.player.hp, 90);

    const b = fresh();
    b.stats = { shieldOnDodge: true };
    b.player.dodging = true;
    const onResolve = spy();
    tele(b, { radius: 1, windup: 0.1, damage: 0, onResolve }).update(b, 0.1);
    assert.equal(b.player.shield, 0, "zero damage never shields");
    assert.equal(onResolve.calls[0][1], true, "zero damage inside still counts as a hit");

    const c = fresh();
    c.stats = null;
    c.player.dodging = true;
    tele(c, { radius: 1, windup: 0.1, damage: 10 }).update(c, 0.1);
    assert.equal(c.player.shield, 0);
    assert.equal(c.player.hp, 90);
  });

  test("dodge shield still applies with no fx attached", () => {
    const w = fresh();
    w.fx = null;
    w.stats = { shieldOnDodge: true, roomShield: 0.2 };
    w.player.dodging = true;
    tele(w, { radius: 1, windup: 0.1, damage: 10 }).update(w, 0.1);
    assert.equal(w.player.shield, 10);
    assert.equal(w.player.hp, 100);
  });

  test("an invulnerable player inside a damaging telegraph is not hit", () => {
    const w = fresh();
    w.player.invuln = 0.3;
    const onResolve = spy();
    tele(w, { radius: 1, windup: 0.1, damage: 10, onResolve }).update(w, 0.1);
    assert.equal(w.player.hp, 100);
    assert.equal(onResolve.calls[0][1], false);
  });

  test("a zero-damage telegraph counts as a hit for anyone standing in it and bursts nothing", () => {
    const w = fresh();
    const onResolve = spy();
    tele(w, { radius: 1, windup: 0.1, damage: 0, onResolve }).update(w, 0.1);
    assert.equal(onResolve.calls[0][1], true);
    assert.equal(w.player.hp, 100);
    assert.equal(w.fx.burst.calls.length, 0, "no impact burst when nothing is dealt");
  });

  test("a damaging impact bursts 10 pieces for circles and 6 for other shapes", () => {
    const w = fresh();
    tele(w, { x: 3, z: 4, radius: 1, windup: 0.1, damage: 5 }).update(w, 0.1);
    const circleBurst = w.fx.burst.calls.at(-1);
    assert.deepEqual([circleBurst[0], circleBurst[1], circleBurst[2]], [3, 0.1, 4]);
    assert.equal(circleBurst[3], COLORS.danger);
    assert.equal(circleBurst[4], 10);

    tele(w, { shape: "line", x: 0, z: 0, windup: 0.1, damage: 5 }).update(w, 0.1);
    assert.equal(w.fx.burst.calls.at(-1)[4], 6);
  });

  test("impact burst is skipped with no fx attached", () => {
    const w = fresh();
    w.fx = null;
    const onResolve = spy();
    tele(w, { radius: 1, windup: 0.1, damage: 5, onResolve }).update(w, 0.1);
    assert.equal(onResolve.calls.length, 1);
  });

  test("the outline flickers between white and danger in the last quarter of the windup", () => {
    const w = fresh();
    const t = tele(w, { windup: 1 });
    const seen = new Set();
    for (let i = 0; i < 19; i++) {
      t.update(w, 0.05);
      if (t.progress > 0.75) seen.add(t.group.children[2].material.color.getHex());
    }
    assert.ok(seen.size >= 2, `saw ${seen.size} outline colours`);
  });

  test("telegraphs follow their position and, for non-circles, their angle", () => {
    const w = fresh();
    const line = tele(w, { shape: "line", angle: 0 });
    line.x = 3; line.z = -2; line.angle = 1.2;
    line.update(w, 0.01);
    assert.equal(line.group.position.x, 3);
    assert.equal(line.group.position.z, -2);
    assert.equal(line.group.rotation.y, 1.2);

    const circle = tele(w, { angle: 0 });
    circle.angle = 1.2;
    circle.update(w, 0.01);
    assert.equal(circle.group.rotation.y, 0);
  });

  test("after resolving, the telegraph fades and then marks itself dead", () => {
    const w = fresh();
    const t = tele(w, { radius: 1, windup: 0.1, damage: 0 });
    t.update(w, 0.1);
    assert.equal(t.resolved, true);
    t.update(w, 0.1);
    assert.equal(t.fade, 0.1);
    assert.equal(t.dead, false);
    t.update(w, 0.1);
    assert.equal(t.dead, true, "0.18 seconds of fade completes");
  });

  test("cancel stops a telegraph before it resolves and step removes it without a hit", () => {
    const w = fresh();
    const onResolve = spy();
    const t = tele(w, { radius: 1, windup: 0.2, damage: 10, onResolve });
    t.cancel();
    assert.equal(t.dead, true);
    t.update(w, 0.5);
    assert.equal(t.age, 0, "a cancelled telegraph does not age");
    assert.equal(onResolve.calls.length, 0);
    step(w, 0.2, 0.1);
    assert.equal(w.telegraphs.length, 0);
    assert.equal(t.group.parent, null);
    assert.equal(t.disposed, true);
  });

  test("a resolved telegraph is removed by step once its fade completes", () => {
    const w = fresh();
    const t = tele(w, { radius: 1, windup: 0.2, damage: 0 });
    step(w, 1, 0.1);
    assert.equal(t.resolved, true);
    assert.equal(w.telegraphs.length, 0);
    assert.equal(t.group.parent, null);
  });

  test("dispose removes the group once, is safe to repeat, and falls back to the spawn world", () => {
    const w = fresh();
    const a = tele(w, {});
    a.dispose(w);
    assert.equal(a.group.parent, null);
    assert.equal(a.disposed, true);
    a.dispose(w);

    const b = tele(w, {});
    assert.equal(b.group.parent, w.root);
    b.dispose();
    assert.equal(b.group.parent, null, "no argument uses the world the telegraph was spawned into");
  });
});

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

describe("spawnProjectile", () => {
  test("normalises the direction and moves at its speed each update", () => {
    const w = fresh();
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 0, dirZ: 3, speed: 4 });
    assert.equal(p.dirX, 0);
    assert.equal(p.dirZ, 1);
    assert.equal(w.projectiles[0], p);
    assert.equal(p.group.parent, w.root);
    p.update(w, 0.5);
    assert.equal(p.x, 0);
    assert.equal(p.z, 2);
    assert.equal(p.travelled, 2);
    assert.equal(p.group.position.z, 2);
  });

  test("uses the documented defaults for every optional field", () => {
    const w = fresh();
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0 });
    assert.equal(p.hostile, true);
    assert.equal(p.kind, "orb");
    assert.equal(p.radius, 0.2);
    assert.equal(p.speed, 5);
    assert.equal(p.damage, 8);
    assert.equal(p.range, 12);
    assert.equal(p.y, 0.7);
    assert.equal(p.sourceName, "Projectile");
    assert.equal(p.dead, false);
  });

  test("explicit fields override the defaults", () => {
    const w = fresh();
    const p = spawnProjectile(w, {
      x: 1, z: 2, dirX: 1, dirZ: 0, hostile: false, kind: "arrow", radius: 0.5,
      speed: 9, damage: 3, range: 2, y: 1.2, sourceName: "Ranger",
    });
    assert.equal(p.hostile, false);
    assert.equal(p.kind, "arrow");
    assert.equal(p.radius, 0.5);
    assert.equal(p.speed, 9);
    assert.equal(p.damage, 3);
    assert.equal(p.range, 2);
    assert.equal(p.y, 1.2);
    assert.equal(p.sourceName, "Ranger");
    assert.equal(p.group.children[0].position.y, 1.2, "body rides at the given height");
  });

  test("a zero direction does not move the projectile", () => {
    const w = fresh();
    const p = spawnProjectile(w, { x: 2, z: 2, dirX: 0, dirZ: 0 });
    p.update(w, 0.5);
    assert.equal(p.x, 2);
    assert.equal(p.z, 2);
    assert.equal(p.group.position.x, 2, "the drawn position stays put too");
  });

  test("arrows keep their facing and orbs spin while flying", () => {
    const w = fresh();
    const arrow = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, kind: "arrow", hostile: false });
    const body = arrow.group.children[0];
    const yaw = body.rotation.y;
    assert.ok(near(yaw, Math.PI / 2), "arrow faces +x");
    arrow.update(w, 0.1);
    assert.equal(body.rotation.y, yaw);

    const orb = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0 });
    const orbBody = orb.group.children[0];
    const orbYaw = orbBody.rotation.y;
    orb.update(w, 0.1);
    assert.ok(near(orbBody.rotation.y, orbYaw + 0.6), "orb spins at 6 rad/s");
  });

  test("fireballs build with both faction colours and keep the friendly kill colour", () => {
    const w = fresh();
    const hostile = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, kind: "fireball" });
    assert.equal(hostile.group.children[0].children.length, 3);
    hostile.kill();
    assert.equal(w.fx.burst.calls.at(-1)[3], COLORS.danger);

    const friendly = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, kind: "fireball", hostile: false });
    friendly.kill();
    assert.equal(w.fx.burst.calls.at(-1)[3], COLORS.ember);

    const magic = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, hostile: false });
    magic.kill();
    assert.equal(w.fx.burst.calls.at(-1)[3], COLORS.magic);
  });

  test("a dead projectile does not move again", () => {
    const w = fresh();
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4 });
    p.kill();
    p.update(w, 1);
    assert.equal(p.x, 0);
  });

  test("range expiry kills the projectile without a kill burst", () => {
    const w = fresh();
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, range: 1 });
    step(w, 0.5, 0.25);
    assert.equal(p.dead, true);
    assert.equal(p.x, 1);
    assert.equal(w.projectiles.length, 0);
    assert.equal(w.fx.burst.calls.filter(c => c[4] === 7).length, 0, "range expiry is silent");
  });

  for (const [name, x, z, dx, dz] of [
    ["east", 5.4, 0, 1, 0],
    ["west", -5.4, 0, -1, 0],
    ["north", 0, 4.4, 0, 1],
    ["south", 0, -4.4, 0, -1],
  ]) {
    test(`leaving the room to the ${name} kills the projectile`, () => {
      const w = fresh();
      const p = spawnProjectile(w, { x, z, dirX: dx, dirZ: dz, speed: 2, range: 100 });
      p.update(w, 0.1);
      assert.equal(p.dead, true);
    });
  }

  test("a projectile inside the room margin keeps flying", () => {
    const w = fresh();
    const p = spawnProjectile(w, { x: 4.9, z: 0, dirX: 1, dirZ: 0, speed: 2, range: 100 });
    p.update(w, 0.1);
    assert.equal(p.dead, false);
  });

  test("a solid obstacle stops a projectile with a burst", () => {
    const w = fresh();
    w.obstacles.push({ x: 1, z: 0, r: 0.5 });
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, radius: 0.2, range: 10 });
    p.update(w, 0.15);
    assert.equal(p.dead, true);
    assert.ok(w.fx.burst.calls.some(c => c[4] === 7), "obstacle hits burst");
  });

  test("an obstacle off the flight path does not stop a projectile", () => {
    const w = fresh();
    w.obstacles.push({ x: 1, z: 3, r: 0.5 });
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, radius: 0.2, range: 10 });
    p.update(w, 0.15);
    assert.equal(p.dead, false);
  });

  test("a hostile projectile damages the player on contact, emits player:hit and is consumed", () => {
    const w = fresh();
    w.player.x = 0.5;
    const hits = spy();
    w.events.on("player:hit", hits);
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, radius: 0.2, damage: 7, sourceName: "Archer", range: 10 });
    p.update(w, 0.1);
    assert.equal(w.player.hp, 93);
    assert.equal(p.dead, true);
    assert.equal(hits.calls[0][0].source, "Archer");
    assert.equal(hits.calls[0][0].amount, 7);
  });

  test("a hostile projectile passes through an invulnerable, dead, absent or distant player", () => {
    const invuln = fresh();
    invuln.player.x = 0.5;
    invuln.player.invuln = 0.3;
    const a = spawnProjectile(invuln, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, radius: 0.2, range: 10 });
    a.update(invuln, 0.1);
    assert.equal(invuln.player.hp, 100);
    assert.equal(a.dead, false);

    const dead = fresh();
    dead.player.x = 0.5;
    dead.player.dead = true;
    const b = spawnProjectile(dead, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, radius: 0.2, range: 10 });
    b.update(dead, 0.1);
    assert.equal(b.dead, false);

    const none = fresh({ withPlayer: false });
    const c = spawnProjectile(none, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, radius: 0.2, range: 10 });
    c.update(none, 0.1);
    assert.equal(c.dead, false);

    const far = fresh();
    far.player.x = 3;
    const d = spawnProjectile(far, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, radius: 0.2, range: 10 });
    d.update(far, 0.1);
    assert.equal(far.player.hp, 100);
    assert.equal(d.dead, false);
  });

  test("a friendly projectile damages a living enemy in reach and ignores the player", () => {
    const w = fresh();
    w.player.x = 0.3;
    const e = makeEnemy({ x: 1.4, z: 0, hp: 50 });
    w.enemies.push(e);
    const hits = spy();
    w.events.on("enemy:hit", hits);
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, radius: 0.2, damage: 12, hostile: false, kind: "fireball", range: 10 });
    p.update(w, 0.1);
    assert.equal(p.dead, false, "player at 0.3 is not a target for friendly shots");
    assert.equal(w.player.hp, 100);
    p.update(w, 0.3);
    assert.equal(e.hp, 38);
    assert.equal(p.dead, true);
    assert.equal(hits.calls[0][0].amount, 12);
  });

  test("friendly projectiles fall back to an enemy radius of 0.3 when none is given", () => {
    const w = fresh();
    const e = { x: 1.4, z: 0, hp: 20, dead: false, group: new THREE.Group() };
    w.enemies.push(e);
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, radius: 0.2, damage: 5, hostile: false, range: 10 });
    p.update(w, 0.3);
    assert.equal(e.hp, 15);
    assert.equal(p.dead, true);
  });

  test("friendly projectiles skip dead and distant enemies", () => {
    const w = fresh();
    const dead = makeEnemy({ x: 1.4, z: 0, dead: true });
    const far = makeEnemy({ x: 3, z: 0 });
    w.enemies.push(dead, far);
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, radius: 0.2, damage: 5, hostile: false, range: 10 });
    p.update(w, 0.1);
    assert.equal(p.dead, false);
    assert.equal(far.hp, 50);
  });

  test("a hostile projectile does not hurt enemies it passes over", () => {
    const w = fresh();
    const e = makeEnemy({ x: 0.4, z: 0 });
    w.enemies.push(e);
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 4, radius: 0.2, range: 10 });
    p.update(w, 0.1);
    assert.equal(e.hp, 50);
  });

  test("kill is idempotent, bursts in its colour by default and can be silent", () => {
    const w = fresh();
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, y: 0.7 });
    p.kill();
    assert.equal(p.dead, true);
    assert.deepEqual(w.fx.burst.calls.at(-1), [0, 0.7, 0, COLORS.danger, 7, 2.6]);
    const n = w.fx.burst.calls.length;
    p.kill();
    assert.equal(w.fx.burst.calls.length, n, "a second kill does nothing");

    const q = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0 });
    q.kill(w, false);
    assert.equal(q.dead, true);
    assert.equal(w.fx.burst.calls.length, n, "silent kill makes no burst");

    const r = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0 });
    w.fx = null;
    r.kill();
    assert.equal(r.dead, true, "kill without fx does not throw");
  });

  test("trail puffs are throttled to about one every 0.06 seconds and skipped without fx", () => {
    const w = fresh();
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 1, range: 100 });
    const before = w.fx.burst.calls.length;
    for (let i = 0; i < 20; i++) p.update(w, 0.01);
    const bursts = w.fx.burst.calls.length - before;
    assert.ok(bursts >= 3 && bursts <= 4, `trail puffs in 0.2s: ${bursts}`);

    const q = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0, speed: 1, range: 100 });
    w.fx = null;
    assert.doesNotThrow(() => q.update(w, 0.1));
    assert.ok(q.travelled > 0);
  });

  test("dispose removes the group once and is safe to repeat", () => {
    const w = fresh();
    const p = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0 });
    p.dispose(w);
    assert.equal(p.group.parent, null);
    assert.equal(p.disposed, true);
    assert.equal(p.dead, true);
    p.dispose(w);

    const q = spawnProjectile(w, { x: 0, z: 0, dirX: 1, dirZ: 0 });
    q.dispose();
    assert.equal(q.group.parent, null, "no argument uses the spawn world");
  });
});
