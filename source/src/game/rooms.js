// Module D: rooms and floors. Seeded procedural floor plans rendered as floating island dioramas.
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
  1: { base: 0x3d3350, stones: [0x6b5a80, 0x7a6a92, 0x5e4f76], moss: [0x3f6b5e, 0x5a9a80], mossChance: 0.4, grass: 0x7a6ab0, tuft: 0x7cc8a0, root: 0x4a5a3a },
  2: { base: 0x34304a, stones: [0x5e5a78, 0x6c6890, 0x514d6c], moss: [], mossChance: 0, grass: 0x6a6aa0, tuft: 0x8fb0c8, root: 0x4a3a40 },
  3: { base: 0x2a2548, stones: [0x4a4a86, 0x5560a8, 0x3e3a70], moss: [], mossChance: 0, grass: 0x7a5ab8, tuft: 0xa070ff, root: 0x3a2a5a },
  hub: { base: 0x3d3350, stones: [0x6b5a80, 0x7a6a92, 0x5e4f76], moss: [0x3f6b5e, 0x5a9a80], mossChance: 0.3, grass: 0x7a6ab0, tuft: 0x7cc8a0, root: 0x4a5a3a },
};

const PROP_R = { "tile-pillar": 0.4, "prop-statue": 0.45, "prop-barrels": 0.5, "prop-gravestones": 0.5, "prop-brazier": 0.3, "prop-chest": 0.5, "prop-campfire": 0.55 };
const START = { x: 0, z: 3.0 };
const EXIT_POS = { x: 0, z: -3.3 };

const SIGN_COLORS = { combat: 0xffb060, elite: 0xff3d5a, treasure: 0xf0b860, rest: 0x6fe0c0, boss: 0xff3d5a, stairs: 0xa070ff };

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
      for (const g of b.geos) g.dispose(); // plain() normalises attributes, so the merge always succeeds
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
  }
  return { asset, keptLive };
}
// ================================================================ procedural layout (pure: no rendering)
// Cell kinds: 0 void/outside, 1 floor, 2 pit (void hole inside the room), 3 wall stub (solid block).
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function openOnly(k, W, H) {
  // keep only cells that belong to some fully walkable 2x2 block (removes 1-wide spurs)
  const out = new Uint8Array(W * H);
  for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
    if (k[j * W + i] && k[j * W + i + 1] && k[(j + 1) * W + i] && k[(j + 1) * W + i + 1]) {
      out[j * W + i] = out[j * W + i + 1] = out[(j + 1) * W + i] = out[(j + 1) * W + i + 1] = 1;
    }
  }
  return out;
}
function largest(k, W, H) {
  const seen = new Int32Array(W * H).fill(-1); let best = -1, bestN = 0, id = 0;
  for (let s = 0; s < W * H; s++) {
    if (!k[s] || seen[s] >= 0) continue;
    const q = [s]; seen[s] = id; let n = 0;
    while (q.length) {
      const c = q.pop(); n++;
      const i = c % W, j = (c / W) | 0;
      for (const [di, dj] of D4) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue; const t = b * W + a; if (k[t] && seen[t] < 0) { seen[t] = id; q.push(t); } }
    }
    if (n > bestN) { bestN = n; best = id; }
    id++;
  }
  const out = new Uint8Array(W * H);
  for (let s = 0; s < W * H; s++) if (seen[s] === best) out[s] = 1;
  return out;
}
function fillRect(k, W, x, y, w, h, v) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) k[j * W + i] = v; }

function shapeNormal(rng) {
  const W = rng.int(9, 13), H = rng.int(7, 10);
  let k = new Uint8Array(W * H);
  const cw = rng.int(Math.max(5, W - 5), W - 2), ch = rng.int(Math.max(4, H - 4), H - 2);
  const cxo = rng.int(1, W - cw - 1), cyo = rng.int(0, H - ch);
  fillRect(k, W, cxo, cyo, cw, ch, 1);
  const extras = rng.int(2, 4);
  for (let n = 0; n < extras; n++) {
    for (let t = 0; t < 8; t++) {
      const rw = Math.min(W, rng.int(3, 6)), rh = Math.min(H, rng.int(3, 5));
      const rx = rng.int(0, W - rw), ry = rng.int(0, H - rh);
      const ox = Math.min(rx + rw, cxo + cw) - Math.max(rx, cxo), oy = Math.min(ry + rh, cyo + ch) - Math.max(ry, cyo);
      if (ox >= 2 && oy >= 2) { fillRect(k, W, rx, ry, rw, rh, 1); break; }
    }
  }
  // notches: corner bites and edge bays
  const notches = rng.int(0, 2);
  for (let n = 0; n < notches; n++) {
    if (rng() < 0.6) {
      const nw = rng.int(2, 4), nh = rng.int(2, 3), c = rng.int(0, 3);
      fillRect(k, W, (c & 1) ? W - nw : 0, (c & 2) ? H - nh : 0, nw, nh, 0);
    } else {
      const side = rng.int(0, 3), len = rng.int(2, 3), dep = rng.int(1, 2);
      if (side < 2) { const x = rng.int(1, Math.max(1, W - len - 1)); fillRect(k, W, x, side ? H - dep : 0, len, dep, 0); }
      else { const y = rng.int(1, Math.max(1, H - len - 1)); fillRect(k, W, side === 2 ? 0 : W - dep, y, dep, len, 0); }
    }
  }
  // chamfer some convex corners
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!k[j * W + i]) continue;
    const L = i === 0 || !k[j * W + i - 1], R = i === W - 1 || !k[j * W + i + 1], U = j === 0 || !k[(j - 1) * W + i], D = j === H - 1 || !k[(j + 1) * W + i];
    if (((L || R) && (U || D)) && rng() < 0.3) k[j * W + i] = 0;
  }
  k = largest(openOnly(k, W, H), W, H);
  return { k, W, H };
}
function shapeBoss(rng) {
  const W = rng.int(12, 13), H = 10;
  const p = 2 + rng() * 0.9;
  let k = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = (i + 0.5 - W / 2) / (W / 2), v = (j + 0.5 - H / 2) / (H / 2);
    const n = (hash3(i, j, 7) - 0.5) * 0.14;
    if (Math.pow(Math.abs(u), p) + Math.pow(Math.abs(v), p) <= 1.0 + n) k[j * W + i] = 1;
  }
  k = largest(openOnly(k, W, H), W, H);
  return { k, W, H };
}

function cropToLayout(shape, floor, boss) {
  const { k, W, H } = shape;
  let minI = W, maxI = -1, minJ = H, maxJ = -1, count = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (k[j * W + i]) { count++; minI = Math.min(minI, i); maxI = Math.max(maxI, i); minJ = Math.min(minJ, j); maxJ = Math.max(maxJ, j); }
  const w = maxI - minI + 1, h = maxJ - minJ + 1;
  if (boss ? (w < 11 || h < 9 || count < 80) : (w < 9 || h < 7 || count < 42)) return null;
  const kind = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) kind[j * w + i] = k[(j + minJ) * W + i + minI];
  return makeLayoutBase(kind, w, h, floor, boss);
}
function makeLayoutBase(kind, w, h, floor, boss) {
  return { w, h, x0: -w / 2, z0: -h / 2, kind, floor, boss, walk: null, start: null, exits: [], obstacles: [], hazardKind: null, hazards: [], reach: null, blocked: null, hazMask: null, chest: null, campfire: null, bossSpawn: null, bounds: null };
}
export function rectLayout(w, h) { return makeLayoutBase(new Uint8Array(w * h).fill(1), w, h, 1, false); }

