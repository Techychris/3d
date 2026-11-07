// Unit tests for src/game/player.js: movement, aiming, attacks, dodge, bash, heal, death, dispose.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeWorld, spy } from "./helpers.mjs";
import { createPlayer } from "../../src/game/player.js";
import { damagePlayer } from "../../src/game/combat.js";
import { computeStats } from "../../src/game/items.js";
import { ASSETS, COLORS } from "../../src/engine/assets.js";

const S = Math.SQRT1_2;
const near = (actual, expected, eps = 1e-6, what = "value") =>
  assert.ok(Math.abs(actual - expected) <= eps, `${what}: expected ${actual} to be within ${eps} of ${expected}`);

// A world with a player. `stats` replaces world.stats (pass null to remove them). No crits by default.
function setup({ stats, items = [] } = {}) {
  const world = makeWorld({ items });
  if (stats !== undefined) world.stats = stats;
  world.rng = () => 0.99;
  const player = createPlayer(world, "hero-warrior");
  world.player = player;
  return { world, player };
}

// One frame of the game loop: advance world time, then update the player.
function frame(world, player, dt, input = {}) {
  world.dt = dt;
  world.time += dt;
  player.update(world, dt, input);
}

function run(world, player, seconds, dt, input = {}) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) frame(world, player, dt, input);
}

// Frames until the predicate holds (bounded so a broken test fails instead of hanging).
function until(world, player, dt, input, done, max = 400) {
  for (let i = 0; i < max && !done(); i++) frame(world, player, dt, input);
  assert.ok(done(), "condition was not reached");
}

function enemyAt(world, x, z, over = {}) {
  const e = { x, z, hp: 50, maxHp: 50, radius: 0.3, group: new THREE.Group(), dead: false, name: "Bat", ...over };
  world.enemies.push(e);
  return e;
}

const bodyOf = (p) => p.group.children[0];          // animated body (lunge, tilt, squash)
const assetOf = (p) => bodyOf(p).children[0];       // the hero's asset group
const fxRootOf = (world) => world.root.children.find((c) => c.name === "player-fx");
const meshesOf = (group) => { const out = []; group.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
const swings = (world) => world.audio.play.calls.filter((c) => c[0] === "swing").length;
const slams = (world) => world.audio.play.calls.filter((c) => c[0] === "slam").length;
const wrapDispose = (obj) => { const orig = obj.dispose.bind(obj); obj.dispose = spy(orig); return obj.dispose; };

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

test("a new hero starts at the origin with full health and is registered in the world", () => {
  const { world, player } = setup();
  assert.equal(player.x, 0);
  assert.equal(player.z, 0);
  assert.equal(player.hp, 100);
  assert.equal(player.maxHp, 100);
  assert.equal(player.dead, false);
  assert.equal(player.dodging, false);
  assert.equal(player.slowMul, 1);
  assert.equal(player.skillMax, 7);
  assert.equal(player.group.name, "player");
  assert.equal(player.group.parent, world.root);
  assert.ok(fxRootOf(world), "effects root is added to the world");
});

test("max health and dodge cooldown come from the world stats", () => {
  const { player } = setup({ stats: { ...computeStats([], {}), maxHp: 130, dodgeCooldown: 0.5 } });
  assert.equal(player.maxHp, 130);
  assert.equal(player.hp, 130);
  assert.equal(player.dodgeMax, 0.5);
});

test("without world stats the hero falls back to 100 hp and a 0.8 s dodge cooldown", () => {
  const { player } = setup({ stats: null });
  assert.equal(player.maxHp, 100);
  assert.equal(player.dodgeMax, 0.8);
});

test("the default hero is the warrior and an explicit warrior id gives the same model", () => {
  const world = makeWorld();
  const implicit = createPlayer(world);
  const explicit = createPlayer(world, "hero-warrior");
  assert.equal(assetOf(implicit).name, "hero-warrior");
  assert.equal(assetOf(explicit).name, "hero-warrior");
  assert.equal(meshesOf(assetOf(implicit)).length, meshesOf(assetOf(explicit)).length);
});

test("every supported hero builds a model, can walk, and turns its own model", () => {
  for (const id of ["hero-warrior", "hero-mage", "hero-paladin", "hero-ranger", "hero-rogue"]) {
    const { world, player } = setup();
    const other = createPlayer(world, id);   // second hero in the same world, moved independently
    assert.equal(assetOf(other).name, id, `${id} model is used`);
    assert.ok(meshesOf(assetOf(other)).length > 0, `${id} has meshes`);
    run(world, other, 0.2, 0.1, { move: { x: 1, y: 0 } });
    assert.ok(other.x > 0 && other.z < 0, `${id} walks along the stick`);
    assert.equal(player.x, 0, "the first hero is not moved by the second");
  }
});

test("an unknown hero id is rejected", () => {
  const world = makeWorld();
  assert.throws(() => createPlayer(world, "hero-nobody"), /unknown asset hero-nobody/);
});

test("a hero whose meshes use several materials is ghosted, restored and disposed for every material", (t) => {
  const id = "hero-test-multi";
  ASSETS[id] = {
    meta: { id, name: "Multi", category: "hero", footprint: [0.8, 0.8], height: 1, flying: false },
    build(three) {
      const g = new three.Group(); g.name = id;
      const shadow = new three.Mesh(new three.CircleGeometry(0.3, 8), new three.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35 }));
      shadow.name = "shadow"; g.add(shadow);
      const body = new three.Mesh(new three.BoxGeometry(0.3, 0.5, 0.3), [
        new three.MeshStandardMaterial({ color: 0x9aa3ad }),
        new three.MeshStandardMaterial({ color: 0x5b636d }),
      ]);
      body.name = "body"; g.add(body);
      return g;
    },
  };
  t.after(() => { delete ASSETS[id]; });

  const world = makeWorld();
  const p = createPlayer(world, id);
  const [a, b] = meshesOf(assetOf(p)).find((m) => m.name === "body").material;
  frame(world, p, 0.05, { dodge: true });
  assert.equal(a.opacity, 0.35, "first material ghosts");
  assert.equal(b.opacity, 0.35, "second material ghosts");
  until(world, p, 0.05, {}, () => !p.dodging);
  assert.equal(a.opacity, 1);
  assert.equal(b.opacity, 1);
  assert.equal(a.transparent, false);
  const disposeA = wrapDispose(a), disposeB = wrapDispose(b);
  p.dispose(world);
  assert.equal(disposeA.calls.length, 1);
  assert.equal(disposeB.calls.length, 1);
});

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

