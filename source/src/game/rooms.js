// Module D: rooms and floors. Floating island dioramas built from merged geometry.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makeAsset } from "../engine/assets.js";
import { createRng, hashString } from "../core/rng.js";
import { damagePlayer } from "./combat.js";

export const FLOORS = {
  1: { name: "Mossy ruins", tiles: ["tile-floor-moss", "tile-water"], props: ["tile-pillar", "prop-statue", "prop-barrels"], hazard: "water", boss: "slime-king" },
  2: { name: "Crypt", tiles: ["tile-floor-stone", "tile-spike-trap"], props: ["prop-gravestones", "tile-pillar", "prop-barrels"], hazard: "spikes", boss: "stone-golem" },
  3: { name: "Arcane spire", tiles: ["tile-floor-stone", "tile-floor-cracked"], props: ["tile-pillar", "prop-statue", "prop-brazier"], hazard: "embers", boss: "necromancer" },
};

const THEMES = {
  1: { base: 0x3d3350, stones: [0x6b5a80, 0x7a6a92, 0x5e4f76], moss: [0x3f6b5e, 0x5a9a80], mossChance: 0.4, grass: 0x7a6ab0, tuft: 0x7cc8a0 },
  2: { base: 0x34304a, stones: [0x5e5a78, 0x6c6890, 0x514d6c], moss: [], mossChance: 0, grass: 0x6a6aa0, tuft: 0x8fb0c8 },
  3: { base: 0x2a2548, stones: [0x4a4a86, 0x5560a8, 0x3e3a70], moss: [], mossChance: 0, grass: 0x7a5ab8, tuft: 0xa070ff },
  hub: { base: 0x3d3350, stones: [0x6b5a80, 0x7a6a92, 0x5e4f76], moss: [0x3f6b5e, 0x5a9a80], mossChance: 0.3, grass: 0x7a6ab0, tuft: 0x7cc8a0 },
};

const PROP_R = { "tile-pillar": 0.4, "prop-statue": 0.45, "prop-barrels": 0.5, "prop-gravestones": 0.5, "prop-brazier": 0.3 };
const START = { x: 0, z: 3.0 };
const EXIT_POS = { x: 0, z: -3.3 };

// Layouts: obs [propSlot, x, z]; cells are hazard tile centres (water uses all, spikes first 5, embers all).
const LAYOUTS = [
  { obs: [[0, -3, -1], [0, 3, -1], [1, -3.7, 2.2]], cells: [[-1.5, 0.5], [-0.5, 0.5], [0.5, 0.5], [1.5, 0.5], [-0.5, 1.5], [0.5, 1.5]] },
  { obs: [[1, 0, -0.8], [2, 3.8, -2.2], [2, -3.8, -2.4]], cells: [[-3.5, 1.5], [-2.5, 1.5], [-3.5, 0.5], [3.5, 1.5], [3.5, 0.5], [2.5, 0.5]] },
  { obs: [[0, -2, 0], [0, 2, 0], [2, 3.8, -2.4]], cells: [[3.5, 2.5], [2.5, 2.5], [3.5, 1.5], [-0.5, -1.5], [0.5, -1.5], [-3.5, -2.5]] },
  { obs: [[1, -3.5, -1.5], [1, 3.5, -1.5], [2, 0, 0.2]], cells: [[-2.5, 1.5], [-1.5, 1.5], [2.5, 1.5], [1.5, 1.5], [-3.5, -0.5], [3.5, -0.5]] },
];
const BOSS_LAYOUTS = [
  { obs: [[0, -3.5, -0.5], [0, 3.5, -0.5]], cells: [] },
  { obs: [[1, -3.6, 0.8], [1, 3.6, 0.8]], cells: [] },
];

// ---------------------------------------------------------------- helpers
const hash3 = (x, y, z) => {
  const s = Math.sin(Math.round(x * 50) * 12.9898 + Math.round(y * 50) * 78.233 + Math.round(z * 50) * 37.719) * 43758.5453;
  return s - Math.floor(s);
};
const tmpColor = new THREE.Color();

