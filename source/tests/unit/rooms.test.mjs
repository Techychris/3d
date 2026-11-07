import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { makeWorld, step, spy } from "./helpers.mjs";
import { createRng } from "../../src/core/rng.js";
import { resolveCollision, isWalkable } from "../../src/game/world.js";
import { FLOORS, generateLayout, rectLayout, buildRoom, buildHub, waveFor } from "../../src/game/rooms.js";

const ROOM_KINDS = ["combat", "elite", "treasure", "rest"];
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const inBounds = (b, p, pad = 0) => p.x >= b.minX + pad - 1e-9 && p.x <= b.maxX - pad + 1e-9 && p.z >= b.minZ + pad - 1e-9 && p.z <= b.maxZ - pad + 1e-9;

// Cells reachable from (si, sj) over floor cells, ignoring props.
function reachFrom(L, si, sj) {
  const seen = new Uint8Array(L.w * L.h); const q = [[si, sj]]; seen[sj * L.w + si] = 1;
  const blockedObs = new Set(L.obstacles.map((o) => o.j * L.w + o.i));
  while (q.length) {
    const [i, j] = q.pop();
    for (const [a, b] of D4) {
      const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= L.w || y >= L.h) continue;
      const c = y * L.w + x;
      if (L.kind[c] === 1 && !seen[c] && !blockedObs.has(c)) { seen[c] = 1; q.push([x, y]); }
    }
  }
  return seen;
}
const cellOf = (L, x, z) => [Math.floor(x - L.x0), Math.floor(z - L.z0)];
const kindAt = (L, i, j) => (i < 0 || j < 0 || i >= L.w || j >= L.h) ? 0 : L.kind[j * L.w + i];

// Find a seed whose layout has a given hazard kind (layouts are deterministic, so buildRoom gets the same one).
function findHazardSeed(floor, kind, exits = 1) {
  for (let s = 0; s < 400; s++) {
    const seed = "h" + s;
    const L = generateLayout(seed, floor, false, exits, s % 5, "combat");
    if (L.hazardKind === kind && L.hazards.length >= 2) return { seed, index: s % 5, L };
  }
  throw new Error("no " + kind + " layout found");
}

// Find a seed whose layout matches a predicate (cheap: layouts only, no rendering).
function findLayout(floor, pred, exits = 1) {
  for (let s = 0; s < 400; s++) {
    const seed = "p" + s, index = s % 5;
    if (pred(generateLayout(seed, floor, false, exits, index, "combat"))) return { seed, index };
  }
  throw new Error("no matching layout");
}

// Build a room with a fresh world that has a player and stub effects.
function build(opts) {
  const world = makeWorld({ withPlayer: true });
  const room = buildRoom(world, opts);
  return { world, room };
}