test("walking at full stick moves the hero at its move speed along the screen-mapped direction", () => {
  const { world, player } = setup();
  frame(world, player, 0.1, { move: { x: 1, y: 0 } });
  near(player.x, 4.2 * 0.1 * S, 1e-9, "x");
  near(player.z, -4.2 * 0.1 * S, 1e-9, "z");
});

test("a half-pushed stick moves at half speed", () => {
  const { world, player } = setup();
  frame(world, player, 0.1, { move: { x: 0.5, y: 0 } });
  near(Math.hypot(player.x, player.z), 4.2 * 0.1 * 0.5, 1e-9, "distance");
});

test("a diagonal past the unit circle is clamped to full speed", () => {
  const { world, player } = setup();
  frame(world, player, 0.1, { move: { x: 1, y: 1 } });
  near(Math.hypot(player.x, player.z), 4.2 * 0.1, 1e-9, "distance");
});

test("a stick inside the dead zone does not move the hero", () => {
  const { world, player } = setup();
  frame(world, player, 0.1, { move: { x: 0.01, y: 0 } });
  assert.equal(player.x, 0);
  assert.equal(player.z, 0);
});

test("missing move and aim inputs leave the hero standing still", () => {
  const { world, player } = setup();
  frame(world, player, 0.1, {});
  frame(world, player, 0.1, { move: { x: 0, y: 0 }, aim: null });
  assert.equal(player.x, 0);
  assert.equal(player.z, 0);
  assert.equal(player.yaw, 0, "facing is unchanged without any direction");
});

test("the hero stays inside the room bounds", () => {
  const { world, player } = setup();
  run(world, player, 5, 0.05, { move: { x: 1, y: 0 } });
  assert.ok(player.x <= 5 - 0.3 + 1e-9, `x ${player.x}`);
  assert.ok(player.z >= -4 + 0.3 - 1e-9, `z ${player.z}`);
});

test("the hero is pushed out of solid obstacles and never enters them", () => {
  const { world, player } = setup();
  world.obstacles.push({ x: 0.5, z: -0.5, r: 0.5 });
  for (let i = 0; i < 80; i++) {
    frame(world, player, 0.05, { move: { x: 1, y: 0 } });
    const d = Math.hypot(player.x - 0.5, player.z + 0.5);
    assert.ok(d >= 0.8 - 1e-9, `frame ${i}: distance ${d} is less than obstacle radius plus hero radius`);
  }
});

test("slowMul applies for one frame and then resets to normal speed", () => {
  const { world, player } = setup();
  player.slowMul = 0.5;
  frame(world, player, 0.1, { move: { x: 1, y: 0 } });
  near(Math.hypot(player.x, player.z), 4.2 * 0.1 * 0.5, 1e-9, "slowed distance");
  assert.equal(player.slowMul, 1, "slowMul is reset after the frame");
  const before = Math.hypot(player.x, player.z);
  frame(world, player, 0.1, { move: { x: 1, y: 0 } });
  near(Math.hypot(player.x, player.z) - before, 4.2 * 0.1, 1e-9, "normal distance");
});