function plain(geo) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
  g.clearGroups();
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
function paint(geo, colorFn) {
  const p = geo.attributes.position, n = p.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    tmpColor.setHex(colorFn(p.getX(i), p.getY(i), p.getZ(i), i));
    arr[i * 3] = tmpColor.r; arr[i * 3 + 1] = tmpColor.g; arr[i * 3 + 2] = tmpColor.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}
function lerpHex(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return ca.lerp(cb, Math.max(0, Math.min(1, t))).getHex();
}
function box(list, w, h, d, x, y, z, color) {
  const g = plain(new THREE.BoxGeometry(w, h, d));
  g.translate(x, y, z);
  list.push(paint(g, () => color));
}

function matKey(m) {
  return [m.color && m.color.getHex(), m.emissive && m.emissive.getHex(), m.emissiveIntensity, m.opacity, m.transparent, m.metalness, m.side, m.depthWrite].join("|");
}

// Collects static geometry of assets, merged per distinct material.
class Baker {
  constructor(override) { this.buckets = new Map(); this.override = override || null; this.extraMats = []; }
  add(geo, mat) {
    const key = this.override ? "o" : matKey(mat);
    let b = this.buckets.get(key);
    if (!b) { b = { mat: this.override || mat, geos: [] }; this.buckets.set(key, b); }
    else if (!this.override && b.mat !== mat) this.extraMats.push(mat);
    b.geos.push(plain(geo));
  }
  build(parent, ownedMats, ownedGeos) {
    for (const b of this.buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      for (const g of b.geos) g.dispose();
      if (!merged) continue;
      const m = new THREE.Mesh(merged, b.mat);
      m.castShadow = !b.mat.transparent; m.receiveShadow = true;
      parent.add(m);
      ownedGeos.push(merged);
      if (!this.override) ownedMats.push(b.mat);
    }
    for (const m of this.extraMats) m.dispose();
    this.buckets.clear();
  }
}

const ANIM_NAMES = ["flame", "fire", "bubbles", "swirl", "surface", "relic", "lid"];
function hasAncestor(o, set) { for (let p = o; p; p = p.parent) if (set.has(p)) return true; return false; }

// Make asset, bake its static meshes into `baker` (transformed by matrix), leave animated nodes in place.
// opts: skip [names to drop], skipBelow (drop everything named "upper"), route(mesh) -> Baker, anim [names to keep live]
function place(ctx, id, x, y, z, rotY, opts = {}) {
  const asset = makeAsset(id);
  const g = asset.group;
  g.updateMatrixWorld(true);
  const mat4 = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1));
  const keepNames = new Set(opts.anim || ANIM_NAMES);
  const animNodes = new Set();
  g.traverse((o) => { if (keepNames.has(o.name)) animNodes.add(o); });
  for (const v of Object.values(g.userData)) {
    if (v && v.isObject3D) animNodes.add(v);
    else if (Array.isArray(v)) for (const e of v) if (e && e.isObject3D) animNodes.add(e);
  }
  const dropNames = new Set(opts.skip || []);
  const meshes = [];
  g.traverse((o) => { if (o.isMesh) meshes.push(o); });
  let keptLive = false;
  for (const o of meshes) {
    let drop = false;
    for (let p = o; p && p !== g; p = p.parent) if (dropNames.has(p.name)) { drop = true; break; }
    if (drop) { o.parent.remove(o); o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => m.dispose()); continue; }
    if (hasAncestor(o, animNodes)) { keptLive = true; continue; }
    const baker = (opts.route && opts.route(o)) || ctx.baker;
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    geo.applyMatrix4(mat4);
    baker.add(geo, o.material);
    o.parent.remove(o);
    o.geometry.dispose();
  }
  if (keptLive) {
    g.position.set(x, y, z); g.rotation.y = rotY;
    ctx.live.add(g);
    ctx.liveAssets.push(asset);
  } else {
    const ms = [];
    g.traverse((o) => { if (o.isMesh) ms.push(o); });
  }
  return { asset, keptLive };
}