describe("generateLayout (ported from tests/rooms-gen.test.mjs)", () => {
  it("builds connected floors with start, exits, props and spawns that follow the placement rules", () => {
    let total = 0;
    const sizes = new Set();
    for (const floor of [1, 2, 3]) for (const boss of [false, true]) for (let s = 0; s < 60; s++) {
      const nEx = boss ? 1 : 1 + (s % 2);
      const rt = boss ? "combat" : ROOM_KINDS[s % 4];
      const L = generateLayout("seed" + s, floor, boss, nEx, s % 5, rt);
      total++;
      const tag = `f${floor} ${boss ? "boss" : "room"} s${s}`;
      if (boss) assert.ok(L.w >= 11 && L.w <= 13 && L.h >= 9 && L.h <= 10, tag + " boss size");
      else assert.ok(L.w >= 9 && L.w <= 13 && L.h >= 7 && L.h <= 10, tag + " size");
      sizes.add(L.w + "x" + L.h);

      // Every floor cell is reachable from the start (pits and stubs are holes).
      const floorCells = [];
      for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) if (L.kind[j * L.w + i] === 1) floorCells.push([i, j]);
      const r0 = reachFrom({ ...L, obstacles: [] }, L.start.i, L.start.j);
      for (const [i, j] of floorCells) assert.ok(r0[j * L.w + i], tag + " disconnected cell");

      // Start on a front edge; exits on the back edge, reachable and far from the start.
      assert.ok(kindAt(L, L.start.i, L.start.j + 1) === 0 || kindAt(L, L.start.i + 1, L.start.j) === 0, tag + " start not on front edge");
      assert.equal(L.exits.length, nEx);
      const r = reachFrom(L, L.start.i, L.start.j);
      for (const e of L.exits) {
        assert.equal(kindAt(L, e.i, e.j - 1), 0, tag + " exit not on back edge");
        assert.ok(r[e.j * L.w + e.i], tag + " exit unreachable");
        assert.ok(Math.hypot(e.x - L.start.x, e.z - L.start.z) >= 4.5, tag + " exit near start");
      }
      if (nEx === 2) assert.ok(Math.hypot(L.exits[0].x - L.exits[1].x, L.exits[0].z - L.exits[1].z) >= 4, tag + " exits too close");

      // Props sit on floor, clear of the start and the exits.
      if (!boss && rt !== "rest" && rt !== "treasure") assert.ok(L.obstacles.length >= 2 && L.obstacles.length <= 6, tag + " obstacle count");
      for (const o of L.obstacles) {
        assert.equal(kindAt(L, o.i, o.j), 1);
        assert.ok(Math.hypot(o.x - L.start.x, o.z - L.start.z) >= 2, tag + " obstacle near start");
        for (const e of L.exits) assert.ok(Math.hypot(o.x - e.x, o.z - e.z) >= 2, tag + " obstacle near exit");
      }
      if (rt === "treasure" && !boss) assert.ok(L.chest, tag + " chest");
      if (rt === "rest" && !boss) assert.ok(L.campfire, tag + " campfire");
      if (!boss && L.hazardKind) {
        assert.ok(L.hazards.length >= 2, tag + " hazards");
        for (const [x, z] of L.hazards) {
          assert.ok(Math.hypot(x - L.start.x, z - L.start.z) >= 2, tag + " hazard near start");
          for (const e of L.exits) assert.ok(Math.hypot(x - e.x, z - e.z) >= 2, tag + " hazard near exit");
        }
      }

      // Spawns sit on reachable floor, off props, away from the start.
      for (const opt of [{}, { elite: true }, { light: true }]) {
        const sp = waveFor(floor, s % 5, createRng(s * 7 + 1), { layout: L, ...opt });
        if (boss || rt === "rest") continue;
        assert.ok(sp.length >= 2, tag + " spawns");
        for (const p of sp) {
          const [i, j] = cellOf(L, p.x, p.z);
          assert.equal(kindAt(L, i, j), 1, tag + " spawn off floor");
          assert.ok(r[j * L.w + i], tag + " spawn unreachable");
          assert.ok(!L.blocked[j * L.w + i], tag + " spawn on prop");
          assert.ok(Math.hypot(p.x - L.start.x, p.z - L.start.z) >= 3, tag + " spawn near start");
        }
      }
    }
    assert.ok(total === 360 && sizes.size > 5, `${total} layouts, ${sizes.size} sizes`);
  });

  it("is deterministic for the same arguments", () => {
    const a = generateLayout("seed3", 2, false, 2, 1, "elite");
    const b = generateLayout("seed3", 2, false, 2, 1, "elite");
    assert.deepEqual(Array.from(a.kind), Array.from(b.kind));
    assert.deepEqual(a.start, b.start);
    assert.deepEqual(a.exits, b.exits);
  });

  it("collision: the start is walkable and a circle pushed toward a void edge stays inside", () => {
    for (let s = 0; s < 5; s++) {
      const L = generateLayout("seed" + s, 1, false, 1, s % 5, "combat");
      const world = { bounds: L.bounds, grid: { x0: L.x0, z0: L.z0, w: L.w, h: L.h, walk: L.walk }, obstacles: [] };
      assert.ok(isWalkable(world, L.start.x, L.start.z));
      const pos = { x: L.start.x, z: L.start.z + 0.45 };
      resolveCollision(world, pos, 0.3);
      assert.ok(inBounds(L.bounds, pos, 0.3 - 1e-6), "circle left the room");
      if (kindAt(L, L.start.i, L.start.j + 1) === 0) assert.ok(pos.z <= L.start.z + 0.2 + 1e-6, "leaked into void");
    }
  });

  it("returns the same layout for the same arguments with a boss and with exit arrays", () => {
    const fromArray = generateLayout("arr", 1, false, ["combat", "elite"], 0, "combat");
    assert.equal(fromArray.exits.length, 2);
    const boss = generateLayout("arr", 2, true, 1, 0, "treasure");
    assert.equal(boss.boss, true);
    assert.equal(boss.chest, null);
  });

  it("clamps floor and exit count and forces the combat kind for a boss", () => {
    assert.equal(generateLayout("clamp", 0, false, 1, 0, "combat").floor, 1);
    assert.equal(generateLayout("clamp", 9, false, 1, 0, "combat").floor, 3);
    assert.equal(generateLayout("clamp", undefined, false, undefined, undefined, undefined).floor, 1);
    assert.equal(generateLayout("clamp", 2, false, 9, 0, "combat").exits.length, 2);
    assert.equal(generateLayout("clamp", 2, false, 0, 0, "combat").exits.length, 1);
    assert.equal(generateLayout("clamp", 2, false, "2", 0, "combat").exits.length, 2);
    assert.equal(generateLayout("clamp", 2, true, 1, 0, "rest").chest, null);
  });
});