test("walking with world stats removed uses the stats captured at creation", () => {
  const { world, player } = setup();
  world.stats = null;
  frame(world, player, 0.1, { move: { x: 1, y: 0 } });
  near(Math.hypot(player.x, player.z), 4.2 * 0.1, 1e-9, "distance");
});

test("with no stats at creation or update the hero uses built-in defaults", () => {
  const walker = setup({ stats: null });
  frame(walker.world, walker.player, 0.1, { move: { x: 1, y: 0 } });
  near(Math.hypot(walker.player.x, walker.player.z), 4.2 * 0.1, 1e-9, "distance");

  const { world, player } = setup({ stats: null });
  const front = enemyAt(world, 0, 0.8);
  frame(world, player, 1 / 60, { attack: true });
  run(world, player, 0.2, 1 / 60);
  assert.equal(front.hp, 40, "default damage of 10");
});

test("the hero walks slower while a swing is in progress", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { move: { x: 1, y: 0 }, attack: true });   // movement is applied before the swing starts
  const afterSwingStart = Math.hypot(player.x, player.z);
  near(afterSwingStart, 4.2 * 0.05, 1e-9, "first frame has no swing yet");
  frame(world, player, 0.05, { move: { x: 1, y: 0 } });
  near(Math.hypot(player.x, player.z) - afterSwingStart, 4.2 * 0.05 * 0.8, 1e-9, "swing slows movement");
});

test("footstep dust appears while walking and not while standing", () => {
  const { world, player } = setup();
  const dust = () => world.fx.burst.calls.filter((c) => c[3] === 0x8a7a9a).length;
  run(world, player, 1, 1 / 60, {});
  assert.equal(dust(), 0, "standing still makes no dust");
  run(world, player, 1, 1 / 60, { move: { x: 1, y: 0 } });
  assert.ok(dust() >= 3, `walking makes dust (${dust()})`);
});

test("footsteps still work without an effects module", () => {
  const { world, player } = setup();
  world.fx = null;
  run(world, player, 0.5, 1 / 60, { move: { x: 1, y: 0 } });
  assert.ok(player.x > 0);
});

// ---------------------------------------------------------------------------
// Facing and aiming
// ---------------------------------------------------------------------------

test("facing follows the walking direction when there is no aim", () => {
  const { world, player } = setup();
  frame(world, player, 0.1, { move: { x: 1, y: 0 }, aim: null });
  near(player.yaw, 3 * Math.PI / 4, 1e-9, "yaw");
  frame(world, player, 0.1, {});
  near(player.yaw, 3 * Math.PI / 4, 1e-9, "yaw kept when standing");
});

test("aiming turns the hero without moving it", () => {
  const { world, player } = setup();
  frame(world, player, 0.1, { aim: { x: 1, y: 0 } });
  near(player.yaw, 3 * Math.PI / 4, 1e-9, "yaw");
  assert.equal(player.x, 0);
  assert.equal(player.z, 0);
});

test("aim overrides facing while movement still follows the stick", () => {
  const { world, player } = setup();
  frame(world, player, 0.1, { move: { x: 1, y: 0 }, aim: { x: 0, y: 1 } });
  near(player.yaw, -3 * Math.PI / 4, 1e-9, "facing comes from aim");
  near(player.x, 4.2 * 0.1 * S, 1e-9, "movement comes from the stick");
  near(player.z, -4.2 * 0.1 * S, 1e-9, "movement comes from the stick (z)");
});

test("a tiny aim vector is ignored and facing follows movement", () => {
  const { world, player } = setup();
  frame(world, player, 0.1, { move: { x: 0, y: 1 }, aim: { x: 0.01, y: 0 } });
  near(player.yaw, yawFor(0, 1), 1e-9, "yaw from movement");
});

function yawFor(mx, my) { // movement yaw, mirrored from the player's screen-to-world mapping
  return Math.atan2(mx * S - my * S, -mx * S - my * S);
}

test("the visual model eases toward the logical facing and follows the position", () => {
  const { world, player } = setup();
  frame(world, player, 0.1, { aim: { x: 0, y: 1 } });
  run(world, player, 1, 1 / 60, { aim: { x: 0, y: 1 } });
  near(player.group.rotation.y, player.yaw, 1e-3, "visual yaw");
  run(world, player, 0.5, 1 / 60, { move: { x: 1, y: 0 } });
  near(player.group.position.x, player.x, 1e-9, "group x");
  near(player.group.position.z, player.z, 1e-9, "group z");
});

// ---------------------------------------------------------------------------
// Melee attack
// ---------------------------------------------------------------------------

test("a swing lands after its hit point, not on the first frame", () => {
  const { world, player } = setup();
  const front = enemyAt(world, 0, 0.8);
  frame(world, player, 0.05, { attack: true });
  assert.equal(front.hp, 50, "no damage on the first frame");
  frame(world, player, 0.05, {});
  assert.equal(front.hp, 40, "damage lands at the hit point");
});