const kAt = (L, i, j) => (i < 0 || j < 0 || i >= L.w || j >= L.h) ? 0 : L.kind[j * L.w + i];
const ccx = (L, i) => L.x0 + i + 0.5, ccz = (L, j) => L.z0 + j + 0.5;

function ringClear(L, i0, j0, iw, ih) {
  for (let j = j0 - 1; j <= j0 + ih; j++) for (let i = i0 - 1; i <= i0 + iw; i++) if (kAt(L, i, j) !== 1) return false;
  return true;
}
function addFeatures(rng, L, f, boss) {
  if (boss) return;
  const nPit = f === 3 ? rng.int(1, 2) : f === 2 ? (rng() < 0.5 ? 1 : 0) : (rng() < 0.3 ? 1 : 0);
  const sizes = f === 3 ? [[1, 1], [2, 1], [1, 2], [2, 2]] : [[1, 1], [2, 1], [1, 2]];
  for (let n = 0; n < nPit; n++) for (let t = 0; t < 20; t++) {
    const [pw, ph] = rng.pick(sizes), i = rng.int(1, L.w - pw - 1), j = rng.int(1, L.h - ph - 1);
    if (!ringClear(L, i, j, pw, ph)) continue;
    for (let b = 0; b < ph; b++) for (let a = 0; a < pw; a++) L.kind[(j + b) * L.w + i + a] = 2;
    break;
  }
  const nStub = rng() < 0.55 ? rng.int(1, 2) : 0;
  for (let n = 0; n < nStub; n++) for (let t = 0; t < 20; t++) {
    const [pw, ph] = rng.pick([[1, 1], [2, 1], [1, 2]]), i = rng.int(1, L.w - pw - 1), j = rng.int(1, L.h - ph - 1);
    if (!ringClear(L, i, j, pw, ph)) continue;
    for (let b = 0; b < ph; b++) for (let a = 0; a < pw; a++) L.kind[(j + b) * L.w + i + a] = 3;
    break;
  }
}

function flood(L, si, sj, blocked) {
  const { w, h, kind } = L; const r = new Uint8Array(w * h); const q = [si + sj * w]; r[q[0]] = 1;
  while (q.length) {
    const c = q.pop(), i = c % w, j = (c / w) | 0;
    for (const [di, dj] of D4) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= w || b >= h) continue; const t = b * w + a; if (kind[t] === 1 && !blocked[t] && !r[t]) { r[t] = 1; q.push(t); } }
  }
  return r;
}

function isTall(L, i, j) {
  if (kAt(L, i, j - 1) !== 0) return false;
  for (let b = 1; b <= 2; b++) for (let a = 1; a <= 2; a++) if (kAt(L, i - a, j - b) !== 0) return false;
  return true;
}