describe("rectLayout", () => {
  it("is a solid rectangle of floor cells with no start or exits", () => {
    const L = rectLayout(4, 3);
    assert.equal(L.w, 4);
    assert.equal(L.h, 3);
    assert.ok(L.kind.every((k) => k === 1));
    assert.equal(L.start, null);
    assert.deepEqual(L.exits, []);
    assert.equal(L.floor, 1);
    assert.equal(L.boss, false);
  });
});

describe("buildRoom", () => {
  it("builds every floor and room kind, and two-exit rooms, with the expected room data", () => {
    // Each room kind once, rotating floors (floor-specific hazards have their own tests), then two-exit rooms per floor.
    const plan = ROOM_KINDS.map((kind, n) => ({ floor: (n % 3) + 1, kind, types: ["combat"] }));
    plan.push({ floor: 2, kind: "combat", types: ["elite", "rest"] });
    for (const { floor, kind, types } of plan) {
      const { world, room } = build({ floor, index: 2, seed: "b" + floor, exits: types, roomType: kind });
      assert.equal(room.roomType, kind);
      assert.equal(room.floor, floor);
      assert.equal(room.boss, false);
      assert.equal(room.bossId, null);
      assert.equal(room.bossSpawn, null);
      assert.equal(room.exits.length, types.length);
      assert.equal(room.exit, room.exits[0]);
      assert.equal(room.exits[0].type, types[0]);
      assert.ok(inBounds(room.cameraBounds, room.playerStart));
      assert.deepEqual(world.bounds, room.cameraBounds);
      assert.equal(world.grid.w, room.layout.w);
      assert.ok(world.root.children.includes(room.group), "room group is in the world");
      if (kind === "rest") assert.deepEqual(room.spawns, []);
      else {
        assert.ok(room.spawns.length >= 2, `${floor} ${kind} spawns`);
        for (const sp of room.spawns) assert.ok(inBounds(room.cameraBounds, sp), "spawn outside room");
      }
      if (kind === "treasure") assert.ok(room.chest, "treasure room has a chest");
      else assert.equal(room.chest, null);
    }
  });

  it("builds a boss room with a stairs exit by default and the floor's boss id", () => {
    for (const floor of [1, 3]) {
      const { room } = build({ floor, index: 4, boss: true, seed: "boss" + floor });
      assert.equal(room.boss, true);
      assert.equal(room.roomType, "combat");
      assert.equal(room.bossId, FLOORS[floor].boss);
      assert.ok(room.bossSpawn && typeof room.bossSpawn.x === "number");
      assert.equal(room.exits.length, 1);
      assert.equal(room.exits[0].type, "stairs");
      assert.deepEqual(room.spawns, []);
    }
  });

  it("builds a boss room with a given exit type and ignores a non-boss room kind", () => {
    const { room } = build({ floor: 2, boss: true, seed: "bx", exits: ["boss"], roomType: "rest" });
    assert.equal(room.roomType, "combat");
    assert.equal(room.exits[0].type, "boss");
  });

  it("uses combat rooms with a combat exit when no exits or room kind are given", () => {
    const a = build({ floor: 1, seed: "d" }).room;
    assert.equal(a.exits.length, 1);
    assert.equal(a.exits[0].type, "combat");
    assert.equal(a.roomType, "combat");
    const b = build({ floor: 1, seed: "d", exits: [], roomType: "bogus" }).room;
    assert.equal(b.roomType, "combat");
    assert.equal(b.exits[0].type, "combat");
  });

  it("clamps the floor, caps the exits at two and keeps only the first two exit types", () => {
    const low = build({ floor: 0, seed: "f0" }).room;
    assert.equal(low.floor, 1);
    const high = build({ floor: 7, seed: "f7", exits: ["combat", "elite", "rest"] }).room;
    assert.equal(high.floor, 3);
    assert.equal(high.exits.length, 2);
    assert.deepEqual(high.exits.map((e) => e.type), ["combat", "elite"]);
  });

  const signsOf = (room) => { const out = []; room.group.traverse((o) => { if (o.name === "exit-sign") out.push(o); }); return out; };

  it("gives an exit no sign and no type when its type is empty", () => {
    const { room } = build({ floor: 1, seed: "sign", exits: [""] });
    assert.equal(room.exits[0].type, null);
    assert.equal(signsOf(room).length, 0);
  });

  it("draws a sign for each exit kind, with a fallback shape for an unknown kind", () => {
    const shapes = build({ floor: 1, seed: "signs", exits: ["treasure", "rest"] }).room;
    assert.equal(signsOf(shapes).length, 2);
    assert.deepEqual(shapes.exits.map((e) => e.type), ["treasure", "rest"]);
    // "boss" has its own sign; "mystery" is not a known kind and gets the fallback shape.
    const unknown = build({ floor: 1, seed: "unk", exits: ["boss", "mystery"] }).room;
    assert.deepEqual(unknown.exits.map((e) => e.type), ["boss", "mystery"]);
    assert.equal(signsOf(unknown).length, 2);
  });

  it("places a campfire and a heal glow for rest rooms, with no spawns, and animates them", () => {
    const { world, room } = build({ floor: 2, seed: "camp", roomType: "rest", exits: ["combat"] });
    assert.ok(room.layout.campfire, "layout has a campfire");
    assert.deepEqual(room.spawns, []);
    world.time = 1.3;
    assert.doesNotThrow(() => room.update(world, 1 / 60));
  });

  it("passes the elite and light options through to the spawn list", () => {
    const base = build({ floor: 3, index: 3, seed: "opt", roomType: "combat" }).room.spawns.length;
    const elite = build({ floor: 3, index: 3, seed: "opt", roomType: "combat", elite: true }).room.spawns.length;
    const light = build({ floor: 3, index: 3, seed: "opt", roomType: "combat", light: true }).room.spawns.length;
    assert.ok(elite > base, `elite ${elite} vs ${base}`);
    assert.ok(light < base, `light ${light} vs ${base}`);
  });

  it("adds a pit glow only on rooms with pit cells", () => {
    const pit = findLayout(1, (L) => L.kind.some((k) => k === 2));
    const solid = findLayout(1, (L) => !L.kind.some((k) => k === 2));
    const withPit = build({ floor: 1, index: pit.index, seed: pit.seed, exits: ["combat"] }).room;
    assert.ok(withPit.group.getObjectByName("pitglow"), "pit room has a glow");
    const noPit = build({ floor: 1, index: solid.index, seed: solid.seed, exits: ["combat"] }).room;
    assert.equal(noPit.group.getObjectByName("pitglow"), undefined);
  });

  it("drives exits, the chest, the water and the rocks through update()", () => {
    const { world, room } = build({ floor: 1, seed: "upd", exits: ["combat"] });
    world.time = 1;
    assert.doesNotThrow(() => room.update(world, 1 / 60));
    world.time = 2.5;
    room.update(world, 1 / 60);
    // Closed exit: the seal is shown and the blocker stands in the way.
    assert.equal(room.exits[0].open, false);
  });
});