// ---------------------------------------------------------------- island
function buildIsland(rng, theme, holes) {
  const geos = [];
  // Floor tiles.
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 8; j++) {
      const x = -4.5 + i, z = -3.5 + j;
      if (holes.has(x + "," + z)) continue;
      box(geos, 0.98, 0.06, 0.98, x, -0.09, z, theme.base);
      for (const [dx, dz] of [[-0.245, -0.245], [0.245, -0.245], [-0.245, 0.245], [0.245, 0.245]]) {
        box(geos, 0.44, 0.06, 0.44, x + dx, -0.03, z + dz, theme.stones[Math.floor(rng() * theme.stones.length)]);
      }
      if (theme.moss.length && rng() < theme.mossChance) {
        const r = 0.1 + rng() * 0.1;
        const g = plain(new THREE.DodecahedronGeometry(1, 0));
        g.scale(r * 1.4, 0.05, r * 1.4);
        g.translate(x + (rng() - 0.5) * 0.6, 0.0, z + (rng() - 0.5) * 0.6);
        const c = theme.moss[Math.floor(rng() * theme.moss.length)];
        geos.push(paint(g, () => c));
      }
    }
  }
  // Violet grass lip and tufts.
  const lip = theme.grass;
  box(geos, 10.8, 0.16, 0.4, 0, -0.1, -4.2, lip);
  box(geos, 10.8, 0.16, 0.4, 0, -0.1, 4.2, lip);
  box(geos, 0.4, 0.16, 8.0, -5.2, -0.1, 0, lip);
  box(geos, 0.4, 0.16, 8.0, 5.2, -0.1, 0, lip);
  for (let i = 0; i < 40; i++) {
    const side = Math.floor(rng() * 4);
    let x, z;
    if (side === 0) { x = -5.3 + rng() * 10.6; z = 4.15 + rng() * 0.2; }
    else if (side === 1) { x = 5.15 + rng() * 0.2; z = -4.3 + rng() * 8.6; }
    else if (side === 2) { x = -5.3 + rng() * 10.6; z = -4.35 + rng() * 0.2; }
    else { x = -5.35 + rng() * 0.2; z = -4.3 + rng() * 8.6; }
    if (side === 2 || side === 3) continue; // hidden behind the walls
    const g = plain(new THREE.ConeGeometry(0.05 + rng() * 0.04, 0.16 + rng() * 0.12, 5));
    g.translate(x, 0.0, z);
    const c = rng() < 0.7 ? theme.tuft : 0xb090e8;
    geos.push(paint(g, () => c));
  }
  // Earth edge.
  const EARTH = 0x9a6a62, DEEP = 0x4a2f45;
  const eg = plain(new THREE.BoxGeometry(10.8, 0.6, 8.8));
  eg.translate(0, -0.5, 0);
  geos.push(paint(eg, (x, y) => lerpHex(EARTH, 0x80534f, (-0.2 - y) / 0.6 + hash3(x, y, 0) * 0.15)));
  // Rough tapered underside: three jittered frustum tiers (outward faces stay visible from above).
  let yTop = -0.8;
  for (const [hx, hz, bx, bz, h] of [[5.2, 4.2, 4.3, 3.4, 0.8], [4.1, 3.2, 3.0, 2.3, 0.75], [2.8, 2.1, 1.3, 1.0, 0.8]]) {
    let t = new THREE.CylinderGeometry(1, bx / hx, h, 4, 2, true);
    t.rotateY(Math.PI / 4);
    t.scale(hx / Math.SQRT1_2, 1, hz / Math.SQRT1_2);
    t.translate(0, yTop - h / 2, 0);
    t = plain(t);
    const p = t.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = (y > yTop - 0.01) ? 0.25 : 1;
      p.setXYZ(i, x + (hash3(x, y, z) - 0.5) * 0.5 * k, y + (hash3(z, x, y) - 0.5) * 0.18 * (y > yTop - 0.01 ? 0 : 1), z + (hash3(y, z, x) - 0.5) * 0.5 * k);
    }
    t.computeVertexNormals();
    geos.push(paint(t, (x, y) => lerpHex(0x8a5a58, DEEP, (-0.8 - y) / 2.5)));
    yTop -= h;
  }
  // Hanging rocks at the bottom.
  const n = 4 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const h = 0.5 + rng() * 0.8, r = 0.25 + rng() * 0.3;
    const g = plain(new THREE.ConeGeometry(r, h, 5));
    g.rotateX(Math.PI);
    g.rotateY(rng() * 3);
    g.translate((rng() - 0.5) * 2.0, yTop - h / 2 + 0.1, (rng() - 0.5) * 1.4);
    geos.push(paint(g, (x, y) => lerpHex(0x6a4348, DEEP, (yTop - y) / 1.2 + 0.3)));
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = "island";
  return mesh;
}