function populate(rng, L, f, boss, nEx, level, roomType) {
  L.chest = null; L.campfire = null;
  const { w, h } = L, idx = (i, j) => j * w + i;
  const clean3 = (i, j) => { for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const k = kAt(L, i + a, j + b); if (k === 2 || k === 3) return false; } return true; };
  const cells = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (kAt(L, i, j) === 1) cells.push({ i, j, x: ccx(L, i), z: ccz(L, j) });
  const midX = L.x0 + w / 2;
  // start: front edge cell near the middle
  let pool = cells.filter((c) => clean3(c.i, c.j) && kAt(L, c.i, c.j + 1) === 0 && kAt(L, c.i, c.j - 1) === 1 && kAt(L, c.i - 1, c.j) === 1 && kAt(L, c.i + 1, c.j) === 1);
  if (!pool.length) pool = cells.filter((c) => clean3(c.i, c.j) && kAt(L, c.i + 1, c.j) === 0 && kAt(L, c.i - 1, c.j) === 1 && kAt(L, c.i, c.j - 1) === 1 && kAt(L, c.i, c.j + 1) === 1);
  if (!pool.length) return false;
  pool.sort((a, b) => Math.abs(a.x - midX) - Math.abs(b.x - midX));
  const start = pool[rng.int(0, Math.min(3, pool.length - 1))];
  // exits: back edge cells far from the start
  const ec = cells.filter((c) => kAt(L, c.i, c.j - 1) === 0 && kAt(L, c.i, c.j + 1) === 1 && clean3(c.i, c.j) && Math.hypot(c.x - start.x, c.z - start.z) >= 4.5)
    .map((c) => ({ ...c, score: Math.hypot(c.x - start.x, c.z - start.z) + (isTall(L, c.i, c.j) ? 3 : 0) + rng() * 3 }))
    .sort((a, b) => b.score - a.score);
  if (!ec.length) return false;
  const exits = [ec[0]];
  if (nEx > 1) {
    const e2 = ec.find((c) => Math.hypot(c.x - exits[0].x, c.z - exits[0].z) >= 4.2);
    if (!e2) return false;
    exits.push(e2);
  }
  exits.sort((a, b) => a.x - b.x);
  const far = (x, z, d) => Math.hypot(x - start.x, z - start.z) >= d && exits.every((e) => Math.hypot(x - e.x, z - e.z) >= d);
  // boss spawn
  let bossSpawn = null;
  if (boss) {
    const tx = midX, tz = L.z0 + h * 0.4;
    bossSpawn = cells.reduce((b, c) => (Math.hypot(c.x - tx, c.z - tz) < Math.hypot(b.x - tx, b.z - tz) ? c : b));
  }
  const obs = [];
  const obsAt = new Set();
  const spaced = (c, d) => obs.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= d);
  const addObs = (c, id, r, extra) => { obs.push({ x: c.x, z: c.z, r, id, i: c.i, j: c.j, ...extra }); obsAt.add(idx(c.i, c.j)); };
  const def = FLOORS[f];
  // chest / campfire first
  if (!boss && roomType === "treasure") {
    const cc = cells.filter((c) => kAt(L, c.i, c.j - 1) === 0 && far(c.x, c.z, 2.4) && clean3(c.i, c.j))
      .map((c) => ({ c, s: (isTall(L, c.i, c.j) ? 2 : 0) + rng() * 2 + Math.hypot(c.x - start.x, c.z - start.z) * 0.2 })).sort((a, b) => b.s - a.s);
    if (!cc.length) return false;
    addObs(cc[0].c, "prop-chest", PROP_R["prop-chest"], { chest: true });
    L.chest = { x: cc[0].c.x, z: cc[0].c.z + 0.1, i: cc[0].c.i, j: cc[0].c.j };
  }
  if (!boss && roomType === "rest") {
    let mx = 0, mz = 0; for (const c of cells) { mx += c.x; mz += c.z; } mx /= cells.length; mz /= cells.length;
    const cc = cells.filter((c) => far(c.x, c.z, 2.4) && clean3(c.i, c.j)).sort((a, b) => Math.hypot(a.x - mx, a.z - mz) - Math.hypot(b.x - mx, b.z - mz));
    if (!cc.length) return false;
    addObs(cc[0], "prop-campfire", PROP_R["prop-campfire"], { campfire: true });
    L.campfire = { x: cc[0].x, z: cc[0].z, i: cc[0].i, j: cc[0].j };
  }
  // theme props
  let nObs = boss ? rng.int(2, 3) : roomType === "rest" ? rng.int(1, 3) : rng.int(2, 6);
  if (level === 1) nObs = Math.min(nObs, 3);
  if (level >= 2) nObs = 0;
  const sd = sdField(L);
  const oc = cells.filter((c) => far(c.x, c.z, 2.2) && (!bossSpawn || Math.hypot(c.x - bossSpawn.x, c.z - bossSpawn.z) >= 3.5))
    .map((c) => ({ c, key: rng() + (sd[idx(c.i, c.j)] >= 2 ? 0 : 0.5) })).sort((a, b) => a.key - b.key);
  let placed = 0;
  for (const { c } of oc) {
    if (placed >= nObs) break;
    if (!spaced(c, 2.2)) continue;
    const slot = rng.int(0, def.props.length - 1), id = def.props[slot];
    addObs(c, id, PROP_R[id], { slot }); placed++; // every theme prop has a radius
  }
  const blocked = new Uint8Array(w * h);
  for (const o of obs) blocked[idx(o.i, o.j)] = 1;
  const reach = flood(L, start.i, start.j, blocked);
  if (!exits.every((e) => reach[idx(e.i, e.j)])) return false;
  for (const c of cells) if (!blocked[idx(c.i, c.j)] && !reach[idx(c.i, c.j)]) return false;
  // hazards
  const hazMask = new Uint8Array(w * h), hz = [];
  const hazKind = (!boss && level < 2 && roomType !== "rest") ? def.hazard : null;
  const elig = (c) => !blocked[idx(c.i, c.j)] && !hazMask[idx(c.i, c.j)] && far(c.x, c.z, 2.0);
  const mark = (c) => { hazMask[idx(c.i, c.j)] = 1; hz.push([c.x, c.z]); };
  const cellOf = (i, j) => (kAt(L, i, j) === 1 ? { i, j, x: ccx(L, i), z: ccz(L, j) } : null);
  if (hazKind === "water") {
    const nb = level ? 1 : rng.int(1, 3);
    for (let b = 0; b < nb; b++) {
      for (const seed of rng.shuffle(cells.filter(elig)).slice(0, 1)) { // no eligible cell: no pool
      const blob = [seed]; mark(seed);
      const size = rng.int(2, 6);
      for (let t = 0; t < size - 1; t++) {
        const opts = [];
        for (const bc of blob) for (const [di, dj] of D4) { const c = cellOf(bc.i + di, bc.j + dj); if (c && elig(c)) opts.push(c); }
        if (!opts.length) break;
        const c = rng.pick(opts); blob.push(c); mark(c);
      }
      }
    }
  } else if (hazKind === "spikes") {
    const n = level ? 4 : rng.int(4, 8);
    const hs = [];
    for (const c of rng.shuffle(cells.filter(elig))) {
      if (hs.length >= n) break;
      if (hs.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= 1.5)) { hs.push(c); mark(c); }
    }
  } else if (hazKind === "embers") {
    const nl = level ? 1 : rng.int(2, 3);
    for (let b = 0; b < nl; b++) {
      const seeds = rng.shuffle(cells.filter(elig)); if (!seeds.length) break;
      const len = rng.int(2, 4), dir = rng() < 0.5 ? [1, 0] : [0, 1];
      let c = seeds[0];
      for (let t = 0; t < len && c && elig(c); t++) { mark(c); c = cellOf(c.i + dir[0], c.j + dir[1]); }
    }
  }
  if (hazKind && hz.length < 2) return false;
  if (!boss && roomType !== "rest") {
    let n = 0;
    for (const c of cells) if (reach[idx(c.i, c.j)] && !blocked[idx(c.i, c.j)] && !hazMask[idx(c.i, c.j)] && Math.hypot(c.x - start.x, c.z - start.z) >= 3.2 && exits.every((e) => Math.hypot(c.x - e.x, c.z - e.z) >= 1.8)) n++;
    if (n < 16) return false;
  }
  L.start = start; L.exits = exits; L.obstacles = obs; L.hazardKind = hazKind; L.hazards = hz; L.reach = reach; L.blocked = blocked; L.hazMask = hazMask; L.bossSpawn = bossSpawn;
  return true;
}
function sdField(L) {
  // distance (in cells, 4-neighbour) from the outer void; pits/stubs count as solid
  const { w, h } = L, sd = new Int16Array(w * h).fill(-1), q = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (kAt(L, i, j) !== 0 && D4.some(([a, b]) => kAt(L, i + a, j + b) === 0)) { sd[j * w + i] = 1; q.push(j * w + i); }
  for (let n = 0; n < q.length; n++) {
    const c = q[n], i = c % w, j = (c / w) | 0;
    for (const [a, b] of D4) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= w || y >= h || kAt(L, x, y) === 0 || sd[y * w + x] >= 0) continue; sd[y * w + x] = sd[c] + 1; q.push(y * w + x); }
  }
  return sd;
}

function finalizeLayout(L) {
  const { w, h } = L;
  L.walk = new Uint8Array(w * h);
  for (let n = 0; n < w * h; n++) L.walk[n] = L.kind[n] === 1 ? 1 : 0;
  let minI = w, maxI = -1, minJ = h, maxJ = -1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (L.walk[j * w + i]) { minI = Math.min(minI, i); maxI = Math.max(maxI, i); minJ = Math.min(minJ, j); maxJ = Math.max(maxJ, j); }
  L.bounds = { minX: L.x0 + minI, maxX: L.x0 + maxI + 1, minZ: L.z0 + minJ, maxZ: L.z0 + maxJ + 1 };
  return L;
}

// generateLayout(seed, floor, boss, exitsCount, index, roomType) -> layout (deterministic from the arguments)
// opts is a test seam: { attempts } caps the procedural tries, { lateFrom } is the try that starts accepting
// bare rooms (default 90), { rect: [w, h] } sizes the rectangle fallback.
export function generateLayout(seed, floor = 1, boss = false, exitsCount = 1, index = 0, roomType = "combat", opts = {}) {
  const attempts = opts.attempts ?? 120, lateFrom = opts.lateFrom ?? 90, rect = opts.rect || (boss ? [12, 10] : [11, 8]);
  const f = Math.max(1, Math.min(3, floor | 0 || 1));
  const nEx = Math.max(1, Math.min(2, (Array.isArray(exitsCount) ? exitsCount.length : exitsCount) | 0 || 1));
  const rt = boss ? "combat" : roomType;
  const rng = createRng(hashString(`${seed}|${f}|${index}|${boss ? "b" : "r"}|${rt}|layout`));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const L = cropToLayout(boss ? shapeBoss(rng) : shapeNormal(rng), f, boss);
    if (!L) continue;
    addFeatures(rng, L, f, boss);
    const last = attempt >= lateFrom; // late attempts accept bare rooms
    for (let t = 0; t < 10; t++) {
      const level = last ? 2 : t < 7 ? 0 : 1;
      if (populate(rng, L, f, boss, nEx, level, rt)) return finalizeLayout(L);
    }
  }
  // fallback: plain rectangle, retried with fewer props
  for (let t = 0; t < 40; t++) {
    const L = rectLayout(rect[0], rect[1]); L.floor = f; L.boss = boss;
    if (populate(rng, L, f, boss, nEx, t < 20 ? 1 : 2, rt)) return finalizeLayout(L);
  }
  throw new Error("generateLayout failed");
}

// ---------------------------------------------------------------- extra geometry helpers
function shade(hex, k) { tmpColor.setHex(hex); tmpColor.multiplyScalar(k); return tmpColor.getHex(); }
function boxR(list, w, h, d, x, y, z, color, ry = 0) {
  const g = plain(new THREE.BoxGeometry(w, h, d));
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  list.push(paint(g, () => color));
}