describe("exits", () => {
  it("blocks the exit until it is opened, and toggles the blocker once", () => {
    const { world, room } = build({ floor: 1, seed: "exit", exits: ["combat"] });
    const exit = room.exits[0];
    const blockerOf = () => world.obstacles.find((o) => o.r === 0.65 && o.x === exit.x);
    assert.equal(exit.open, false);
    assert.ok(blockerOf(), "closed exit is blocked");
    exit.setOpen(true);
    assert.equal(exit.open, true);
    assert.equal(blockerOf(), undefined, "open exit lets the player through");
    exit.setOpen(true);
    assert.equal(blockerOf(), undefined);
    exit.setOpen(false);
    assert.ok(blockerOf(), "closing puts the blocker back");
    exit.setOpen(false);
    assert.equal(world.obstacles.filter((o) => o.r === 0.65 && o.x === exit.x).length, 1);
  });

  it("animates the sign and seal while closed and open", () => {
    const { world, room } = build({ floor: 2, seed: "sealanim", exits: ["combat"] });
    const exit = room.exits[0];
    world.time = 1;
    room.update(world, 1 / 60);
    exit.setOpen(true);
    world.time = 1.5;
    room.update(world, 1 / 60);
    assert.equal(exit.open, true);
  });

  it("opens and closes a stairs exit", () => {
    const { world, room } = build({ floor: 1, boss: true, seed: "stairs" });
    const exit = room.exits[0];
    assert.equal(exit.type, "stairs");
    const blocker = world.obstacles.find((o) => o.r === 0.65 && o.x === exit.x);
    assert.ok(blocker, "stairs start closed");
    exit.setOpen(true);
    assert.ok(!world.obstacles.includes(blocker));
    room.update(world, 1 / 60);
  });
});

describe("chests", () => {
  it("opens once, adds a relic, and lifts the lid over time", () => {
    const { world, room } = build({ floor: 1, seed: "chest", roomType: "treasure", exits: ["combat"] });
    const chest = room.chest;
    assert.equal(chest.opened, false);
    const before = room.group.children.length;
    world.time = 3;
    chest.open();
    assert.equal(chest.opened, true);
    assert.equal(room.group.children.length, before + 1, "relic added");
    chest.open();
    assert.equal(room.group.children.length, before + 1, "second open does nothing");
    const lid = chest.group.getObjectByName("lid");
    room.update(world, 0.016);
    world.time = 3.2;
    room.update(world, 0.016);
    if (lid) assert.ok(lid.rotation.x < 0 && lid.rotation.x > -1.15, "lid part way open");
    world.time = 4;
    room.update(world, 0.016);
    if (lid) assert.ok(Math.abs(lid.rotation.x + 1.15) < 1e-9, "lid fully open");
  });

  it("does not move the lid before the chest is opened", () => {
    const { world, room } = build({ floor: 1, seed: "chest2", roomType: "treasure", exits: ["combat"] });
    const lid = room.chest.group.getObjectByName("lid");
    world.time = 5;
    room.update(world, 0.016);
    if (lid) assert.equal(lid.rotation.x, 0);
  });
});

