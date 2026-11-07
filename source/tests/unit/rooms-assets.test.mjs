import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ASSETS } from "../../src/engine/assets.js";
import { makeWorld } from "./helpers.mjs";
import { buildRoom } from "../../src/game/rooms.js";

// Asset-internal branches of rooms.js. The real asset registry is kept; for the ids patched below, the
// build() of the registry entry returns a hand-made group (t.mock.method restores it after each test).

// Counts its own disposals only; restyle() clones through this.constructor, so the clones count too.
let disposals = 0;
class TrackedMaterial extends THREE.MeshBasicMaterial {
  dispose() { disposals++; super.dispose(); }
}

// Swap one registry entry for a fake whose build() returns the given group; t.after puts the real entry back.
function withAsset(t, id, makeGroup) {
  const real = ASSETS[id];
  ASSETS[id] = { meta: real.meta, build: makeGroup };
  t.after(() => { ASSETS[id] = real; });
}

const build = (opts) => {
  const world = makeWorld({ withPlayer: true });
  const room = buildRoom(world, opts);
  return { world, room };
};

// A wall with a static base, an "upper" mesh whose material is an array, and a live part held in
// userData as an array (with a null and a non-object entry beside the Object3D).
function wallGroup(mats, out) {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  const upper = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), mats);
  upper.name = "upper";
  // The upper mesh sits under the live part, so an unskipped wall keeps it live instead of baking an array material.
  const part = new THREE.Object3D();
  part.add(upper, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshBasicMaterial()));
  group.add(part);
  group.userData.parts = [null, part, 7];
  out.push(group);
  return group;
}

// A portal with no child named "vfx-portal", so the exit finds no live portal node.
function portalGroup() {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  return group;
}

describe("rooms: asset-internal branches", () => {
  it("drops an upper part with array materials, disposes each of them and keeps the wall's animated part live", (t) => {
    const mats = [new TrackedMaterial(), new TrackedMaterial()];
    const walls = [];
    withAsset(t, "tile-wall", () => wallGroup(mats, walls));
    disposals = 0;
    build({ floor: 1, seed: "walls", exits: ["portal"] });
    const hasUpper = (g) => { let found = false; g.traverse((o) => { if (o.name === "upper") found = true; }); return found; };
    const dropped = walls.filter((g) => !hasUpper(g));
    const kept = walls.filter(hasUpper);
    assert.ok(dropped.length > 0, "some walls skip their upper part");
    assert.ok(kept.length > 0, "tall walls keep their upper part");
    assert.equal(disposals, 2 * dropped.length, "both array materials of every skipped upper part were disposed");
    assert.ok(walls.every((g) => g.parent !== null), "every wall with a live userData part was added to the room");
  });

  it("builds a portal exit whose asset has no live vfx-portal node", (t) => {
    withAsset(t, "vfx-portal", portalGroup);
    const { room } = build({ floor: 1, seed: "portal", exits: ["portal"] });
    let live = false;
    room.group.traverse((o) => { if (o.name === "vfx-portal") live = true; });
    assert.equal(live, false);
  });
});