function buildRocks(rng, group) {
  const count = rng.int(3, 6);
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = false; mesh.name = "rocks";
  const data = [];
  const a0 = rng() * Math.PI * 2;
  const cols = [0x9a6a62, 0x6b5a80, 0x7a5a70, 0x8a7090];
  for (let i = 0; i < count; i++) {
    const a = a0 + (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    data.push({
      x: Math.cos(a) * (7.2 + rng() * 1.8), z: Math.sin(a) * (5.6 + rng() * 1.4),
      y: -1.0 + rng() * 2.0, s: 0.25 + rng() * 0.45, ph: rng() * 6.28, sp: 0.4 + rng() * 0.5,
      sy: 0.6 + rng() * 0.4,
    });
    mesh.setColorAt(i, tmpColor.setHex(cols[i % cols.length]));
  }
  group.add(mesh);
  const dummy = new THREE.Object3D();
  return {
    mesh, geo, mat,
    update(t) {
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        dummy.position.set(d.x, d.y + Math.sin(t * d.sp + d.ph) * 0.18, d.z);
        dummy.rotation.set(0.3 + d.ph * 0.1, t * 0.12 + d.ph, 0.2);
        dummy.scale.set(d.s, d.s * d.sy, d.s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- spike geometry
function spikeGeo() {
  const parts = [];
  const grid = [-0.28, 0, 0.28];
  for (const x of grid) for (const z of grid) {
    const g = plain(new THREE.ConeGeometry(0.05, 0.15, 8));
    g.translate(x, 0.075, z);
    parts.push(g);
  }
  const m = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return m;
}
function warnGeo() {
  const parts = [];
  const T = 0.035, O = 0.92, off = O / 2 - T / 2;
  for (const [w, d, x, z] of [[T, O, off, 0], [T, O, -off, 0], [O - 2 * T, T, 0, off], [O - 2 * T, T, 0, -off]]) {
    const g = plain(new THREE.BoxGeometry(w, 0.012, d));
    g.translate(x, 0.2 + 0.007, z);
    parts.push(g);
  }
  const m = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return m;
}
const TRAP_CYCLE = 2.4;
function trapUp(p) { return p < 0.5 ? 0 : p < 0.6 ? (p - 0.5) / 0.1 : p < 0.8 ? 1 : p < 0.9 ? 1 - (p - 0.8) / 0.1 : 0; }
function trapGlow(p) { return p < 0.3 ? 0.6 : p < 0.5 ? 0.6 + 0.9 * (p - 0.3) / 0.2 : p < 0.8 ? 1.5 : 0.6; }

// ---------------------------------------------------------------- room core
function makeRoomContext(world) {
  const group = new THREE.Group();
  return {
    group, live: new THREE.Group(), liveAssets: [], baker: new Baker(),
    ownedGeos: [], ownedMats: [], obstacles: [], hazards: [], animFns: [],
  };
}

function finishRoom(world, ctx, extra) {
  ctx.baker.build(ctx.group, ctx.ownedMats, ctx.ownedGeos);
  ctx.group.add(ctx.live);
  world.add(ctx.group);
  let disposed = false;
  const room = Object.assign({
    group: ctx.group,
    update(w, dt) {
      const t = w.time;
      for (const a of ctx.liveAssets) a.update(t);
      for (const f of ctx.animFns) f(w, t, dt);
    },
    dispose(w) {
      if (disposed) return; disposed = true;
      const wd = w || world;
      wd.remove(ctx.group);
      for (const o of ctx.obstacles) { const i = wd.obstacles.indexOf(o); if (i >= 0) wd.obstacles.splice(i, 1); }
      for (const h of ctx.hazards) { h.dead = true; h.dispose(wd); const i = wd.hazards.indexOf(h); if (i >= 0) wd.hazards.splice(i, 1); }
      ctx.group.traverse((o) => {
        if (!o.isMesh && !o.isInstancedMesh) return;
        if (o.geometry) o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (m && m.dispose) m.dispose();
        if (o.dispose) o.dispose();
      });
      for (const g of ctx.ownedGeos) g.dispose();
      for (const m of ctx.ownedMats) m.dispose();
    },
  }, extra);
  return room;
}

function addObstacle(world, ctx, x, z, r) {
  const o = { x, z, r };
  world.obstacles.push(o); ctx.obstacles.push(o);
  return o;
}

function addWalls(ctx, torchXs) {
  for (let i = 0; i < 10; i++) {
    const x = -4.5 + i;
    const torch = torchXs.includes(x);
    place(ctx, torch ? "tile-wall-torch" : "tile-wall", x, -0.04, -4.2, 0);
  }
  // Low wall along the -x edge (base only).
  for (let j = 0; j < 8; j++) {
    place(ctx, "tile-wall", -5.2, -0.04, -3.5 + j, Math.PI / 2, { skip: ["upper"] });
  }
  place(ctx, "tile-wall", -5.2, -0.04, -4.2, Math.PI / 2, { skip: ["upper"] });
}

function addExit(world, ctx, boss, open) {
  const exitGroup = new THREE.Group();
  ctx.group.add(exitGroup);
  const sealMat = new THREE.MeshStandardMaterial({ color: 0x3a2a5c, emissive: 0x8c5be0, emissiveIntensity: 0.5, transparent: true, opacity: 0.65, side: THREE.DoubleSide, flatShading: true });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xa070ff, emissive: 0xa070ff, emissiveIntensity: 0.9, flatShading: true });
  const seal = new THREE.Group();
  let portalLive = null;
  let ex, ez;
  if (boss) {
    ex = 0; ez = -3.5;
    const sub = { ...ctx, baker: new Baker(), live: exitGroup };
    place(sub, "tile-stairs-down", ex, 0, ez, 0);
    sub.baker.build(exitGroup, ctx.ownedMats, ctx.ownedGeos);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.1), sealMat);
    slab.position.set(0, 0.6, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 6, 20), ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.64, 0);
    seal.add(slab, ring);
    seal.position.set(ex, 0, ez);
  } else {
    ex = EXIT_POS.x; ez = EXIT_POS.z;
    const sub = { ...ctx, baker: new Baker(), live: exitGroup };
    place(sub, "vfx-portal", ex, 0, ez, 0);
    sub.baker.build(exitGroup, ctx.ownedMats, ctx.ownedGeos);
    portalLive = exitGroup.children.find((c) => c.name === "vfx-portal") || null;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), sealMat);
    disc.position.set(0, 1.15, 0.03);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20), ringMat);
    ring.position.set(0, 1.15, 0.06);
    seal.add(disc, ring);
    seal.position.set(ex, 0, ez);
  }
  exitGroup.add(seal);
  ctx.ownedMats.push(sealMat, ringMat);
  seal.traverse((o) => { if (o.isMesh) ctx.ownedGeos.push(o.geometry); });
  const blocker = { x: ex, z: ez + (boss ? 0 : 0.1), r: 0.65 };
  const exit = { x: ex, z: ez, open: false, group: exitGroup, setOpen(v) {
    exit.open = !!v;
    seal.visible = !v;
    if (portalLive) portalLive.traverse((o) => { if (o.name === "swirl" || o.name === "surface") o.visible = !!v; });
    const i = world.obstacles.indexOf(blocker);
    if (v && i >= 0) world.obstacles.splice(i, 1);
    if (!v && i < 0) world.obstacles.push(blocker);
  } };
  ctx.obstacles.push(blocker);
  ctx.animFns.push((w, t) => {
    if (!exit.open) { sealMat.emissiveIntensity = 0.45 + 0.2 * Math.sin(t * 3); seal.rotation.y = 0; }
  });
  exit.setOpen(!!open);
  return exit;
}