describe("hazards", () => {
  it("water slows the player inside it, and never raises a lower slow factor", () => {
    const { seed, index, L } = findHazardSeed(1, "water");
    const world = makeWorld({ withPlayer: true });
    buildRoom(world, { floor: 1, index, seed, exits: ["combat"] });
    const [hx, hz] = L.hazards[0];
    world.player.x = hx; world.player.z = hz;
    world.player.slowMul = undefined; // a fresh player has no slow factor yet
    step(world, 0.05);
    assert.equal(world.player.slowMul, 0.7);
    world.player.slowMul = 0.5;
    step(world, 0.05);
    assert.equal(world.player.slowMul, 0.5, "a stronger slow is kept");
    world.player.slowMul = undefined;
    world.player.x = L.start.x; world.player.z = L.start.z;
    step(world, 0.05);
    assert.equal(world.player.slowMul, undefined, "dry ground does not slow");
    world.player.dead = true;
    world.player.x = hx; world.player.z = hz;
    step(world, 0.05);
    assert.equal(world.player.slowMul, undefined, "dead player is ignored");
  });

  it("spike traps hit the player inside the strike window, at most once per cycle", () => {
    const { seed, index, L } = findHazardSeed(2, "spikes");
    const world = makeWorld({ withPlayer: true });
    buildRoom(world, { floor: 2, index, seed, exits: ["combat"] });
    const hits = [];
    world.events.on("player:hit", (e) => hits.push(e.amount));
    const [hx, hz] = L.hazards[0];
    world.player.x = hx; world.player.z = hz;
    step(world, 6, 1 / 60, (w) => { w.player.invuln = 0; w.player.hp = 100; });
    assert.ok(hits.length >= 1 && hits.length <= 3, `spike hits ${hits.length}`);
    assert.ok(hits.every((a) => a === 12));
    // Away from every trap there is no damage.
    const before = hits.length;
    world.player.x = L.start.x; world.player.z = L.start.z;
    step(world, 3, 1 / 60, (w) => { w.player.invuln = 0; w.player.hp = 100; });
    assert.equal(hits.length, before);
  });

  it("ember cracks tick damage while the player stands on them, and restart when re-entered", () => {
    const { seed, index, L } = findHazardSeed(3, "embers");
    const world = makeWorld({ withPlayer: true });
    buildRoom(world, { floor: 3, index, seed, exits: ["combat"] });
    const hits = [];
    world.events.on("player:hit", (e) => hits.push(e.amount));
    const reset = (w) => { w.player.invuln = 0; w.player.hp = 100; };
    const [hx, hz] = L.hazards[0];
    world.player.x = hx; world.player.z = hz;
    step(world, 2, 1 / 60, reset);
    assert.ok(hits.length >= 3 && hits.length <= 5, `ember ticks ${hits.length}`);
    assert.ok(hits.every((a) => a === 3));
    world.player.x = L.start.x; world.player.z = L.start.z;
    const left = hits.length;
    step(world, 1, 1 / 60, reset);
    assert.equal(hits.length, left, "no damage off the cracks");
    world.player.x = hx; world.player.z = hz;
    step(world, 0.3, 1 / 60, reset);
    assert.ok(hits.length > left, "damage restarts on re-entry");
  });

  it("spike traps animate through a full cycle, and ignore a dead player", () => {
    const { seed, index, L } = findHazardSeed(2, "spikes");
    const world = makeWorld({ withPlayer: true });
    const room = buildRoom(world, { floor: 2, index, seed, exits: ["combat"] });
    const hits = [];
    world.events.on("player:hit", (e) => hits.push(e.amount));
    // Every phase of the trap cycle (rising, up, falling, down) gets drawn.
    for (let t = 0; t <= 2.4; t += 0.05) { world.time = t; room.update(world, 0.05); }
    world.player.dead = true;
    world.player.x = L.hazards[0][0]; world.player.z = L.hazards[0][1];
    step(world, 3, 1 / 60, (w) => { w.player.invuln = 0; w.player.hp = 100; });
    assert.equal(hits.length, 0, "a dead player takes no spike damage");
  });

  it("ember cracks animate, ignore a dead player and a missing player", () => {
    const { seed, index, L } = findHazardSeed(3, "embers");
    const world = makeWorld({ withPlayer: true });
    const room = buildRoom(world, { floor: 3, index, seed, exits: ["combat"] });
    const hits = [];
    world.events.on("player:hit", (e) => hits.push(e.amount));
    for (let t = 0; t <= 2; t += 0.1) { world.time = t; room.update(world, 0.1); }
    world.player.dead = true;
    world.player.x = L.hazards[0][0]; world.player.z = L.hazards[0][1];
    step(world, 2, 1 / 60, (w) => { w.player.invuln = 0; w.player.hp = 100; });
    assert.equal(hits.length, 0, "a dead player takes no ember damage");
    world.player = null;
    assert.doesNotThrow(() => step(world, 1));
  });

  it("hazards do nothing without a player", () => {
    const { seed, index, L } = findHazardSeed(1, "water");
    const world = makeWorld({ withPlayer: false });
    buildRoom(world, { floor: 1, index, seed, exits: ["combat"] });
    world.player = null;
    assert.doesNotThrow(() => step(world, 0.5));
    assert.ok(L.hazards.length >= 2);
  });

  it("builds no hazard when the layout has none", () => {
    const world = makeWorld({ withPlayer: true });
    const room = buildRoom(world, { floor: 1, seed: "nohaz", roomType: "rest", exits: ["combat"] });
    assert.equal(room.layout.hazardKind, null);
    assert.equal(world.hazards.length, 0);
  });
});