test("a swing hits foes in front and misses foes behind or out of reach", () => {
  const { world, player } = setup();
  const front = enemyAt(world, 0, 0.8);
  const behind = enemyAt(world, 0, -0.8);
  const wide = enemyAt(world, 1.0, 0.1);       // outside the 110 degree arc
  const far = enemyAt(world, 0, 2.0);           // beyond the reach
  const inside = enemyAt(world, 0.5, 0.5);      // inside the arc
  run(world, player, 0.3, 0.05, { attack: true });
  assert.equal(front.hp, 40);
  assert.equal(inside.hp, 40);
  assert.equal(behind.hp, 50);
  assert.equal(wide.hp, 50);
  assert.equal(far.hp, 50);
});

test("a swing reports each hit to the event bus", () => {
  const { world, player } = setup();
  const hits = spy();
  world.events.on("enemy:hit", hits);
  const front = enemyAt(world, 0, 0.8);
  run(world, player, 0.2, 0.05, { attack: true });
  assert.equal(hits.calls.length, 1);
  assert.equal(hits.calls[0][0].enemy, front);
  assert.equal(hits.calls[0][0].amount, 10);
  assert.equal(hits.calls[0][0].crit, false);
});

test("a critical swing multiplies damage by the crit multiplier", () => {
  const { world, player } = setup();
  world.rng = () => 0;                       // always below the crit chance
  const front = enemyAt(world, 0, 0.8);
  run(world, player, 0.2, 0.05, { attack: true });
  assert.equal(front.hp, 35, "10 damage x 1.5");
});

test("a custom crit multiplier is used when present", () => {
  const { world, player } = setup({ stats: { ...computeStats([], {}), critMult: 2 } });
  world.rng = () => 0;
  const front = enemyAt(world, 0, 0.8);
  run(world, player, 0.2, 0.05, { attack: true });
  assert.equal(front.hp, 30, "10 damage x 2");
});

test("a critical swing without a crit multiplier in the stats uses 1.5x", () => {
  const { world, player } = setup({ stats: { ...computeStats([], {}), critMult: undefined } });
  world.rng = () => 0;
  const front = enemyAt(world, 0, 0.8);
  run(world, player, 0.2, 0.05, { attack: true });
  assert.equal(front.hp, 35, "10 damage x 1.5 fallback");
});

test("a swing cannot crit when the stats give no crit chance", () => {
  const { world, player } = setup({ stats: { ...computeStats([], {}), critChance: undefined } });
  world.rng = () => 0;
  const front = enemyAt(world, 0, 0.8);
  run(world, player, 0.2, 0.05, { attack: true });
  assert.equal(front.hp, 40);
});

test("missing damage and attack rate stats fall back to 10 damage and 2.2 swings per second", () => {
  const { world, player } = setup({ stats: { maxHp: 100, moveSpeed: 4.2, dodgeCooldown: 0.8 } });
  const front = enemyAt(world, 0, 0.8);
  run(world, player, 0.2, 0.05, { attack: true });
  assert.equal(front.hp, 40);
  assert.equal(swings(world), 1);
  run(world, player, 1, 0.1, { attack: true });
  assert.equal(swings(world), 3, "held attack swings at 0.05, 0.6 and 1.1 s with the 2.2 per second fallback");
});

test("a held attack swings at the attack rate and the cooldown blocks early swings", () => {
  const { world, player } = setup();
  run(world, player, 1, 0.1, { attack: true });   // frames at 0.1 .. 1.0 s: swings at 0.1 s and 0.6 s
  assert.equal(swings(world), 2);
});

test("a faster attack rate shortens the swing cooldown", () => {
  const { world, player } = setup({ stats: { ...computeStats([], {}), attackRate: 4 } });
  frame(world, player, 0.1, { attack: true });
  run(world, player, 0.2, 0.1, { attack: true });
  assert.equal(swings(world), 1, "blocked at 0.2 s (cooldown 0.25 s)");
  run(world, player, 0.2, 0.1, { attack: true });
  assert.equal(swings(world), 2, "allowed again after 0.25 s");
});

test("a swing plays its sound, and still hits when there is no audio", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { attack: true });
  assert.equal(swings(world), 1);
  world.audio = null;
  const front = enemyAt(world, 0, 0.8);
  run(world, player, 0.5, 0.05, { attack: true });   // must not throw without audio
  assert.ok(front.hp < 50, "the swing still lands");
});

test("a swing shows and then hides its slash wedge", () => {
  const { world, player } = setup();
  const slash = fxRootOf(world).children[0];
  frame(world, player, 0.05, { attack: true });
  assert.equal(slash.visible, true);
  near(slash.material.opacity, 0.7 * (1 - 0.208333), 1e-3, "slash fades during the swing");
  run(world, player, 0.3, 0.05, {});
  assert.equal(slash.visible, false);
});