// ---------------------------------------------------------------- hazards
function addHazards(world, ctx, kind, cells) {
  const set = new Set(cells.map(([x, z]) => x + "," + z));
  if (!cells.length) return set;
  if (kind === "water") {
    const parts = [];
    for (const [x, z] of cells) {
      place(ctx, "tile-water", x, -0.12, z, 0, { skip: ["water", "ripple"] });
      const g = plain(new THREE.BoxGeometry(0.88, 0.02, 0.88));
      g.translate(x, -0.03, z);
      parts.push(g);
    }
    const wg = mergeGeometries(parts, false); parts.forEach((p) => p.dispose());
    const wm = new THREE.MeshStandardMaterial({ color: 0x5560a8, transparent: true, opacity: 0.6, depthWrite: false, flatShading: true, roughness: 0.4 });
    const wmesh = new THREE.Mesh(wg, wm);
    wmesh.receiveShadow = true; wmesh.name = "water";
    ctx.group.add(wmesh); ctx.ownedGeos.push(wg); ctx.ownedMats.push(wm);
    ctx.animFns.push((w, t) => { wmesh.position.y = Math.sin(t * 1.6) * 0.004; wm.opacity = 0.55 + 0.05 * Math.sin(t * 2.0); });
    let inside = false;
    const hz = {
      dead: false,
      update(w) {
        const p = w.player;
        if (!p || p.dead) return;
        let now = false;
        for (const [cx, cz] of cells) if (Math.abs(p.x - cx) < 0.5 && Math.abs(p.z - cz) < 0.5) { now = true; break; }
        // combat resets slowMul to 1 each frame after reading it, so set it every frame while inside
        if (now) { p.slowMul = Math.min(p.slowMul === undefined ? 1 : p.slowMul, 0.7); inside = true; }
        else inside = false;
      },
      dispose() { inside = false; },
    };
    world.hazards.push(hz); ctx.hazards.push(hz);
  } else if (kind === "spikes") {
    const sg = spikeGeo(), wg = warnGeo();
    ctx.ownedGeos.push(sg, wg);
    const metal = new THREE.MeshStandardMaterial({ color: 0xa9a7c4, flatShading: true, roughness: 0.8, metalness: 0.3 });
    ctx.ownedMats.push(metal);
    const traps = [];
    cells.forEach(([x, z], i) => {
      place(ctx, "tile-spike-trap", x, -0.2, z, 0, { skip: ["spikes", "warning"] });
      const sm = new THREE.Mesh(sg, metal); sm.position.set(x, -0.18, z); sm.castShadow = true; ctx.group.add(sm);
      const wmat = new THREE.MeshStandardMaterial({ color: 0xff3d5a, emissive: 0xff3d5a, emissiveIntensity: 0.6, flatShading: true });
      ctx.ownedMats.push(wmat);
      const wm = new THREE.Mesh(wg, wmat); wm.position.set(x, -0.2, z); ctx.group.add(wm);
      traps.push({ x, z, off: (i % 3) * 0.8 + i * 0.37, sm, wmat, lastHit: -1 });
    });
    ctx.animFns.push((w, t) => {
      for (const tr of traps) {
        const p = (((t + tr.off) % TRAP_CYCLE) + TRAP_CYCLE) % TRAP_CYCLE / TRAP_CYCLE;
        tr.sm.position.y = -0.2 + 0.02 + 0.18 * trapUp(p);
        tr.wmat.emissiveIntensity = trapGlow(p);
      }
    });
    const hz = {
      dead: false,
      update(w) {
        const p = w.player;
        if (!p || p.dead) return;
        for (const tr of traps) {
          const ph = (w.time + tr.off) / TRAP_CYCLE;
          const cyc = Math.floor(ph), frac = ph - cyc;
          if (frac >= 0.55 && frac < 0.85 && tr.lastHit !== cyc && Math.abs(p.x - tr.x) < 0.45 && Math.abs(p.z - tr.z) < 0.45) {
            tr.lastHit = cyc;
            damagePlayer(w, 12, "Spike trap");
          }
        }
      },
      dispose() {},
    };
    world.hazards.push(hz); ctx.hazards.push(hz);
  } else if (kind === "embers") {
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff7a2e, emissiveIntensity: 1.0, flatShading: true, roughness: 0.8 });
    ctx.ownedMats.push(glowMat);
    const glowBaker = new Baker(glowMat);
    for (const [x, z] of cells) {
      place(ctx, "tile-floor-cracked", x, -0.12, z, 0, { route: (o) => (o.name === "ember" || o.name.startsWith("crack")) ? glowBaker : null });
    }
    glowBaker.build(ctx.group, ctx.ownedMats, ctx.ownedGeos);
    ctx.animFns.push((w, t) => { glowMat.emissiveIntensity = 1.05 + 0.35 * Math.sin(t * 1.6); });
    let acc = 0, on = false;
    const hz = {
      dead: false,
      update(w, dt) {
        const p = w.player;
        if (!p || p.dead) return;
        let now = false;
        for (const [cx, cz] of cells) if (Math.abs(p.x - cx) < 0.5 && Math.abs(p.z - cz) < 0.5) { now = true; break; }
        if (!now) { on = false; return; }
        if (!on) { on = true; acc = 0.25; }
        acc += dt;
        while (acc >= 0.5) { acc -= 0.5; damagePlayer(w, 3, "Ember cracks"); }
      },
      dispose() {},
    };
    world.hazards.push(hz); ctx.hazards.push(hz);
  }
  return set;
}