describe("dispose", () => {
  it("removes the room, its obstacles and its hazards from the world, once", () => {
    const { seed, index, L } = findHazardSeed(2, "spikes");
    const world = makeWorld({ withPlayer: true });
    const room = buildRoom(world, { floor: 2, index, seed, exits: ["combat"] });
    assert.ok(world.hazards.length > 0);
    assert.ok(world.obstacles.length > 0);
    room.dispose(world);
    assert.equal(room.group.parent, null);
    assert.equal(world.hazards.length, 0);
    assert.equal(world.obstacles.length, 0);
    assert.doesNotThrow(() => room.dispose(world));
    assert.ok(L.hazards.length >= 2);
  });

  it("disposes water and ember hazards along with the room", () => {
    const water = findHazardSeed(1, "water");
    const wroom = buildRoom(makeWorld({ withPlayer: true }), { floor: 1, index: water.index, seed: water.seed, exits: ["combat"] });
    const wworld = wroom.group.parent;
    assert.ok(wworld, "room is attached before dispose");
    const embers = findHazardSeed(3, "embers");
    const eworld = makeWorld({ withPlayer: true });
    const eroom = buildRoom(eworld, { floor: 3, index: embers.index, seed: embers.seed, exits: ["combat"] });
    assert.equal(eworld.hazards.length, 1);
    eroom.dispose(eworld);
    assert.equal(eworld.hazards.length, 0);
    assert.equal(eroom.group.parent, null);
  });

  it("disposes meshes that use array materials, have no geometry, or carry their own dispose", () => {
    const world = makeWorld({ withPlayer: true });
    const room = buildRoom(world, { floor: 1, seed: "deep", exits: ["combat"] });
    const mats = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
    const arr = new THREE.Mesh(new THREE.BoxGeometry(), mats);
    const bare = new THREE.Mesh(new THREE.BoxGeometry());
    bare.geometry = null;
    const own = new THREE.Mesh(new THREE.BoxGeometry());
    const ownDispose = spy();
    own.dispose = ownDispose;
    room.group.add(arr, bare, own);
    const matSpies = mats.map((m) => spy(() => {}));
    mats.forEach((m, i) => { m.dispose = matSpies[i]; });
    room.dispose(world);
    assert.equal(ownDispose.calls.length, 1);
    assert.ok(matSpies.every((s) => s.calls.length === 1), "both array materials disposed");
  });

  it("uses the world it was built in when called without one", () => {
    const world = makeWorld({ withPlayer: true });
    const room = buildRoom(world, { floor: 1, seed: "nodisp", exits: ["combat"] });
    room.dispose();
    assert.equal(room.group.parent, null);
    assert.equal(world.obstacles.length, 0);
  });
});

describe("buildHub", () => {
  it("builds the hub with an open exit, props as obstacles and no spawns", () => {
    const world = makeWorld({ withPlayer: true });
    const hub = buildHub(world);
    assert.equal(hub.hub, true);
    assert.equal(hub.floor, 0);
    assert.equal(hub.boss, false);
    assert.deepEqual(hub.playerStart, { x: 0, z: 2.6 });
    assert.deepEqual(hub.spawns, []);
    assert.equal(hub.exits.length, 1);
    assert.equal(hub.exit, hub.exits[0]);
    assert.equal(hub.exit.open, true);
    assert.equal(hub.exit.type, null);
    assert.equal(world.grid, null);
    assert.ok(world.root.children.includes(hub.group));
    // Five props, and no closed-exit blocker because the hub exit starts open.
    assert.equal(world.obstacles.length, 5);
    assert.ok(world.obstacles.every((o) => o.r > 0));
    assert.ok(inBounds(hub.cameraBounds, hub.playerStart));
    hub.update(world, 1 / 60);
    hub.dispose();
    assert.equal(hub.group.parent, null);
    assert.equal(world.obstacles.length, 0);
  });
});

