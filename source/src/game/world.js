// The World: one object shared by every module. See CONTRACT.md.
import * as THREE from "three";
import { createEvents } from "../core/events.js";
import { createRng } from "../core/rng.js";

export function createWorld(scene) {
  const root = new THREE.Group(); root.name = "world-root"; scene.add(root);
  const world = {
    THREE, scene, root,
    time: 0, dt: 0, paused: false,
    rng: createRng(1),
    events: createEvents(),
    bounds: { minX: -5, maxX: 5, minZ: -4, maxZ: 4 },
    obstacles: [],          // [{x, z, r}] solid circles (pillars, statues, props)
    player: null,
    enemies: [],
    projectiles: [],
    telegraphs: [],
    hazards: [],
    pickups: [],
    stats: null,            // derived player stats (items.computeStats); set by main
    fx: null,               // set by main from game/fx.js
    audio: null,            // set by main from engine/audio.js
    camera: null,           // set by main (OrthographicCamera)
    shake: (amount) => {},  // set by main: request camera shake (units)
    hitStop: (seconds) => {}, // set by main: freeze simulation briefly
    add(obj) { root.add(obj); return obj; },
    remove(obj) { if (obj && obj.parent) obj.parent.remove(obj); },
  };
  return world;
}

// Remove everything that belongs to a room (keeps the player object).
export function clearRoom(world) {
  for (const list of [world.enemies, world.projectiles, world.telegraphs, world.hazards, world.pickups]) {
    for (const e of list) { if (e.dispose) e.dispose(world); else if (e.group) world.remove(e.group); }
    list.length = 0;
  }
  world.obstacles.length = 0;
}

// --- Camera-relative input -------------------------------------------------
// Camera sits at (+x, +y, +z) looking at the origin, so "up on the screen" points to world (-1, 0, -1).
const S = Math.SQRT1_2;
export function screenToWorld(sx, sy) {
  // sx: right on screen (+1), sy: up on screen (+1)  ->  world {x, z}
  return { x: sx * S - sy * S, z: -sx * S - sy * S };
}
export const yawOf = (dx, dz) => Math.atan2(dx, dz); // 0 = facing +z; set group.rotation.y = yaw

// --- Collision ---------------------------------------------------------------
// Keep a circle of radius r inside the room bounds and outside every obstacle. Mutates pos {x, z}.
export function resolveCollision(world, pos, r) {
  const b = world.bounds;
  for (const o of world.obstacles) {
    const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), min = o.r + r;
    if (d < min && d > 1e-6) { pos.x = o.x + dx / d * min; pos.z = o.z + dz / d * min; }
    else if (d <= 1e-6) { pos.x += min; }
  }
  pos.x = Math.min(b.maxX - r, Math.max(b.minX + r, pos.x));
  pos.z = Math.min(b.maxZ - r, Math.max(b.minZ + r, pos.z));
  return pos;
}

// --- Shape tests (used by telegraphs, player attacks, hazards) ---------------
export function inCircle(px, pz, x, z, r, pad = 0) { return Math.hypot(px - x, pz - z) <= r + pad; }
// Line: a rectangle starting at (x, z), extending `length` along yaw `angle`, `width` wide.
export function inLine(px, pz, x, z, angle, length, width, pad = 0) {
  const dx = Math.sin(angle), dz = Math.cos(angle);
  const rx = px - x, rz = pz - z;
  const along = rx * dx + rz * dz, across = Math.abs(rx * dz - rz * dx);
  return along >= -pad && along <= length + pad && across <= width / 2 + pad;
}
// Cone: apex at (x, z), facing yaw `angle`, total opening `arc` radians, radius r.
export function inCone(px, pz, x, z, angle, r, arc, pad = 0) {
  const rx = px - x, rz = pz - z, d = Math.hypot(rx, rz);
  if (d > r + pad) return false;
  if (d < 1e-6) return true;
  let diff = Math.atan2(rx, rz) - angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return Math.abs(diff) <= arc / 2 + Math.atan2(pad, Math.max(d, 1e-3));
}
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