// ---------------------------------------------------------------- waves
const POOLS = {
  1: ["skeleton", "skeleton", "slime", "slime", "rats", "archer", "bat"],
  2: ["skeleton", "slime", "rats", "archer", "bat", "ghost", "ghost", "spider", "spider", "knight", "brute"],
  3: ["skeleton", "archer", "bat", "ghost", "spider", "knight", "brute", "wisp", "wisp", "cultist", "cultist", "mushroom"],
};
const HEAVY = { brute: 1, knight: 1, cultist: 2, mushroom: 2, wisp: 3, archer: 2 };

export function waveFor(floor, index, rng, ctx) {
  const f = Math.max(1, Math.min(3, floor | 0 || 1));
  const idx = Math.max(0, index | 0);
  let n;
  if (f === 1) n = 3 + Math.min(3, Math.floor(idx * 0.75));
  else n = 3 + f + Math.min(3, Math.floor(idx * 0.7)) - 1;
  const obstacles = (ctx && ctx.obstacles) || [];
  const avoid = (ctx && ctx.avoid) || [];
  const start = (ctx && ctx.start) || START;
  const pool = POOLS[f];
  const out = [], counts = {};
  let guard = 0;
  while (out.length < n && guard++ < 400) {
    const type = pool[Math.floor(rng() * pool.length)];
    if (HEAVY[type] !== undefined && (counts[type] || 0) >= HEAVY[type] + (f === 3 && type !== "brute" ? 0 : 0)) continue;
    const x = -4.2 + rng() * 8.4;
    const z = -3.5 + rng() * (type === "archer" ? 2.2 : 3.7);
    if (Math.hypot(x - start.x, z - start.z) < 3.2) continue;
    if (Math.hypot(x - EXIT_POS.x, z - EXIT_POS.z) < 1.5) continue;
    let ok = true;
    for (const o of obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + 0.8) { ok = false; break; }
    if (!ok) continue;
    for (const a of avoid) if (Math.hypot(x - a.x, z - a.z) < (a.r || 0.7)) { ok = false; break; }
    if (!ok) continue;
    for (const s of out) if (Math.hypot(x - s.x, z - s.z) < 1.3) { ok = false; break; }
    if (!ok) continue;
    counts[type] = (counts[type] || 0) + 1;
    out.push({ type, x: +x.toFixed(2), z: +z.toFixed(2) });
  }
  return out;
}