test("a swing lunges and tilts the body, which then settles back to rest", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { attack: true });
  assert.ok(bodyOf(player).rotation.x > 0, "tilted forward during the swing");
  run(world, player, 0.5, 0.05, {});
  near(bodyOf(player).rotation.x, 0, 1e-9, "tilt settles");
  near(bodyOf(player).position.z, 0, 1e-9, "lunge settles");
});

test("dead enemies and enemies without a radius are handled by the swing", () => {
  const { world, player } = setup();
  const corpse = enemyAt(world, 0, 0.8, { dead: true });
  const bare = enemyAt(world, 0, 0.6, { radius: undefined });
  run(world, player, 0.2, 0.05, { attack: true });
  assert.equal(corpse.hp, 50, "dead enemies are skipped");
  assert.equal(bare.hp, 40, "enemies without radius are still hit");
});

test("a swing keeps the arc it started with when the hero turns mid-swing", () => {
  const { world, player } = setup();
  const front = enemyAt(world, 0, 0.8);
  frame(world, player, 0.05, { attack: true });                    // swing aimed straight ahead (yaw 0)
  frame(world, player, 0.05, { aim: { x: -1, y: 0 } });            // turn away before the hit point
  assert.equal(player.yaw, -Math.PI / 4, "the hero did turn");
  assert.equal(front.hp, 40, "the hit still lands on the original arc");
});

// ---------------------------------------------------------------------------
// Dodge
// ---------------------------------------------------------------------------

test("a dodge carries the hero two units forward over 0.2 s", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { dodge: true });
  assert.equal(player.dodging, true);
  until(world, player, 0.05, {}, () => !player.dodging);
  near(player.x, 0, 1e-6, "x");
  near(player.z, 2, 1e-6, "z");
});

test("a dodge follows the walking direction when the hero is moving", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { dodge: true, move: { x: 1, y: 0 } });
  until(world, player, 0.05, {}, () => !player.dodging);
  near(player.x, 2 * S, 1e-6, "x");
  near(player.z, -2 * S, 1e-6, "z");
});

test("a dodge without walking follows the facing direction", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { aim: { x: -1, y: 0 } });   // face toward (-S, S)
  frame(world, player, 0.05, { dodge: true });
  until(world, player, 0.05, {}, () => !player.dodging);
  near(player.x, -2 * S, 1e-6, "x");
  near(player.z, 2 * S, 1e-6, "z");
});

test("the hero is invulnerable for 0.2 s after a dodge", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { dodge: true });
  assert.equal(player.invuln, 0.2);
  frame(world, player, 0.05, {});
  near(player.invuln, 0.15, 1e-9, "invuln counting down");
  assert.equal(damagePlayer(world, 10), 0, "hits are ignored while invulnerable");
  assert.equal(player.hp, 100);
  until(world, player, 0.05, {}, () => player.invuln === 0);
  assert.equal(damagePlayer(world, 10), 10, "hits land again afterwards");
  assert.equal(player.hp, 90);
});

test("the dodge cooldown blocks a second dodge until it has run out", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { dodge: true });
  assert.equal(player.dodgeCd, 0.8);
  run(world, player, 0.4, 0.05, {});
  const xBefore = player.x, zBefore = player.z;
  frame(world, player, 0.05, { dodge: true });
  assert.equal(player.dodging, false, "rejected while cooling down");
  assert.ok(player.dodgeCd > 0);
  assert.equal(player.x, xBefore, "a rejected dodge does not move the hero");
  assert.equal(player.z, zBefore);
  until(world, player, 0.05, {}, () => player.dodgeCd === 0);
  frame(world, player, 0.05, { dodge: true });
  assert.equal(player.dodging, true, "allowed again once cooled");
});

test("dodge input is ignored while a dodge is already running", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { dodge: true, move: { x: 1, y: 0 } });
  const yaw = player.yaw;
  frame(world, player, 0.05, { dodge: true, aim: { x: 0, y: 1 }, move: { x: 0, y: 0 } });
  assert.equal(player.yaw, yaw, "facing is locked during the dodge");
  assert.ok(player.x > 0 && player.z < 0, "still travelling the first dodge's direction");
});

test("the hero cannot act for a short recovery after a dodge ends", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { dodge: true });
  until(world, player, 0.05, {}, () => !player.dodging);
  const x = player.x;
  frame(world, player, 0.05, { move: { x: 1, y: 0 } });
  assert.equal(player.x, x, "no movement during recovery");
  until(world, player, 0.05, { move: { x: 1, y: 0 } }, () => player.x > x + 0.01);
  assert.ok(player.x > x, "movement resumes after recovery");
});