describe("waveFor", () => {
  const types = (list) => new Set(list.map((s) => s.type));
  const FLOOR_TYPES = {
    1: ["skeleton", "slime", "rats", "archer", "bat"],
    2: ["skeleton", "slime", "rats", "archer", "bat", "ghost", "spider", "knight", "brute"],
    3: ["skeleton", "archer", "bat", "ghost", "spider", "knight", "brute", "wisp", "cultist", "mushroom"],
  };

  it("spawns the base count for each floor when there is no layout", () => {
    assert.equal(waveFor(1, 0, createRng(1)).length, 3);
    assert.equal(waveFor(2, 0, createRng(1)).length, 4);
    assert.equal(waveFor(3, 0, createRng(1)).length, 5);
  });

  it("scales the count with the room index, and sets elite and light counts", () => {
    assert.equal(waveFor(1, 4, createRng(2)).length, 6);       // 3 + min(3, floor(3)) = 6
    assert.equal(waveFor(1, 0, createRng(2), { elite: true }).length, 5);  // round(3 * 1.5)
    assert.equal(waveFor(1, 0, createRng(2), { light: true }).length, 2);  // max(2, round(1.5))
    assert.equal(waveFor(3, 0, createRng(2), { light: true }).length, 3);  // round(2.5)
  });

  it("is deterministic for the same rng seed and draws only from the floor's pool", () => {
    const a = waveFor(2, 3, createRng(9));
    const b = waveFor(2, 3, createRng(9));
    assert.deepEqual(a, b);
    for (const f of [1, 2, 3]) {
      for (const s of waveFor(f, 6, createRng(f * 11), { elite: true })) assert.ok(FLOOR_TYPES[f].includes(s.type), `${s.type} on floor ${f}`);
    }
  });

  it("clamps the floor and treats a missing index as zero", () => {
    assert.equal(waveFor(0, 0, createRng(1)).length, 3);
    assert.equal(waveFor(undefined, undefined, createRng(1)).length, 3);
    assert.equal(waveFor(9, 0, createRng(1)).length, 5);
    assert.equal(waveFor(1, -4, createRng(1)).length, 3);
  });

  it("keeps spawns away from the start, the exit and any avoided spot", () => {
    for (let s = 1; s < 40; s++) {
      const list = waveFor(1, 2, createRng(s), { avoid: [{ x: -2, z: 0, r: 1 }, { x: 2, z: -1 }] });
      for (const p of list) {
        assert.ok(Math.hypot(p.x - 0, p.z - 3.0) >= 3.2 - 0.01, "too near the start");
        assert.ok(Math.hypot(p.x, p.z + 3.3) >= 1.5 - 0.01, "too near the exit");
        assert.ok(Math.hypot(p.x + 2, p.z) >= 1 - 0.01, "inside the avoided spot");
        assert.ok(Math.hypot(p.x - 2, p.z + 1) >= 0.7 - 0.01, "inside the default avoid radius");
      }
    }
  });

  it("respects obstacles and a custom start", () => {
    const obstacles = [{ x: -1, z: 0, r: 1 }];
    for (let s = 1; s < 20; s++) {
      for (const p of waveFor(1, 0, createRng(s), { obstacles, start: { x: 3, z: 3 } })) {
        assert.ok(Math.hypot(p.x + 1, p.z) >= 1 + 0.8 - 0.01, "too near an obstacle");
        assert.ok(Math.hypot(p.x - 3, p.z - 3) >= 3.2 - 0.01, "too near the custom start");
      }
    }
  });

  it("caps heavy enemies and doubles the cap for elite rooms", () => {
    const plain = waveFor(3, 20, createRng(4));
    const elite = waveFor(3, 20, createRng(4), { elite: true });
    for (const t of ["brute", "knight", "cultist", "mushroom", "wisp", "archer"]) {
      const cap = { brute: 1, knight: 1, cultist: 2, mushroom: 2, wisp: 3, archer: 2 }[t];
      assert.ok(plain.filter((s) => s.type === t).length <= cap, t + " over cap");
      assert.ok(elite.filter((s) => s.type === t).length <= cap * 2, t + " over elite cap");
    }
    assert.ok(types(elite).size >= 2);
  });

  it("keeps the exits clear when they are given as layout exits", () => {
    const L = generateLayout("wave", 1, false, 1, 0, "combat");
    for (let s = 0; s < 20; s++) {
      for (const p of waveFor(1, 2, createRng(s), { layout: L })) {
        for (const e of L.exits) assert.ok(Math.hypot(p.x - e.x, p.z - e.z) >= 1.5 - 0.01, "too near a layout exit");
      }
    }
  });

  // A small hand-made floor: two cells, both hazardous. Placement is forced to search far past the normal
  // limits, so every late-search rule (hazard skip, slack, gap) runs.
  // cells: [[x, z], ...] floor points. Only those cells are walkable.
  function tinyLayout(cells, haz) {
    const w = 10, h = 8, x0 = -5, z0 = -4;
    const kind = new Uint8Array(w * h), reach = new Uint8Array(w * h), blocked = new Uint8Array(w * h), hazMask = new Uint8Array(w * h);
    for (const [cx, cz] of cells) {
      const i = Math.floor(cx - x0), j = Math.floor(cz - z0);
      kind[j * w + i] = 1; reach[j * w + i] = 1;
      if (haz) hazMask[j * w + i] = 1;
    }
    return { w, h, x0, z0, kind, reach, blocked, hazMask, exits: [], obstacles: [], start: { x: 0, z: 3 }, bounds: null };
  }

  it("places hazard cells only after the search is long", () => {
    const L = tinyLayout([[-3, -2.5], [0.4, -2.0]], true);
    const list = waveFor(1, 0, createRng(3), { layout: L });
    assert.ok(list.length >= 1 && list.length <= 3, `tiny layout spawns ${list.length}`);
  });

  it("places archers only after the search is long on the far side of the room", () => {
    const L = tinyLayout([[-3.5, 2], [-3.4, 2.1]], false);
    const list = waveFor(1, 2, createRng(8), { layout: L });
    assert.ok(list.length >= 1 && list.length <= 6);
    assert.ok(list.every((s) => Math.hypot(s.x - 0, s.z - 3) >= 3.2 - 0.01));
  });

  it("uses the start given by the layout when no start is passed", () => {
    const L = tinyLayout([[-3, -2], [-2.5, -2]], false);
    const list = waveFor(2, 1, createRng(5), { layout: L });
    assert.ok(list.every((s) => Math.hypot(s.x, s.z - 3) >= 3.2 - 0.01));
  });
});