// ---------------------------------------------------------------- island
// Builds the floating island for a layout: floor tiles, rims, earth band, tapered rock underside, roots, pits.
function buildIsland(rng, theme, L) {
  const geos = [], glowGeos = [];
  const { w, h } = L;
  const K = (i, j) => kAt(L, i, j);
  const X = (i) => ccx(L, i), Z = (j) => ccz(L, j);
  const EARTH = 0x9a6a62, DEEP = 0x4a2f45;
  const hazMask = L.hazMask;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = K(i, j);
    if (k === 0) continue;
    const x = X(i), z = Z(j);
    const nVoid = D4.map(([a, b]) => K(i + a, j + b) === 0);
    const nPit = D4.some(([a, b]) => K(i + a, j + b) === 2);
    const boundary = nVoid.some(Boolean);
    if (k === 2) {
      boxR(geos, 1.0, 0.04, 1.0, x, -0.78, z, 0x0a0614);
      const c = plain(new THREE.CircleGeometry(0.62, 10));
      c.rotateX(-Math.PI / 2); c.translate(x, -0.5, z);
      const pa = c.attributes.position, col = new Float32Array(pa.count * 3);
      for (let v = 0; v < pa.count; v++) {
        const d = Math.hypot(pa.getX(v) - x, pa.getZ(v) - z) / 0.62;
        const t = Math.max(0, 1 - d) * 0.55;
        col[v * 3] = 0.42 * t; col[v * 3 + 1] = 0.2 * t; col[v * 3 + 2] = 0.9 * t;
      }
      c.setAttribute("color", new THREE.BufferAttribute(col, 3));
      glowGeos.push(c);
      // thin cracked rim around the hole
      for (const [a, b] of D4) if (K(i + a, j + b) === 1) {
        const horiz = a !== 0;
        boxR(geos, horiz ? 0.14 : 1.0, 0.1, horiz ? 1.0 : 0.14, x + a * 0.43, -0.06, z + b * 0.43, shade(theme.base, 0.7));
      }
      continue;
    }
    if (k === 3) {
      const hh = 0.28 + rng() * 0.2;
      boxR(geos, 0.96, hh, 0.96, x, hh / 2 - 0.02, z, shade(theme.stones[0], 0.8 + rng() * 0.2));
      boxR(geos, 1.0, 0.07, 1.0, x, hh - 0.02, z, shade(theme.stones[1], 1.1));
      for (let r = 0; r < 3; r++) { const g = plain(new THREE.DodecahedronGeometry(0.07 + rng() * 0.05, 0)); g.translate(x + (rng() - 0.5) * 1.1, 0.04, z + (rng() - 0.5) * 1.1); const c = shade(theme.stones[1], 0.8); geos.push(paint(g, () => c)); }
    }
    // earth block (only where it can be seen: edges and pit walls)
    if (boundary || nPit) {
      const extra = boundary ? rng() * 0.25 : 0, hh = 0.7 + extra, dark = nPit ? 0.5 : 1;
      const g = plain(new THREE.BoxGeometry(1.0, hh, 1.0));
      g.translate(x, -0.1 - hh / 2, z);
      geos.push(paint(g, (px, py, pz) => shade(lerpHex(EARTH, 0x80534f, (-0.1 - py) / hh * 0.9 + hash3(px, py, pz) * 0.18), dark * (py < -0.7 ? 0.8 : 1))));
    }
    if (k === 3) continue;
    // floor tile
    if (!hazMask[j * w + i]) {
      const chk = ((i + j) & 1) ? 1.04 : 0.96, nz = 1 + (rng() - 0.5) * 0.16;
      boxR(geos, 0.98, 0.06, 0.98, x, -0.09, z, shade(theme.base, chk * nz));
      const broken = rng() < 0.08, cracked = !broken && rng() < 0.1;
      const missing = broken ? rng.int(0, 3) : -1;
      let q = 0;
      for (const [dx, dz] of [[-0.245, -0.245], [0.245, -0.245], [-0.245, 0.245], [0.245, 0.245]]) {
        if (q === missing) { q++; continue; }
        const sunk = broken && q === (missing + 1) % 4 ? 0.022 : 0;
        boxR(geos, 0.44, 0.06 - sunk, 0.44, x + dx, -0.03 - sunk / 2, z + dz, shade(theme.stones[Math.floor(rng() * theme.stones.length)], chk * (1 + (rng() - 0.5) * 0.2)));
        q++;
      }
      if (broken || cracked) {
        const a = rng() * Math.PI;
        boxR(geos, 0.62, 0.012, 0.04, x + (rng() - 0.5) * 0.2, 0.004, z + (rng() - 0.5) * 0.2, 0x151024, a);
        boxR(geos, 0.34, 0.012, 0.035, x + (rng() - 0.5) * 0.3, 0.004, z + (rng() - 0.5) * 0.3, 0x151024, a + 1.0 + rng());
      }
      if (broken) {
        const mx = (missing & 1 ? 0.245 : -0.245), mz = (missing & 2 ? 0.245 : -0.245);
        for (let r = 0; r < 3; r++) { const g = plain(new THREE.DodecahedronGeometry(0.04 + rng() * 0.05, 0)); g.translate(x + mx + (rng() - 0.5) * 0.3, -0.04, z + mz + (rng() - 0.5) * 0.3); const c = shade(theme.stones[1], 0.65 + rng() * 0.3); geos.push(paint(g, () => c)); }
      } else if (rng() < 0.05) {
        const g = plain(new THREE.DodecahedronGeometry(0.05 + rng() * 0.04, 0)); g.translate(x + (rng() - 0.5) * 0.7, 0.02, z + (rng() - 0.5) * 0.7);
        const c = shade(theme.stones[2], 0.9); geos.push(paint(g, () => c));
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
    // grass lip on outer edges
    const lipC = () => shade(theme.grass, 0.92 + rng() * 0.16);
    for (let n = 0; n < 4; n++) {
      if (!nVoid[n]) continue;
      const [a, b] = D4[n], horiz = a !== 0;
      boxR(geos, horiz ? 0.4 : 1.0, 0.16, horiz ? 1.0 : 0.4, x + a * 0.7, -0.1, z + b * 0.7, lipC());
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (K(i + sx, j) === 0 && K(i, j + sz) === 0) boxR(geos, 0.4, 0.16, 0.4, x + sx * 0.7, -0.1, z + sz * 0.7, lipC());
    }
    // tufts and hanging roots on the visible (front) edges
    for (const n of [0, 2]) {
      if (!nVoid[n]) continue;
      const [a, b] = D4[n], horiz = a !== 0;
      const nt = rng.int(2, 4);
      for (let t = 0; t < nt; t++) {
        const along = (rng() - 0.5) * 1.0;
        const g = plain(new THREE.ConeGeometry(0.05 + rng() * 0.04, 0.16 + rng() * 0.14, 5));
        g.translate(x + (horiz ? a * (0.55 + rng() * 0.25) : along), 0.0, z + (horiz ? along : b * (0.55 + rng() * 0.25)));
        const c = rng() < 0.7 ? theme.tuft : 0xb090e8;
        geos.push(paint(g, () => c));
      }
      const nr = rng() < 0.6 ? rng.int(1, 3) : 0;
      for (let t = 0; t < nr; t++) {
        const along = (rng() - 0.5) * 0.9, len = 0.45 + rng() * 0.75;
        const g = plain(new THREE.ConeGeometry(0.03 + rng() * 0.03, len, 4));
        g.rotateX(Math.PI);
        g.translate(x + (horiz ? a * 0.53 : along), -0.12 - len / 2, z + (horiz ? along : b * 0.53));
        const top = shade(theme.root, 1.2), bot = shade(theme.root, 0.6);
        geos.push(paint(g, (px, py) => (py > -0.12 - len / 2 ? top : bot)));
      }
    }
  }
  buildBowl(rng, L, geos, theme);
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = "island";
  let glow = null;
  if (glowGeos.length) {
    const gm = mergeGeometries(glowGeos, false); glowGeos.forEach((g) => g.dispose());
    const gmat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    glow = new THREE.Mesh(gm, gmat); glow.name = "pitglow"; glow.renderOrder = 2;
  }
  return { mesh, glow };
}

// Tapered rock underside: a bowl heightfield (0.5 tile lattice) that starts at the outline and deepens inwards.
function buildBowl(rng, L, geos, theme) {
  const { w, h } = L, N = 2, W2 = w * N + 1, H2 = h * N + 1, TOP = -0.78;
  const K = (i, j) => kAt(L, i, j);
  const sdAt = (vx, vz) => {
    let best = 4;
    const ci = Math.floor(vx - L.x0), cj = Math.floor(vz - L.z0);
    for (let j = cj - 4; j <= cj + 4; j++) for (let i = ci - 4; i <= ci + 4; i++) {
      if (K(i, j) !== 0) continue;
      const x0 = L.x0 + i, z0 = L.z0 + j;
      const dx = Math.max(x0 - vx, 0, vx - (x0 + 1)), dz = Math.max(z0 - vz, 0, vz - (z0 + 1));
      const d = Math.hypot(dx, dz); if (d < best) best = d;
    }
    return best;
  };
  const px = new Float32Array(W2 * H2), py = new Float32Array(W2 * H2), pz = new Float32Array(W2 * H2), dp = new Float32Array(W2 * H2);
  for (let b = 0; b < H2; b++) for (let a = 0; a < W2; a++) {
    const n = b * W2 + a, vx = L.x0 + a / N, vz = L.z0 + b / N, sd = sdAt(vx, vz);
    const dep = 3.0 * (1 - Math.exp(-sd / 1.15)) * (1 + (hash3(a, b, 3) - 0.5) * 0.4);
    const j = sd > 0.05 ? 0.12 : 0;
    px[n] = vx + (hash3(a, b, 1) - 0.5) * j * 2; pz[n] = vz + (hash3(a, b, 2) - 0.5) * j * 2;
    py[n] = TOP - dep; dp[n] = dep;
  }
  const pos = [], col = [];
  const push = (n) => {
    pos.push(px[n], py[n], pz[n]);
    const t = Math.min(1, dp[n] / 2.9);
    tmpColor.setHex(t < 0.35 ? lerpHex(0x8a5a58, 0x70485a, t / 0.35) : lerpHex(0x70485a, 0x34213f, (t - 0.35) / 0.65));
    col.push(tmpColor.r, tmpColor.g, tmpColor.b);
  };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (K(i, j) === 0) continue;
    for (let sb = 0; sb < N; sb++) for (let sa = 0; sa < N; sa++) {
      const a = i * N + sa, b = j * N + sb;
      const p00 = b * W2 + a, p10 = p00 + 1, p01 = p00 + W2, p11 = p01 + 1;
      push(p00); push(p10); push(p01); push(p10); push(p11); push(p01);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  geos.push(g);
  // hanging rocks at the deepest points
  const deep = [];
  for (let n = 0; n < W2 * H2; n++) if (dp[n] > 2.1) deep.push(n);
  const cnt = Math.min(deep.length, 4 + Math.floor(rng() * 3));
  for (let c = 0; c < cnt; c++) {
    const n = deep.splice(Math.floor(rng() * deep.length), 1)[0];
    const hh = 0.5 + rng() * 0.8, r = 0.22 + rng() * 0.26;
    const cg = plain(new THREE.ConeGeometry(r, hh, 5));
    cg.rotateX(Math.PI); cg.rotateY(rng() * 3);
    cg.translate(px[n], py[n] - hh / 2 + 0.1, pz[n]);
    const bottom = py[n] - hh;
    geos.push(paint(cg, (x, y) => lerpHex(0x6a4348, 0x2a1830, (py[n] - y) / 1.2 + 0.3)));
  }
}

function buildRocks(rng, group, L) {
  const count = rng.int(3, 6);
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.95 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = false; mesh.name = "rocks";
  const data = [];
  const a0 = rng() * Math.PI * 2;
  const cols = [0x9a6a62, 0x6b5a80, 0x7a5a70, 0x8a7090];
  const hw = L.w / 2, hh = L.h / 2;
  for (let i = 0; i < count; i++) {
    const a = a0 + (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    data.push({
      x: Math.cos(a) * (hw + 2.2 + rng() * 1.8), z: Math.sin(a) * (hh + 1.6 + rng() * 1.4),
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

// ---------------------------------------------------------------- exit signs
function signGeometry(type) {
  const c = SIGN_COLORS[type] || 0xffffff;
  const light = lerpHex(c, 0xffffff, 0.5), dark = lerpHex(c, 0x000000, 0.65), ink = 0x14091f;
  const parts = [];
  const part = (list, geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    geo.scale(sx, sy, sz); if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz); geo.translate(x, y, z);
    list.push(paint(plain(geo), () => color));
  };
  const sub = (build, rz = 0, x = 0, y = 0) => {
    const l = []; build(l);
    const m = mergeGeometries(l, false); l.forEach((g) => g.dispose());
    m.rotateZ(rz); m.translate(x, y, 0); parts.push(m);
  };
  // medallion backing and rim
  part(parts, new THREE.CylinderGeometry(0.42, 0.42, 0.05, 6), 0x1a0f2e, 0, 0, -0.08, Math.PI / 2, 0, 0);
  part(parts, new THREE.TorusGeometry(0.42, 0.03, 4, 6), c, 0, 0, -0.06);
  const B = (l, w, h, d, x, y, z, color) => part(l, new THREE.BoxGeometry(w, h, d), color, x, y, z);
  if (type === "combat") {
    const sword = (l) => {
      B(l, 0.09, 0.46, 0.04, 0, 0.1, 0, light);
      part(l, new THREE.ConeGeometry(0.063, 0.12, 4), light, 0, 0.39, 0, 0, Math.PI / 4, 0, 1, 1, 0.45);
      B(l, 0.28, 0.05, 0.07, 0, -0.14, 0, c);
      B(l, 0.05, 0.14, 0.05, 0, -0.23, 0, dark);
    };
    sub(sword, -0.75, 0, -0.0); sub(sword, 0.75, 0, -0.0);
  } else if (type === "elite") {
    part(parts, new THREE.IcosahedronGeometry(0.2, 1), light, 0, 0.04, 0, 0, 0, 0, 1, 0.95, 0.8);
    B(parts, 0.18, 0.1, 0.14, 0, -0.14, 0.02, light);
    for (const s of [-1, 1]) {
      part(parts, new THREE.OctahedronGeometry(0.06, 0), ink, s * 0.08, 0.04, 0.14, 0, 0, 0, 1, 1.2, 0.6);
      part(parts, new THREE.ConeGeometry(0.06, 0.3, 5), c, s * 0.19, 0.24, 0, 0, 0, -s * 0.6);
    }
    part(parts, new THREE.ConeGeometry(0.03, 0.07, 3), ink, 0, -0.04, 0.16, Math.PI, 0, 0);
    for (const s of [-0.06, -0.02, 0.02, 0.06]) B(parts, 0.015, 0.06, 0.02, s, -0.15, 0.1, ink);
  } else if (type === "treasure") {
    B(parts, 0.46, 0.2, 0.3, 0, -0.1, 0, c);
    part(parts, new THREE.CylinderGeometry(0.15, 0.15, 0.46, 6, 1, false, 0, Math.PI), light, 0, 0.0, 0, 0, 0, Math.PI / 2, 1, 1, 1);
    part(parts, new THREE.CylinderGeometry(0.15, 0.15, 0.46, 6, 1, false, 0, Math.PI), light, 0, 0, 0, 0, Math.PI, Math.PI / 2, 1, 1, 1);
    for (const s of [-1, 1]) B(parts, 0.05, 0.36, 0.32, s * 0.15, -0.02, 0, dark);
    B(parts, 0.07, 0.1, 0.02, 0, -0.04, 0.16, ink);
    part(parts, new THREE.OctahedronGeometry(0.07, 0), 0xffffff, 0, 0.26, 0, 0, 0, 0, 1, 1.3, 1);
  } else if (type === "rest") {
    for (const s of [-1, 1]) part(parts, new THREE.IcosahedronGeometry(0.14, 1), light, s * 0.1, 0.1, 0, 0, 0, 0, 1, 1, 0.55);
    part(parts, new THREE.ConeGeometry(0.235, 0.34, 6), light, 0, -0.08, 0, Math.PI, 0, 0, 1, 1, 0.55);
    part(parts, new THREE.IcosahedronGeometry(0.05, 0), 0xffffff, -0.12, 0.15, 0.08);
  } else if (type === "boss") {
    part(parts, new THREE.CylinderGeometry(0.25, 0.23, 0.13, 8, 1, true), c, 0, -0.14, 0);
    part(parts, new THREE.CylinderGeometry(0.255, 0.255, 0.03, 8), light, 0, -0.2, 0);
    for (let n = 0; n < 5; n++) {
      const a = (n / 5) * Math.PI * 2 + Math.PI / 5, r = 0.2;
      const hgt = n === 0 ? 0.3 : 0.22;
      part(parts, new THREE.ConeGeometry(0.06, hgt, 4), c, Math.sin(a) * r, -0.07 + hgt / 2, Math.cos(a) * r * 0.6);
      part(parts, new THREE.IcosahedronGeometry(0.035, 0), light, Math.sin(a) * r, -0.07 + hgt, Math.cos(a) * r * 0.6);
    }
    part(parts, new THREE.OctahedronGeometry(0.05, 0), 0xffffff, 0, -0.14, 0.2);
  } else { // stairs: arrow down
    B(parts, 0.15, 0.26, 0.08, 0, 0.13, 0, c);
    part(parts, new THREE.ConeGeometry(0.24, 0.26, 4), light, 0, -0.1, 0, Math.PI, Math.PI / 4, 0, 1, 1, 0.38);
    B(parts, 0.44, 0.045, 0.08, 0, -0.27, 0, dark);
  }
  const m = mergeGeometries(parts, false); parts.forEach((g) => g.dispose());
  return m;
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
function trapGlow(p) { return p < 0.3 ? 0.6 : p < 0.5 ? 0.6 + 0.9 * (p - 0.3) / 0.2 : p < 0.8 ? 1.5 : 0.6; }// ---------------------------------------------------------------- room core
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

function addWalls(ctx, L, torchCells) {
  for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) {
    if (kAt(L, i, j) !== 1) continue;
    const x = ccx(L, i), z = ccz(L, j), voidN = kAt(L, i, j - 1) === 0, voidW = kAt(L, i - 1, j) === 0;
    if (voidN) {
      if (isTall(L, i, j)) place(ctx, torchCells.has(i + "," + j) ? "tile-wall-torch" : "tile-wall", x, -0.04, z - 0.7, 0);
      else place(ctx, "tile-wall", x, -0.04, z - 0.7, 0, { skip: ["upper"] });
    }
    if (voidW) place(ctx, "tile-wall", x - 0.7, -0.04, z, Math.PI / 2, { skip: ["upper"] });
    if (voidN && voidW) place(ctx, "tile-wall", x - 0.7, -0.04, z - 0.7, Math.PI / 2, { skip: ["upper"] });
  }
}
function pickTorches(rng, L, n) {
  const cand = [];
  for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) if (kAt(L, i, j) === 1 && isTall(L, i, j)) cand.push([i, j]);
  const out = new Set(), got = [];
  for (const [i, j] of rng.shuffle(cand)) {
    if (got.length >= n) break;
    if (got.every(([a, b]) => Math.hypot(a - i, b - j) >= 3.5)) { got.push([i, j]); out.add(i + "," + j); }
  }
  return out;
}

// One portal / stairs with a floating type sign. spec: {x, z, type, stairs, sign}
function addExit(world, ctx, spec, open) {
  const exitGroup = new THREE.Group();
  ctx.group.add(exitGroup);
  const sealMat = new THREE.MeshStandardMaterial({ color: 0x3a2a5c, emissive: 0x8c5be0, emissiveIntensity: 0.5, transparent: true, opacity: 0.65, side: THREE.DoubleSide, flatShading: true });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xa070ff, emissive: 0xa070ff, emissiveIntensity: 0.9, flatShading: true });
  const seal = new THREE.Group();
  let portalLive = null;
  const stairs = !!spec.stairs;
  const ex = spec.x, ez = stairs ? spec.z : spec.z + 0.2;
  const sub = { ...ctx, baker: new Baker(), live: exitGroup };
  if (stairs) {
    place(sub, "tile-stairs-down", ex, 0, ez, 0);
    sub.baker.build(exitGroup, ctx.ownedMats, ctx.ownedGeos);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.1), sealMat);
    slab.position.set(0, 0.6, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 6, 20), ringMat);
    ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.64, 0);
    seal.add(slab, ring);
  } else {
    place(sub, "vfx-portal", ex, 0, ez, 0);
    sub.baker.build(exitGroup, ctx.ownedMats, ctx.ownedGeos);
    portalLive = exitGroup.children.find((c) => c.name === "vfx-portal") || null;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), sealMat);
    disc.position.set(0, 1.15, 0.03);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20), ringMat);
    ring.position.set(0, 1.15, 0.06);
    seal.add(disc, ring);
  }
  seal.position.set(ex, 0, ez);
  exitGroup.add(seal);
  ctx.ownedMats.push(sealMat, ringMat);
  seal.traverse((o) => { if (o.isMesh) ctx.ownedGeos.push(o.geometry); });
  // floating sign
  let sign = null, signMat = null;
  if (spec.sign !== false && spec.type) {
    const sg = signGeometry(spec.type);
    signMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    sign = new THREE.Mesh(sg, signMat);
    sign.name = "exit-sign";
    sign.scale.setScalar(1.25);
    sign.position.set(ex, stairs ? 1.75 : 2.55, ez);
    exitGroup.add(sign);
    ctx.ownedGeos.push(sg); ctx.ownedMats.push(signMat);
  }
  const blocker = { x: ex, z: ez + (stairs ? 0 : 0.1), r: 0.65 };
  const phase = (ex * 1.7 + ez * 0.9) % 6.28;
  const exit = { x: ex, z: ez, type: spec.type || null, open: false, group: exitGroup, setOpen(v) {
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
    if (sign) {
      sign.position.y = (stairs ? 1.75 : 2.55) + Math.sin(t * 2 + phase) * 0.07;
      sign.rotation.y = Math.PI / 4 + Math.sin(t * 0.9 + phase) * 0.3;
      signMat.color.setScalar(exit.open ? 1 : 0.5);
    }
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
    const hz = {
      dead: false,
      update(w) {
        const p = w.player;
        if (!p || p.dead) return;
        let now = false;
        for (const [cx, cz] of cells) if (Math.abs(p.x - cx) < 0.5 && Math.abs(p.z - cz) < 0.5) { now = true; break; }
        // combat resets slowMul to 1 each frame after reading it, so set it every frame while inside
        if (now) p.slowMul = Math.min(p.slowMul === undefined ? 1 : p.slowMul, 0.7);
      },
      dispose() {},
    };
    world.hazards.push(hz); ctx.hazards.push(hz);
  } else if (kind === "spikes") {
    const sg = spikeGeo(), wg = warnGeo();
    ctx.ownedGeos.push(sg, wg);
    const metal = new THREE.MeshStandardMaterial({ color: 0xa9a7c4, flatShading: true, roughness: 0.8, metalness: 0.3 });
    const wmat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    ctx.ownedMats.push(metal, wmat);
    const n = cells.length;
    const spikes = new THREE.InstancedMesh(sg, metal, n), warns = new THREE.InstancedMesh(wg, wmat, n);
    spikes.frustumCulled = false; warns.frustumCulled = false; spikes.castShadow = true;
    ctx.group.add(spikes, warns);
    const traps = [], dummy = new THREE.Object3D(), warnCol = new THREE.Color();
    cells.forEach(([x, z], i) => {
      place(ctx, "tile-spike-trap", x, -0.2, z, 0, { skip: ["spikes", "warning"] });
      traps.push({ x, z, off: (i % 3) * 0.8 + i * 0.37, lastHit: -1 });
      dummy.position.set(x, -0.2 + 0.02, z); dummy.updateMatrix(); spikes.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, -0.2, z); dummy.updateMatrix(); warns.setMatrixAt(i, dummy.matrix);
      warns.setColorAt(i, warnCol.setRGB(1, 0.2, 0.3));
    });
    ctx.animFns.push((w, t) => {
      for (let i = 0; i < n; i++) {
        const tr = traps[i];
        const p = (((t + tr.off) % TRAP_CYCLE) + TRAP_CYCLE) % TRAP_CYCLE / TRAP_CYCLE;
        dummy.position.set(tr.x, -0.2 + 0.02 + 0.18 * trapUp(p), tr.z); dummy.updateMatrix(); spikes.setMatrixAt(i, dummy.matrix);
        const g = trapGlow(p) / 1.5;
        warns.setColorAt(i, warnCol.setRGB(g, g * 0.24, g * 0.36));
      }
      spikes.instanceMatrix.needsUpdate = true; warns.instanceColor.needsUpdate = true;
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

// ctx: { layout, obstacles, avoid, start, elite, light }. With ctx.layout, spawns sit on reachable floor cells.
export function waveFor(floor, index, rng, ctx) {
  const f = Math.max(1, Math.min(3, floor | 0 || 1));
  const idx = Math.max(0, index | 0);
  let n;
  if (f === 1) n = 3 + Math.min(3, Math.floor(idx * 0.75));
  else n = 3 + f + Math.min(3, Math.floor(idx * 0.7)) - 1;
  const elite = !!(ctx && ctx.elite), light = !!(ctx && ctx.light);
  if (elite) n = Math.round(n * 1.5);
  else if (light) n = Math.max(2, Math.round(n * 0.5));
  const L = ctx && ctx.layout;
  const obstacles = (ctx && ctx.obstacles) || (L ? L.obstacles : []);
  const avoid = (ctx && ctx.avoid) || [];
  const start = (ctx && ctx.start) || (L ? L.start : START);
  const pool = POOLS[f];
  const weights = pool.map((t) => (elite && HEAVY[t] !== undefined ? 3 : 1));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const pickType = () => { let r = rng() * totalW; let i = 0; while (r >= weights[i]) { r -= weights[i]; i++; } return pool[i]; }; // rng() < 1: always lands on an entry
  const capMul = elite ? 2 : 1;
  const out = [], counts = {};
  let cells = null, zMid = 0;
  if (L) {
    cells = [];
    for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) {
      const c = j * L.w + i;
      if (L.kind[c] !== 1 || !L.reach[c] || L.blocked[c]) continue;
      cells.push({ x: L.x0 + i + 0.5, z: L.z0 + j + 0.5, haz: !!L.hazMask[c] });
    }
    zMid = L.z0 + L.h * 0.5;
  }
  let guard = 0;
  while (out.length < n && guard++ < 600) {
    const type = pickType();
    if (HEAVY[type] !== undefined && (counts[type] || 0) >= HEAVY[type] * capMul) continue;
    let x, z;
    if (cells) {
      const c = cells[Math.floor(rng() * cells.length)];
      if (c.haz && guard < 400) continue;
      if (type === "archer" && c.z > zMid + 1 && guard < 300) continue;
      x = c.x + (rng() - 0.5) * 0.5; z = c.z + (rng() - 0.5) * 0.5;
    } else {
      x = -4.2 + rng() * 8.4;
      z = -3.5 + rng() * (type === "archer" ? 2.2 : 3.7);
    }
    if (Math.hypot(x - start.x, z - start.z) < 3.2) continue;
    let ok = true;
    if (L) { for (const e of L.exits) if (Math.hypot(x - e.x, z - e.z) < 1.5) { ok = false; break; } }
    else if (Math.hypot(x - EXIT_POS.x, z - EXIT_POS.z) < 1.5) continue;
    if (!ok) continue;
    const slack = guard > 300 ? 0.45 : 0.8;
    for (const o of obstacles) if (Math.hypot(x - o.x, z - o.z) < o.r + slack) { ok = false; break; }
    if (!ok) continue;
    for (const a of avoid) if (Math.hypot(x - a.x, z - a.z) < (a.r || 0.7)) { ok = false; break; }
    if (!ok) continue;
    const gap = guard > 450 ? 0.9 : 1.3;
    for (const s of out) if (Math.hypot(x - s.x, z - s.z) < gap) { ok = false; break; }
    if (!ok) continue;
    counts[type] = (counts[type] || 0) + 1;
    out.push({ type, x: +x.toFixed(2), z: +z.toFixed(2) });
  }
  return out;
}

// ---------------------------------------------------------------- chest, campfire, motes
function addChest(world, ctx, spot) {
  const { keptLive } = place(ctx, "prop-chest", spot.x, 0, spot.z, 0, { anim: ["lid"] });
  const g = ctx.live.children[ctx.live.children.length - 1];
  if (keptLive) ctx.liveAssets.pop(); // we drive the lid ourselves
  const lid = g.getObjectByName("lid");
  let opened = false, t0 = 0, relic = null, relicMat = null;
  if (lid) lid.rotation.x = 0;
  const chest = {
    x: spot.x, z: spot.z, group: g, opened: false,
    open() {
      if (opened) return;
      opened = true; chest.opened = true; t0 = world.time;
      relicMat = new THREE.MeshBasicMaterial({ color: 0xffd56a });
      const rg = new THREE.OctahedronGeometry(0.16, 0); rg.scale(1, 1.4, 1);
      relic = new THREE.Mesh(rg, relicMat);
      relic.position.set(spot.x, 0.5, spot.z);
      ctx.group.add(relic); ctx.ownedGeos.push(rg); ctx.ownedMats.push(relicMat);
    },
  };
  ctx.animFns.push((w, t) => {
    if (!opened) return;
    const k = Math.min(1, (t - t0) / 0.45);
    if (lid) lid.rotation.x = -1.15 * (1 - (1 - k) * (1 - k));
    if (relic) { relic.position.y = 0.55 + k * 0.35 + Math.sin(t * 3) * 0.05; relic.rotation.y = t * 2; relicMat.color.setScalar(0.9 + 0.1 * Math.sin(t * 6)); }
  });
  return chest;
}
function addRestCamp(world, ctx, spot) {
  place(ctx, "prop-campfire", spot.x, 0, spot.z, 0.4);
  // soft teal heal glow on the floor + rising teal motes
  const gg = new THREE.CircleGeometry(1.7, 28); gg.rotateX(-Math.PI / 2);
  const pa = gg.attributes.position, col = new Float32Array(pa.count * 3);
  for (let v = 0; v < pa.count; v++) { const d = Math.hypot(pa.getX(v), pa.getZ(v)) / 1.7, t = Math.pow(Math.max(0, 1 - d), 1.5) * 0.4; col[v * 3] = 0.25 * t; col[v * 3 + 1] = 0.9 * t; col[v * 3 + 2] = 0.75 * t; }
  gg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const gm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Mesh(gg, gm); glow.position.set(spot.x, 0.03, spot.z); glow.renderOrder = 2;
  const N = 16, pos = new Float32Array(N * 3), seeds = [];
  for (let n = 0; n < N; n++) seeds.push({ a: (n / N) * 6.28 + n, r: 0.5 + ((n * 37) % 10) / 10 * 0.9, sp: 0.25 + ((n * 53) % 10) / 10 * 0.3, ph: (n * 0.37) % 1 });
  const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mm = new THREE.PointsMaterial({ color: 0x6fe0c0, size: 5, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const motes = new THREE.Points(mg, mm); motes.frustumCulled = false;
  ctx.group.add(glow, motes);
  ctx.ownedGeos.push(gg, mg); ctx.ownedMats.push(gm, mm);
  ctx.animFns.push((w, t) => {
    for (let n = 0; n < N; n++) {
      const s = seeds[n], p = (t * s.sp + s.ph) % 1;
      pos[n * 3] = spot.x + Math.cos(s.a + t * 0.4) * s.r * (1 - p * 0.4); pos[n * 3 + 1] = 0.1 + p * 1.6; pos[n * 3 + 2] = spot.z + Math.sin(s.a + t * 0.4) * s.r * (1 - p * 0.4);
    }
    mg.attributes.position.needsUpdate = true;
    gm.opacity = 0.75 + 0.25 * Math.sin(t * 1.7);
  });
}

// ---------------------------------------------------------------- buildRoom
// opts: { floor, index, boss, seed, exits:[type...] (1-2), roomType:"combat"|"elite"|"treasure"|"rest", elite, light }
export function buildRoom(world, { floor = 1, index = 0, boss = false, seed = 1, exits: exitTypes, roomType = "combat", elite, light } = {}) {
  const f = Math.max(1, Math.min(3, floor | 0 || 1));
  const def = FLOORS[f];
  const theme = THEMES[f];
  const rt = boss ? "combat" : (["combat", "elite", "treasure", "rest"].includes(roomType) ? roomType : "combat");
  let types = Array.isArray(exitTypes) && exitTypes.length ? exitTypes.slice(0, 2) : (boss ? ["stairs"] : ["combat"]);
  const L = generateLayout(seed, f, boss, types.length, index, rt);
  const rng = createRng(hashString(`${seed}|${f}|${index}|${boss ? "b" : "r"}|${rt}|vis`));
  world.bounds = { ...L.bounds };
  world.grid = { x0: L.x0, z0: L.z0, w: L.w, h: L.h, walk: L.walk };

  const ctx = makeRoomContext(world);
  const { mesh: island, glow } = buildIsland(rng, theme, L);
  ctx.group.add(island);
  ctx.ownedGeos.push(island.geometry); ctx.ownedMats.push(island.material);
  if (glow) {
    ctx.group.add(glow); ctx.ownedGeos.push(glow.geometry); ctx.ownedMats.push(glow.material);
    ctx.animFns.push((w, t) => { glow.material.opacity = 0.7 + 0.3 * Math.sin(t * 1.5); });
  }
  addWalls(ctx, L, pickTorches(rng, L, rng.int(2, 3)));

  // Obstacles (theme props, chest, campfire).
  let chest = null;
  for (const o of L.obstacles) {
    addObstacle(world, ctx, o.x, o.z, o.r);
    if (o.chest) chest = addChest(world, ctx, L.chest);
    else if (o.campfire) addRestCamp(world, ctx, L.campfire);
    else place(ctx, o.id, o.x, 0, o.z, (rng() - 0.5) * 0.6);
  }

  const exits = L.exits.map((e, n) => {
    const type = types[n] || types[0];
    return addExit(world, ctx, { x: e.x, z: e.z, type, stairs: type === "stairs" }, false);
  });
  const cells = L.hazards;
  addHazards(world, ctx, L.hazardKind, cells);

  const rocks = buildRocks(rng, ctx.group, L);
  ctx.ownedGeos.push(rocks.geo); ctx.ownedMats.push(rocks.mat);
  ctx.animFns.push((w, t) => rocks.update(t));
  rocks.update(0);

  let spawns = [];
  if (!boss && rt !== "rest") {
    const srng = createRng(hashString(`${seed}|${f}|${index}|spawn`));
    spawns = waveFor(f, index, srng, { layout: L, elite: rt === "elite" || !!elite, light: rt === "treasure" || !!light });
  }

  return finishRoom(world, ctx, {
    playerStart: { x: L.start.x, z: L.start.z },
    spawns, exits, exit: exits[0],
    cameraBounds: { ...L.bounds }, layout: L,
    chest, roomType: rt,
    floor: f, boss: !!boss, bossId: boss ? def.boss : null, bossSpawn: boss ? { x: L.bossSpawn.x, z: L.bossSpawn.z } : null,
  });
}

// ---------------------------------------------------------------- hub
export function buildHub(world) {
  const L = finalizeLayout(rectLayout(10, 8));
  world.bounds = { ...L.bounds };
  world.grid = null; // hub is a plain rectangle
  const rng = createRng(hashString("hub"));
  const ctx = makeRoomContext(world);
  L.hazMask = new Uint8Array(L.w * L.h);
  const { mesh: island } = buildIsland(rng, THEMES.hub, L);
  ctx.group.add(island);
  ctx.ownedGeos.push(island.geometry); ctx.ownedMats.push(island.material);
  addWalls(ctx, L, new Set(["2,0", "7,0"]));

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
  const exit = addExit(world, ctx, { x: 0, z: -3.5, type: null, sign: false }, true);
  const rocks = buildRocks(rng, ctx.group, L);
  ctx.ownedGeos.push(rocks.geo); ctx.ownedMats.push(rocks.mat);
  ctx.animFns.push((w, t) => rocks.update(t));
  rocks.update(0);

  return finishRoom(world, ctx, { playerStart: { x: 0, z: 2.6 }, spawns: [], exit, exits: [exit], cameraBounds: { ...L.bounds }, hub: true, floor: 0, boss: false });
}