test("a dodge is not started while recovering", () => {
  const { world, player } = setup();
  player.dodgeCd = 0;
  frame(world, player, 0.05, { dodge: true });
  until(world, player, 0.05, {}, () => !player.dodging);
  player.dodgeCd = 0;
  frame(world, player, 0.05, { dodge: true });
  assert.equal(player.dodging, false, "recovery blocks the dodge");
});

test("a dodge plays a sound and throws dust when effects are present", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { dodge: true });
  assert.ok(world.audio.play.calls.some((c) => c[0] === "dodge"));
  assert.ok(world.fx.burst.calls.some((c) => c[3] === 0xa893b8), "dodge puff");
});

test("a dodge works without audio or effects", () => {
  const { world, player } = setup();
  world.audio = null;
  world.fx = null;
  frame(world, player, 0.05, { dodge: true });
  assert.equal(player.dodging, true);
  until(world, player, 0.05, {}, () => !player.dodging);
  assert.ok(player.z > 1.9, "dodge still travels");
});

test("a dodge ghosts the body and squashes it, then restores both", () => {
  const { world, player } = setup();
  const body = meshesOf(assetOf(player)).find((m) => m.name !== "shadow");
  frame(world, player, 0.05, { dodge: true });
  assert.equal(body.material.transparent, true);
  assert.equal(body.material.opacity, 0.35);
  near(bodyOf(player).scale.z, 1.3, 1e-9, "squash on z");
  until(world, player, 0.05, {}, () => !player.dodging);
  frame(world, player, 0.05, {});
  assert.equal(body.material.opacity, 1);
  assert.equal(body.material.transparent, false);
  near(bodyOf(player).scale.z, 1, 1e-9, "scale restored");
});

test("a dodge is drawn solid rather than as the hurt blink", () => {
  const { world, player } = setup();
  const asset = assetOf(player);
  player.invuln = 0.2;                                 // hurt blink, phase hidden
  frame(world, player, 0, {});
  assert.equal(asset.visible, false);
  frame(world, player, 0.05, { dodge: true });         // dodge also grants invulnerability
  assert.equal(player.dodging, true);
  assert.equal(asset.visible, true, "the dodge overrides the blink");
});

test("being hit makes the model blink while invulnerable", () => {
  const { world, player } = setup();
  const asset = assetOf(player);
  player.invuln = 0.2;                        // blink phase is even: hidden
  frame(world, player, 0, {});
  assert.equal(asset.visible, false);
  player.invuln = 0.15;                       // odd phase: shown
  frame(world, player, 0, {});
  assert.equal(asset.visible, true);
});

// ---------------------------------------------------------------------------
// Shield bash (skill)
// ---------------------------------------------------------------------------

test("the shield bash hits the cone in front for 1.5x damage, stuns and knocks back", () => {
  const { world, player } = setup();
  const front = enemyAt(world, 0, 0.8);
  frame(world, player, 0.05, { skill: true });
  assert.equal(front.hp, 35, "10 x 1.5");
  assert.equal(front.speedMul, 0, "stunned");
  near(front.z, 1.15, 1e-9, "pushed back by 0.35");
  assert.deepEqual(world.shake.calls[0], [0.12], "bash shakes the camera first");
  assert.ok(world.audio.play.calls.some((c) => c[0] === "slam"));
  assert.equal(player.skillCd, 7);
});

test("the bash lunges the body and shows its arc visual", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { skill: true });
  assert.ok(bodyOf(player).position.z > 0, "lunge forward");
  const bash = fxRootOf(world).children[1];
  assert.equal(bash.visible, true);
  run(world, player, 0.3, 0.05, {});
  assert.equal(bash.visible, false, "arc fades out after 0.28 s");
});

test("the bash ignores foes behind and dead foes, and does not knock back a foe it kills", () => {
  const { world, player } = setup();
  const behind = enemyAt(world, 0, -0.8);
  const corpse = enemyAt(world, 0, 0.6, { dead: true });
  const doomed = enemyAt(world, 0, 0.8, { hp: 10 });
  const deaths = spy();
  world.events.on("enemy:death", deaths);
  frame(world, player, 0.05, { skill: true });
  assert.equal(behind.hp, 50);
  assert.equal(corpse.hp, 50);
  assert.equal(corpse.speedMul, undefined, "corpse is not stunned");
  assert.equal(doomed.dead, true);
  assert.equal(doomed.z, 0.8, "no knockback once dead");
  assert.equal(deaths.calls.length, 1);
  assert.equal(deaths.calls[0][0].enemy, doomed);
});

test("the bash uses a default radius for foes that do not declare one, and still knocks them back", () => {
  const { world, player } = setup();
  const bare = enemyAt(world, 0.2, 0.6, { radius: undefined });
  frame(world, player, 0.05, { skill: true });
  assert.equal(bare.hp, 35, "hit by the bash");
  assert.ok(bare.z > 0.6, "pushed back from the hero");
});