// ---------------------------------------------------------------- buildRoom
export function buildRoom(world, { floor = 1, index = 0, boss = false, seed = 1 } = {}) {
  const f = Math.max(1, Math.min(3, floor | 0 || 1));
  const def = FLOORS[f];
  const theme = THEMES[f];
  const rng = createRng(hashString(`${seed}|${f}|${index}|${boss ? "b" : "r"}`));
  world.bounds = { minX: -5, maxX: 5, minZ: -4, maxZ: 4 };

  const layouts = boss ? BOSS_LAYOUTS : LAYOUTS;
  const layout = layouts[rng.int(0, layouts.length - 1)];
  const ctx = makeRoomContext(world);

  // Hazard cells (not on boss rooms).
  let cells = [];
  if (!boss && def.hazard) cells = def.hazard === "spikes" ? layout.cells.slice(0, 5) : def.hazard === "embers" ? layout.cells.slice(0, 5) : layout.cells.slice();
  const holes = new Set(cells.map(([x, z]) => x + "," + z));

  const island = buildIsland(rng, theme, holes);
  ctx.group.add(island);
  ctx.ownedGeos.push(island.geometry); ctx.ownedMats.push(island.material);

  addWalls(ctx, [-2.5, 2.5]);

  // Obstacles.
  const obsList = [];
  for (const [slot, x, z] of layout.obs) {
    const id = def.props[slot % def.props.length];
    const r = PROP_R[id] || 0.45;
    place(ctx, id, x, 0, z, (rng() - 0.5) * 0.6);
    obsList.push(addObstacle(world, ctx, x, z, r));
  }

  const exit = addExit(world, ctx, boss, false);
  if (!boss) addHazards(world, ctx, def.hazard, cells);

  const rocks = buildRocks(rng, ctx.group);
  ctx.ownedGeos.push(rocks.geo); ctx.ownedMats.push(rocks.mat);
  ctx.animFns.push((w, t) => rocks.update(t));
  rocks.update(0);

  let spawns = [];
  if (!boss) spawns = waveFor(f, index, rng, { obstacles: obsList, avoid: cells.map(([x, z]) => ({ x, z, r: 0.8 })) });

  const bossPos = { x: 0, z: -1.2 };
  return finishRoom(world, ctx, {
    playerStart: { x: START.x, z: START.z },
    spawns, exit,
    floor: f, boss: !!boss, bossId: boss ? def.boss : null, bossSpawn: boss ? bossPos : null,
  });
}

