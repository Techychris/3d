// Unit tests for src/game/decor.js (room dressing: banners, battlements, guide lines, waterfalls).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { addDecor, guidePath, DECOR } from "../../src/game/decor.js";

const grid = (w, h, voids = []) => {
  const kind = new Uint8Array(w * h).fill(1);
  for (const [i, j] of voids) kind[j * w + i] = 0;
  return { w, h, x0: -w / 2, z0: -h / 2, kind, walk: kind.slice(), blocked: new Uint8Array(w * h), hazMask: new Uint8Array(w * h) };
};
const cell = (L, i, j) => ({ i, j, x: L.x0 + i + 0.5, z: L.z0 + j + 0.5 });
const fakeRng = (v, reverse = false) => Object.assign(() => v, { int: (a) => a, shuffle: (arr) => (reverse ? arr.slice().reverse() : arr.slice()) });
const ctxOf = () => ({ group: new THREE.Group(), ownedGeos: [], ownedMats: [], animFns: [] });
const run = (L, floor, rng, extra = {}) => {
  const ctx = ctxOf();
  const kAt = (i, j) => (i < 0 || j < 0 || i >= L.w || j >= L.h ? 0 : L.kind[j * L.w + i]);
  const res = addDecor(ctx, L, { floor, rng, stones: [0x6b5a80], kAt, wallN: (i, j) => kAt(i, j - 1) === 0, isTall: (i, j) => j === 0 && i < 4, torchCells: new Set(["2,0"]), ...extra });
  return { ctx, res, names: ctx.group.children.map((c) => c.name) };
};

describe("guidePath", () => {
  it("finds a shortest path that avoids hazard cells", () => {
    const L = grid(3, 3); L.hazMask[4] = 1;
    const p = guidePath(L, { i: 0, j: 0 }, { i: 2, j: 2 });
    assert.equal(p.length, 5); assert.equal(p[0], 0); assert.equal(p[4], 8); assert.ok(!p.includes(4));
  });
  it("returns [] when props and void wall the target off", () => {
    const L = grid(3, 3); L.walk[7] = 0; L.blocked[5] = 1;
    assert.deepEqual(guidePath(L, { i: 0, j: 0 }, { i: 2, j: 2 }), []);
  });
  it("reaches a target cell even if the target itself is blocked", () => {
    const L = grid(2, 1); L.blocked[1] = 1;
    assert.deepEqual(guidePath(L, { i: 0, j: 0 }, { i: 1, j: 0 }), [0, 1]);
  });
});

describe("addDecor", () => {
  it("floor 1: banners skip torches and neighbours, columns and merlons appear, two spaced waterfalls, shared dashes drawn once", () => {
    const L = grid(6, 4, [[5, 3]]);
    L.start = cell(L, 2, 3); L.exits = [cell(L, 0, 0), cell(L, 0, 0), cell(L, 2, 2)];
    const { ctx, res, names } = run(L, 1, fakeRng(0.1));
    assert.deepEqual(names, ["decor-solid", "decor-lines", "decor-falls"]);
    assert.equal(res.banners, 2); // cells 0 and 3: 1 neighbours a banner, 2 holds a torch
    assert.equal(res.falls, DECOR[1].falls);
    assert.equal(res.dashes, 4); // start -> (0,0) is 6 cells: 4 inner segments, counted once for the duplicate exit
    assert.equal(ctx.ownedGeos.length, 3); assert.equal(ctx.ownedMats.length, 3);
    const [lines, falls] = ctx.animFns;
    lines(null, Math.PI / 2.6); falls(null, 3);
    assert.ok(ctx.ownedMats[1].opacity > 0.42);
    assert.equal(ctx.ownedMats[2].uniforms.uT.value, 3);
  });
  it("floor 2: takes one waterfall, here from an east edge", () => {
    const L = grid(6, 4, [[5, 3]]);
    L.start = cell(L, 2, 3); L.exits = [cell(L, 0, 0)];
    const { res } = run(L, 2, fakeRng(0.1, true));
    assert.equal(res.falls, 1);
  });
  it("floor 3 with unlucky rolls: no wall dressing and no waterfalls, only the guide lines", () => {
    const L = grid(6, 4);
    L.start = cell(L, 2, 3); L.exits = [cell(L, 0, 0)];
    const { res, names } = run(L, 3, fakeRng(0.9));
    assert.deepEqual(names, ["decor-lines"]);
    assert.deepEqual(res, { banners: 0, falls: 0, dashes: 4 });
  });
});