test("the bash without an effects module still deflects projectiles", () => {
  const { world, player } = setup();
  world.fx = null;
  world.audio = null;
  const ball = { x: 0, z: 0.8, hostile: true, dead: false, kill: undefined };
  world.projectiles.push(ball);
  frame(world, player, 0.05, { skill: true });
  assert.equal(ball.dead, true);
});

test("the bash deflects hostile projectiles in the cone and leaves the rest alone", () => {
  const { world, player } = setup();
  const kill = spy();
  const a = { x: 0, z: 0.8, y: 1, hostile: true, radius: 0.2, dead: false, kill };
  const b = { x: 0.3, z: 0.6, hostile: true, dead: false };
  const friendly = { x: 0, z: 0.5, hostile: false, dead: false, kill: spy() };
  const gone = { x: 0, z: 0.5, hostile: true, dead: true, kill: spy() };
  const far = { x: 0, z: 3, hostile: true, dead: false, kill: spy() };
  world.projectiles.push(a, b, friendly, gone, far);
  frame(world, player, 0.05, { skill: true });
  assert.equal(kill.calls.length, 1, "orb with a kill method is killed once");
  assert.equal(kill.calls[0][0], world);
  assert.equal(kill.calls[0][1], true, "with a burst");
  assert.equal(b.dead, true, "orb without a kill method is marked dead");
  assert.equal(friendly.dead, false);
  assert.equal(friendly.kill.calls.length, 0);
  assert.equal(gone.kill.calls.length, 0);
  assert.equal(far.dead, false);
  assert.equal(far.kill.calls.length, 0);
  const magic = world.fx.burst.calls.filter((c) => c[3] === COLORS.magic && c[4] === 8);
  assert.deepEqual(magic.map((c) => c[1]), [1, 0.7], "burst height uses the projectile's y or 0.7");
});

test("the bash skill has a cooldown and the attack takes over while it recharges", () => {
  const { world, player } = setup();
  frame(world, player, 0.5, { skill: true });
  assert.equal(slams(world), 1);
  run(world, player, 3, 0.5, {});
  near(player.skillCd, 7 - 0.5 * 6, 1e-9, "cooldown counts down");
  frame(world, player, 0.5, { skill: true, attack: true });
  assert.equal(slams(world), 1, "skill still on cooldown");
  assert.ok(swings(world) >= 1, "attack goes through instead");
  until(world, player, 0.5, {}, () => player.skillCd === 0);
  frame(world, player, 0.5, { skill: true });
  assert.equal(slams(world), 2, "skill is available again");
});

test("the bash is not used during a dodge", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { dodge: true });
  frame(world, player, 0.05, { skill: true, attack: true });
  assert.equal(slams(world), 0);
  assert.equal(swings(world), 0);
});

test("a bash during a swing keeps the swing going", () => {
  const { world, player } = setup();
  const front = enemyAt(world, 0, 0.8);
  frame(world, player, 0.05, { attack: true });
  frame(world, player, 0.05, { skill: true });
  assert.ok(front.hp < 50, "both hits landed");
  assert.equal(fxRootOf(world).children[0].visible, true, "slash still shown");
});

test("the bash uses the default 10 damage when stats are empty", () => {
  const { world, player } = setup({ stats: {} });
  const front = enemyAt(world, 0, 0.8);
  frame(world, player, 0.05, { skill: true });
  assert.equal(front.hp, 35);
});

// ---------------------------------------------------------------------------
// Stat changes, timers and visuals
// ---------------------------------------------------------------------------

test("a max health increase adds the gained health, and a decrease clamps current health", () => {
  const { world, player } = setup();
  player.hp = 90;
  world.stats.maxHp = 120;
  frame(world, player, 0.05, {});
  assert.equal(player.maxHp, 120);
  assert.equal(player.hp, 110, "gaining 20 max hp heals 20");
  world.stats.maxHp = 80;
  frame(world, player, 0.05, {});
  assert.equal(player.maxHp, 80);
  assert.equal(player.hp, 80, "current hp is clamped to the new maximum");
});

test("dodge cooldown follows the stats, with 0.8 s as the fallback", () => {
  const { world, player } = setup({ stats: { ...computeStats([], {}), dodgeCooldown: 0.4 } });
  frame(world, player, 0.05, { dodge: true });
  assert.equal(player.dodgeCd, 0.4);
  assert.equal(player.dodgeMax, 0.4);
  const fallback = setup({ stats: {} });
  frame(fallback.world, fallback.player, 0.05, { dodge: true });
  assert.equal(fallback.player.dodgeCd, 0.8);
});

test("a hero without max health stats keeps 100 max health", () => {
  const { world, player } = setup({ stats: {} });
  frame(world, player, 0.05, {});
  assert.equal(player.maxHp, 100);
});

