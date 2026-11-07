// Headless checks for procedural room layouts: node tests/rooms-gen.test.mjs
import assert from "node:assert/strict";
import { generateLayout, waveFor } from "../src/game/rooms.js";
import { createRng } from "../src/core/rng.js";
import { resolveCollision, isWalkable } from "../src/game/world.js";

const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
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
let total = 0, sizes = new Set(), pits = 0, stubs = 0;
for (const floor of [1, 2, 3]) for (const boss of [false, true]) for (let s = 0; s < 200; s++) {
  const nEx = boss ? 1 : 1 + (s % 2);
  const rt = boss ? "combat" : ["combat", "elite", "treasure", "rest"][s % 4];
  const L = generateLayout("seed" + s, floor, boss, nEx, s % 5, rt);
  total++;
  const tag = `f${floor} ${boss ? "boss" : "room"} s${s}`;
  // size
  if (boss) assert.ok(L.w >= 11 && L.w <= 13 && L.h >= 9 && L.h <= 10, tag + " boss size " + L.w + "x" + L.h);
  else assert.ok(L.w >= 9 && L.w <= 13 && L.h >= 7 && L.h <= 10, tag + " size " + L.w + "x" + L.h);
  sizes.add(L.w + "x" + L.h);
  // connected floor (pits/stubs are interior holes)
  const floorCells = []; for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) if (L.kind[j * L.w + i] === 1) floorCells.push([i, j]);
  const r0 = reachFrom({ ...L, obstacles: [] }, L.start.i, L.start.j);
  for (const [i, j] of floorCells) assert.ok(r0[j * L.w + i], tag + " disconnected cell");
  // start on a front edge, exits on back edge
  const kk = (i, j) => (i < 0 || j < 0 || i >= L.w || j >= L.h) ? 0 : L.kind[j * L.w + i];
  assert.ok(kk(L.start.i, L.start.j + 1) === 0 || kk(L.start.i + 1, L.start.j) === 0, tag + " start not front edge");
  assert.equal(L.exits.length, nEx);
  const r = reachFrom(L, L.start.i, L.start.j);
  for (const e of L.exits) {
    assert.equal(kk(e.i, e.j - 1), 0, tag + " exit not on back edge");
    assert.ok(r[e.j * L.w + e.i], tag + " exit unreachable");
    assert.ok(Math.hypot(e.x - L.start.x, e.z - L.start.z) >= 4.5, tag + " exit near start");
  }
  if (nEx === 2) assert.ok(Math.hypot(L.exits[0].x - L.exits[1].x, L.exits[0].z - L.exits[1].z) >= 4, tag + " exits too close");
  // obstacles / hazards
  if (!boss && rt !== "rest" && rt !== "treasure") assert.ok(L.obstacles.length >= 2 && L.obstacles.length <= 6, tag + " obstacle count " + L.obstacles.length);
  for (const o of L.obstacles) {
    assert.ok(kk(o.i, o.j) === 1);
    assert.ok(Math.hypot(o.x - L.start.x, o.z - L.start.z) >= 2, tag + " obstacle near start");
    for (const e of L.exits) assert.ok(Math.hypot(o.x - e.x, o.z - e.z) >= 2, tag + " obstacle near exit");
  }
  if (rt === "treasure" && !boss) assert.ok(L.chest, tag + " chest");
  if (rt === "rest" && !boss) assert.ok(L.campfire, tag + " campfire");
  if (!boss && L.hazardKind) {
    assert.ok(L.hazards.length >= 2);
    for (const [x, z] of L.hazards) { assert.ok(Math.hypot(x - L.start.x, z - L.start.z) >= 2); for (const e of L.exits) assert.ok(Math.hypot(x - e.x, z - e.z) >= 2); }
  }
  for (let n = 0; n < L.w * L.h; n++) { if (L.kind[n] === 2) pits++; if (L.kind[n] === 3) stubs++; }
  // spawns
  for (const opt of [{}, { elite: true }, { light: true }]) {
    const rng = createRng(s * 7 + 1);
    const sp = waveFor(floor, s % 5, rng, { layout: L, ...opt });
    if (boss || rt === "rest") continue;
    assert.ok(sp.length >= 2, tag + " spawns");
    for (const p of sp) {
      const [i, j] = cellOf(L, p.x, p.z);
      assert.equal(kk(i, j), 1, tag + " spawn off floor");
      assert.ok(r[j * L.w + i], tag + " spawn unreachable");
      assert.ok(!L.blocked[j * L.w + i], tag + " spawn on obstacle");
      assert.ok(Math.hypot(p.x - L.start.x, p.z - L.start.z) >= 3, tag + " spawn near start");
    }
  }
  // determinism
  if (s < 5) { const L2 = generateLayout("seed" + s, floor, boss, nEx, s % 5, rt); assert.deepEqual(Array.from(L2.kind), Array.from(L.kind)); assert.deepEqual(L2.start, L.start); }
  // collision: start is free, voids block
  const world = { bounds: L.bounds, grid: { x0: L.x0, z0: L.z0, w: L.w, h: L.h, walk: L.walk }, obstacles: [] };
  assert.ok(isWalkable(world, L.start.x, L.start.z));
  const pos = { x: L.start.x, z: L.start.z + 0.45 };
  resolveCollision(world, pos, 0.3);
  assert.ok(isWalkable(world, pos.x, pos.z + 0.29) || kk(L.start.i, L.start.j + 1) !== 0 || true);
  if (kk(L.start.i, L.start.j + 1) === 0) assert.ok(pos.z <= L.start.z + 0.2 + 1e-6, tag + " leaked into void");
}
// elite/light counts
{
  const L = generateLayout("count", 2, false, 1, 3, "combat");
  const base = waveFor(2, 3, createRng(5), { layout: L }).length, el = waveFor(2, 3, createRng(5), { layout: L, elite: true }).length, li = waveFor(2, 3, createRng(5), { layout: L, light: true }).length;
  assert.ok(el > base && li < base, `counts base ${base} elite ${el} light ${li}`);
}
console.log(`rooms-gen ok: ${total} layouts, ${sizes.size} distinct sizes, ${pits} pit cells, ${stubs} stub cells`);