// ---------------------------------------------------------------- hub
export function buildHub(world) {
  world.bounds = { minX: -5, maxX: 5, minZ: -4, maxZ: 4 };
  const rng = createRng(hashString("hub"));
  const ctx = makeRoomContext(world);
  const island = buildIsland(rng, THEMES.hub, new Set());
  ctx.group.add(island);
  ctx.ownedGeos.push(island.geometry); ctx.ownedMats.push(island.material);
  addWalls(ctx, [-2.5, 2.5]);

  const props = [
    ["prop-campfire", 0, 0, 0, 0.55],
    ["prop-shop-stall", -3.3, -2.3, 0.1, 0.7],
    ["prop-weapon-rack", 3.3, -2.5, -0.1, 0.65],
    ["prop-cauldron", -3.4, 1.6, 0.6, 0.45],
    ["prop-altar", 3.4, 1.6, -0.6, 0.55],
  ];
  for (const [id, x, z, rot, r] of props) {
    place(ctx, id, x, 0, z, rot);
    addObstacle(world, ctx, x, z, r);
  }
  const exit = addExit(world, ctx, false, true);
  const rocks = buildRocks(rng, ctx.group);
  ctx.ownedGeos.push(rocks.geo); ctx.ownedMats.push(rocks.mat);
  ctx.animFns.push((w, t) => rocks.update(t));
  rocks.update(0);

  return finishRoom(world, ctx, { playerStart: { x: 0, z: 2.6 }, spawns: [], exit, hub: true, floor: 0, boss: false });
}