test("the attack and dodge timers tick down toward zero", () => {
  const { world, player } = setup();
  frame(world, player, 0.05, { attack: true, dodge: true });
  run(world, player, 2, 0.05, {});
  assert.equal(player.dodgeCd, 0);
  assert.equal(player.skillCd, 0);
  assert.equal(player.invuln, 0);
});

// ---------------------------------------------------------------------------
// Healing
// ---------------------------------------------------------------------------

test("heal restores health, is capped at the maximum and reports the amount", () => {
  const { world, player } = setup();
  const healed = spy();
  world.events.on("player:heal", healed);
  player.hp = 60;
  player.heal(15);
  assert.equal(player.hp, 75);
  assert.deepEqual(healed.calls[0][0], { amount: 15 });
  assert.deepEqual(world.fx.number.calls[0].slice(3), ["+15", COLORS.heal]);
  player.heal(100);
  assert.equal(player.hp, 100);
  assert.deepEqual(healed.calls[1][0], { amount: 25 });
  player.heal(10);
  assert.equal(player.hp, 100);
  assert.equal(healed.calls.length, 2, "a heal at full health is silent");
});

test("heal works without an effects module", () => {
  const { world, player } = setup();
  world.fx = null;
  player.hp = 50;
  player.heal(5);
  assert.equal(player.hp, 55);
});

// ---------------------------------------------------------------------------
// Death
// ---------------------------------------------------------------------------

test("lethal damage starts the death sequence, which ignores input and ends in a fall", () => {
  const { world, player } = setup();
  const died = spy();
  world.events.on("player:death", died);
  player.invuln = 0;
  assert.equal(damagePlayer(world, 200, "Skeleton"), 200);
  assert.equal(player.dead, true);
  assert.equal(player.hp, 0);
  assert.deepEqual(died.calls[0][0], { killer: "Skeleton" });
  assert.deepEqual(world.hitStop.calls, [[0.12]]);

  frame(world, player, 0.2, { move: { x: 1, y: 0 }, attack: true, dodge: true, skill: true });
  assert.equal(player.x, 0, "a dead hero does not move");
  assert.equal(swings(world), 0);
  assert.equal(world.audio.play.calls.some((c) => c[0] === "dodge"), false);
  near(bodyOf(player).rotation.x, -0.75, 1e-9, "half-fallen");
  near(bodyOf(player).position.y, -0.05, 1e-9, "sinking");

  run(world, player, 1, 0.1, {});
  near(bodyOf(player).rotation.x, -1.5, 1e-9, "fully fallen");
  near(bodyOf(player).position.y, -0.1, 1e-9, "fully sunk");
  assert.equal(assetOf(player).visible, true, "the body is shown while dying");
});

test("heal does nothing for a dead hero", () => {
  const { world, player } = setup();
  player.invuln = 0;
  damagePlayer(world, 500);
  player.heal(50);
  assert.equal(player.hp, 0);
});

test("dying mid-dodge restores the body's solid look", () => {
  const { world, player } = setup();
  const body = meshesOf(assetOf(player)).find((m) => m.name !== "shadow");
  frame(world, player, 0.05, { dodge: true });
  assert.equal(body.material.opacity, 0.35);
  player.invuln = 0;
  damagePlayer(world, 500);
  frame(world, player, 0.05, {});
  assert.equal(body.material.opacity, 1);
  assert.equal(body.material.transparent, false);
});

test("death without a dodge leaves the body's look alone", () => {
  const { world, player } = setup();
  const body = meshesOf(assetOf(player)).find((m) => m.name !== "shadow");
  player.invuln = 0;
  damagePlayer(world, 500);
  frame(world, player, 0.05, {});
  assert.equal(body.material.opacity, 1);
});

// ---------------------------------------------------------------------------
// Dispose
// ---------------------------------------------------------------------------

test("dispose removes the hero and its effects and frees the GPU resources", () => {
  const { world, player } = setup();
  const fxRoot = fxRootOf(world);
  const slash = fxRoot.children[0], bash = fxRoot.children[1];
  const freed = [wrapDispose(slash.geometry), wrapDispose(slash.material), wrapDispose(bash.geometry), wrapDispose(bash.material)];
  const bodyMeshesList = meshesOf(assetOf(player));
  const bodyFreed = bodyMeshesList.map((m) => wrapDispose(m.material));
  player.dispose(world);
  assert.equal(world.root.children.includes(player.group), false);
  assert.equal(world.root.children.includes(fxRoot), false);
  for (const d of freed) assert.equal(d.calls.length, 1);
  for (const d of bodyFreed) assert.equal(d.calls.length, 1);
});

test("dispose without a world argument uses the world the hero was created in", () => {
  const world = makeWorld();
  const player = createPlayer(world, "hero-rogue");
  assert.equal(world.root.children.includes(player.group), true);
  player.dispose();
  assert.equal(world.root.children.includes(player.group), false);
});