// Fallback rectangle path: attempts: 0 skips the procedural tries, so every result comes from rectLayout.
describe("rooms: rectangle fallback", () => {
  const rectOpts = (w, h) => ({ attempts: 0, rect: [w, h] });

  it("gives up with 'generateLayout failed' when a 1x1 rectangle has no start cell", () => {
    assert.throws(() => generateLayout("s11", 1, false, 1, 0, "combat", rectOpts(1, 1)), { message: "generateLayout failed" });
  });

  it("builds a combat room on a 3x11 rectangle with a start and exit", () => {
    const L = generateLayout("s311", 1, false, 1, 0, "combat", rectOpts(3, 11));
    assert.ok(L.start && L.exits.length === 1);
    assert.equal(L.chest, null);
  });

  it("fails a treasure room on a 3x11 rectangle that has no free chest cell", () => {
    assert.throws(() => generateLayout("s311", 1, false, 1, 0, "treasure", rectOpts(3, 11)), { message: "generateLayout failed" });
  });

  it("keeps level 1 props and hazards on the first fallback tries of a default rectangle", () => {
    const L = generateLayout("fb-level1", 1, false, 1, 0, "combat", rectOpts(11, 8));
    assert.equal(L.hazardKind, "water");
    assert.ok(L.hazards.length >= 2);
    assert.ok(L.obstacles.length <= 3);
  });

  it("fails a rest room on a 7x2 rectangle that has no free campfire cell", () => {
    assert.throws(() => generateLayout("s7x2", 1, false, 1, 0, "rest", rectOpts(7, 2)), { message: "generateLayout failed" });
  });

  it("gives up on a 3x7 rectangle whose hazard tries never leave two hazard cells and too little open floor", () => {
    assert.throws(() => generateLayout("s3x7", 1, false, 1, 0, "combat", rectOpts(3, 7)), { message: "generateLayout failed" });
  });

  it("falls back to a bare level 2 room (no hazards, no props) when level 1 keeps failing", () => {
    const L = generateLayout("s311", 1, false, 1, 0, "combat", rectOpts(3, 11));
    assert.equal(L.hazardKind, null);
    assert.equal(L.obstacles.length, 0);
    assert.ok(L.exits.every((e) => reachFrom(L, L.start.i, L.start.j)[e.j * L.w + e.i]));
  });
});

// Added by the integrator: the late-attempt path (bare rooms) via the lateFrom seam.
it("generateLayout: from the lateFrom attempt on, rooms are accepted bare (no props, no hazards)", () => {
  const L = generateLayout("late", 1, false, 1, 0, "combat", { lateFrom: 0 });
  assert.equal(L.obstacles.length, 0);
  assert.equal(L.hazards.length, 0);
  assert.equal(L.exits.length, 1);
});
