import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createWorld, clearRoom, screenToWorld, yawOf, isWalkable, cellWalkable, resolveCollision,
  inCircle, inLine, inCone, dist, clamp,
} from "../../src/game/world.js";
import { spy } from "./helpers.mjs";

const S = Math.SQRT1_2;
const closeTo = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not close to ${b}`);

// A 3 x 3 grid at (-1.5, -1.5). The centre cell (1, 1) spans x and z in [-0.5, 0.5] and is blocked.
function gridWorld() {
  const world = createWorld(new THREE.Scene());
  const walk = new Uint8Array([1, 1, 1, 1, 0, 1, 1, 1, 1]);
  world.grid = { x0: -1.5, z0: -1.5, w: 3, h: 3, walk };
  return world;
}

describe("createWorld", () => {
  it("adds a named root group to the scene and starts with empty lists", () => {
    const scene = new THREE.Scene();
    const world = createWorld(scene);
    assert.equal(world.root.name, "world-root");
    assert.ok(scene.children.includes(world.root));
    assert.deepEqual([world.enemies, world.projectiles, world.telegraphs, world.hazards, world.pickups, world.obstacles], [[], [], [], [], [], []]);
    assert.equal(world.grid, null);
    assert.equal(world.player, null);
    assert.equal(world.THREE, THREE);
    assert.deepEqual(world.bounds, { minX: -5, maxX: 5, minZ: -4, maxZ: 4 });
    assert.equal(typeof world.rng, "function");
    assert.equal(typeof world.events.on, "function");
  });

  it("add() puts an object under the root and returns it", () => {
    const world = createWorld(new THREE.Scene());
    const mesh = new THREE.Mesh();
    assert.equal(world.add(mesh), mesh);
    assert.equal(mesh.parent, world.root);
  });

  it("remove() detaches an object, and does nothing for missing or detached objects", () => {
    const world = createWorld(new THREE.Scene());
    const mesh = world.add(new THREE.Mesh());
    world.remove(mesh);
    assert.equal(mesh.parent, null);
    assert.doesNotThrow(() => world.remove(null));
    assert.doesNotThrow(() => world.remove(new THREE.Mesh()));
  });

  it("exposes no-op shake and hit-stop hooks until main sets them", () => {
    const world = createWorld(new THREE.Scene());
    assert.equal(world.shake(1), undefined);
    assert.equal(world.hitStop(0.1), undefined);
  });
});

describe("clearRoom", () => {
  it("disposes entities that have dispose(), removes groups of entities that only have a group, and empties every list", () => {
    const world = createWorld(new THREE.Scene());
    const dispose = spy();
    const group = world.add(new THREE.Group());
    world.enemies.push({ dispose });
    world.projectiles.push({ group });
    world.telegraphs.push({});
    world.hazards.push({});
    world.pickups.push({});
    world.obstacles.push({ x: 0, z: 0, r: 1 });
    clearRoom(world);
    assert.deepEqual(dispose.calls, [[world]]);
    assert.equal(group.parent, null);
    for (const list of [world.enemies, world.projectiles, world.telegraphs, world.hazards, world.pickups, world.obstacles]) {
      assert.equal(list.length, 0);
    }
  });
});

describe("screen-relative input", () => {
  it("maps screen right to world (+x, -z) and screen up to world (-x, -z)", () => {
    const right = screenToWorld(1, 0);
    closeTo(right.x, S); closeTo(right.z, -S);
    const up = screenToWorld(0, 1);
    closeTo(up.x, -S); closeTo(up.z, -S);
  });

  it("is zero at the origin", () => {
    const o = screenToWorld(0, 0);
    closeTo(o.x, 0); closeTo(o.z, 0);
  });

  it("gives yaw 0 for +z and a quarter turn for +x", () => {
    assert.equal(yawOf(0, 1), 0);
    closeTo(yawOf(1, 0), Math.PI / 2);
  });
});

describe("isWalkable", () => {
  it("without a grid, is true inside the bounds (edges included) and false outside", () => {
    const world = createWorld(new THREE.Scene());
    assert.equal(isWalkable(world, 0, 0), true);
    assert.equal(isWalkable(world, 5, 4), true);
    assert.equal(isWalkable(world, -5, -4), true);
    assert.equal(isWalkable(world, 5.1, 0), false);
    assert.equal(isWalkable(world, 0, -4.1), false);
  });

  it("with a grid, follows the walk flags and is false outside the grid", () => {
    const world = gridWorld();
    assert.equal(isWalkable(world, -1, -1), true);   // cell (0, 0)
    assert.equal(isWalkable(world, 0, 0), false);    // blocked centre cell (1, 1)
    assert.equal(isWalkable(world, 1, 0), true);     // cell (2, 1)
    assert.equal(isWalkable(world, -2, 0), false);   // left of the grid
    assert.equal(isWalkable(world, 0, 2), false);    // below the grid
    assert.equal(isWalkable(world, 2, 0), false);    // right of the grid
  });
});

describe("cellWalkable", () => {
  it("is false with no grid", () => {
    assert.equal(cellWalkable(createWorld(new THREE.Scene()), 0, 0), false);
  });

  it("reads the walk flag for cells on the grid and treats outside cells as blocked", () => {
    const world = gridWorld();
    assert.equal(cellWalkable(world, 0, 0), true);
    assert.equal(cellWalkable(world, 1, 1), false);
    assert.equal(cellWalkable(world, -1, 0), false);
    assert.equal(cellWalkable(world, 0, -1), false);
    assert.equal(cellWalkable(world, 3, 0), false);
    assert.equal(cellWalkable(world, 0, 3), false);
  });
});

describe("resolveCollision", () => {
  it("clamps a position to the room bounds, inset by the radius", () => {
    const world = createWorld(new THREE.Scene());
    const pos = resolveCollision(world, { x: 10, z: -10 }, 0.5);
    assert.deepEqual([pos.x, pos.z], [4.5, -3.5]);
  });

  it("returns the same object it was given", () => {
    const world = createWorld(new THREE.Scene());
    const pos = { x: 0, z: 0 };
    assert.equal(resolveCollision(world, pos, 0.3), pos);
  });

  it("pushes a circle out of an overlapping obstacle along the line between their centres", () => {
    const world = createWorld(new THREE.Scene());
    world.obstacles.push({ x: 0, z: 0, r: 1 });
    const pos = resolveCollision(world, { x: 0.5, z: 0 }, 0.5);
    assert.deepEqual([pos.x, pos.z], [1.5, 0]);
  });

  it("moves a circle sitting exactly on an obstacle centre sideways by the combined radius", () => {
    const world = createWorld(new THREE.Scene());
    world.obstacles.push({ x: 0, z: 0, r: 1 });
    const pos = resolveCollision(world, { x: 0, z: 0 }, 0.5);
    assert.equal(pos.x, 1.5);
    assert.equal(pos.z, 0);
  });

  it("leaves a circle alone when it is clear of every obstacle", () => {
    const world = createWorld(new THREE.Scene());
    world.obstacles.push({ x: 0, z: 0, r: 1 });
    const pos = resolveCollision(world, { x: 3, z: 0 }, 0.5);
    assert.deepEqual([pos.x, pos.z], [3, 0]);
  });

  it("pushes out of a blocked grid cell through the nearest face (right, left, bottom and top)", () => {
    // Blocked cell spans x and z in [-0.5, 0.5]; r = 0.3.
    const cases = [
      { start: [0.4, 0], expect: [0.8, 0], face: "right" },     // nearest face is +x
      { start: [0, 0], expect: [-0.8, 0], face: "left" },       // centre tie: -x
      { start: [0, 0.4], expect: [0, 0.8], face: "top" },       // nearest face is +z
      { start: [0, -0.4], expect: [0, -0.8], face: "bottom" },  // nearest face is -z
    ];
    for (const c of cases) {
      const world = gridWorld();
      const pos = resolveCollision(world, { x: c.start[0], z: c.start[1] }, 0.3);
      closeTo(pos.x, c.expect[0]); closeTo(pos.z, c.expect[1]);
    }
  });

  it("slides a circle that only brushes a blocked cell edge to the edge distance", () => {
    const world = gridWorld();
    const pos = resolveCollision(world, { x: 0.6, z: 0 }, 0.3);
    closeTo(pos.x, 0.8); closeTo(pos.z, 0);
  });

  it("leaves a circle alone when it is clear of a blocked cell", () => {
    const world = gridWorld();
    const pos = resolveCollision(world, { x: 0.78, z: 0.7 }, 0.3);
    closeTo(pos.x, 0.78); closeTo(pos.z, 0.7);
  });

  it("ignores blocked cells outside the grid and open cells, and keeps the bounds clamp", () => {
    const world = gridWorld();
    const pos = resolveCollision(world, { x: -1.6, z: 0 }, 0.3);
    // The circle hangs over the grid edge; only the open cell at (0, 1) is in range, so nothing changes.
    closeTo(pos.x, -1.6); closeTo(pos.z, 0);
  });
});

describe("shape tests", () => {
  it("inCircle includes the rim and the optional pad", () => {
    assert.equal(inCircle(3, 4, 0, 0, 5), true);
    assert.equal(inCircle(3, 4, 0, 0, 4.9), false);
    assert.equal(inCircle(3, 4, 0, 0, 4.9, 0.2), true);
  });

  it("inLine tests a rectangle from the origin along the yaw, with width and pad", () => {
    assert.equal(inLine(0, 1, 0, 0, 0, 2, 0.5), true);
    assert.equal(inLine(0, -0.1, 0, 0, 0, 2, 0.5), false);      // behind the start
    assert.equal(inLine(0, -0.1, 0, 0, 0, 2, 0.5, 0.2), true);  // pad covers it
    assert.equal(inLine(0.3, 1, 0, 0, 0, 2, 0.5), false);       // too wide
    assert.equal(inLine(0.3, 1, 0, 0, 0, 2, 0.5, 0.1), true);
    assert.equal(inLine(0, 2.5, 0, 0, 0, 2, 0.5), false);       // past the end
    assert.equal(inLine(0, 2.5, 0, 0, 0, 2, 0.5, 0.6), true);
  });

  it("inCone tests the radius, the opening arc and the apex", () => {
    assert.equal(inCone(0, 1, 0, 0, 0, 2, Math.PI / 2), true);    // straight ahead
    assert.equal(inCone(1, 0, 0, 0, 0, 2, Math.PI / 2), false);   // 90 degrees to the side, outside a 90 degree arc
    assert.equal(inCone(1, 0, 0, 0, 0, 2, Math.PI), true);        // same point inside a 180 degree arc
    assert.equal(inCone(0, 3, 0, 0, 0, 2, Math.PI), false);       // beyond the radius
    assert.equal(inCone(0, 0, 0, 0, 0, 2, Math.PI / 2), true);    // exactly at the apex
  });

  it("inCone widens the arc and the radius by the pad", () => {
    const a = 0.9; // radians off-axis, outside the 90 degree arc (half-width 0.785)
    const px = Math.sin(a), pz = Math.cos(a);
    assert.equal(inCone(px, pz, 0, 0, 0, 2, Math.PI / 2), false);
    assert.equal(inCone(px, pz, 0, 0, 0, 2, Math.PI / 2, 0.5), true);
    assert.equal(inCone(0, 2.3, 0, 0, 0, 2, Math.PI, 0.5), true);
  });

  it("inCone handles angles across the wrap-around", () => {
    const angle = Math.PI * 0.95;
    const dir = -Math.PI * 0.95; // the same side of the circle, reached the other way round
    assert.equal(inCone(Math.sin(dir), Math.cos(dir), 0, 0, angle, 2, Math.PI * 0.4), true);
  });

  it("dist is the planar distance, and clamp keeps values in range", () => {
    assert.equal(dist({ x: 0, z: 0 }, { x: 3, z: 4 }), 5);
    assert.equal(clamp(5, 0, 3), 3);
    assert.equal(clamp(-1, 0, 3), 0);
    assert.equal(clamp(2, 0, 3), 2);
  });
});
