// Room dressing (visual only, no collision): banners, battlements and broken columns on the back walls,
// glowing guide lines from the start to each exit, and waterfalls off the front edges.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const DECOR = {
  1: { banner: 0x8a3550, emblem: 0xffc070, line: 0xffb866, falls: 2 },
  2: { banner: 0x44558c, emblem: 0xcfe0ff, line: 0xffb866, falls: 1 },
  3: { banner: 0x6a3ab0, emblem: 0xe0c0ff, line: 0xb48cff, falls: 0 },
};
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const LOW_WALL = 0.35, TALL_WALL = 1.5, col = new THREE.Color();

function box(list, w, h, d, x, y, z, color, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.rotateZ(rz); g.translate(x, y, z);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  col.setHex(color);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  list.push(g);
}
function strip(list, len, wid, x, z, ry) {
  const g = new THREE.PlaneGeometry(len, wid);
  g.rotateX(-Math.PI / 2); g.rotateY(ry); g.translate(x, 0.03, z);
  list.push(g);
}
function rune(list, x, z) {
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) strip(list, 0.42, 0.05, x + sx * 0.15, z + sz * 0.15, sx * sz * Math.PI / 4);
}

// Shortest walkable cell path (indices j*w+i) from one cell to another, avoiding props and hazards. [] if there is none.
export function guidePath(L, from, to) {
  const { w, h } = L, prev = new Int32Array(w * h).fill(-1), s = from.j * w + from.i, t = to.j * w + to.i, q = [s];
  prev[s] = s;
  for (let n = 0; n < q.length && prev[t] < 0; n++) {
    const k = q[n], i = k % w, j = (k - i) / w;
    for (const [di, dj] of D4) {
      const a = i + di, b = j + dj, m = b * w + a;
      if (a < 0 || b < 0 || a >= w || b >= h || prev[m] >= 0) continue;
      if (m === t || (L.walk[m] && !L.blocked[m] && !L.hazMask[m])) { prev[m] = k; q.push(m); }
    }
  }
  if (prev[t] < 0) return [];
  const out = [t];
  while (out[0] !== s) out.unshift(prev[out[0]]);
  return out;
}

const FALL_VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
const FALL_FS = `uniform float uT; uniform vec3 uColor; varying vec2 vUv;
void main(){
  float s = sin(vUv.x * 38.0 + sin(vUv.y * 9.0 + uT * 2.0) * 0.6) * 0.5 + 0.5;
  float flow = sin((vUv.y * 14.0 + uT * 5.0) + vUv.x * 11.0) * 0.5 + 0.5;
  float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
  float a = (0.28 + 0.3 * s + 0.2 * flow) * edge * smoothstep(0.0, 0.75, vUv.y);
  gl_FragColor = vec4(uColor + 0.35 * s * flow, a);
}`;

// addDecor(ctx, L, { floor, rng, stones, kAt(i, j), isTall(i, j), torchCells }) -> { banners, falls, dashes }
export function addDecor(ctx, L, o) {
  const d = DECOR[o.floor], rng = o.rng, cx = (i) => L.x0 + i + 0.5, cz = (j) => L.z0 + j + 0.5;
  const stone = () => o.stones[rng.int(0, o.stones.length - 1)];
  const solid = [], bannered = new Set(), south = [], east = [];
  for (let j = 0; j < L.h; j++) for (let i = 0; i < L.w; i++) {
    if (o.kAt(i, j) !== 1) continue;
    const x = cx(i), z = cz(j);
    if (o.kAt(i, j + 1) === 0) south.push({ i, j });
    else if (o.kAt(i + 1, j) === 0) east.push({ i, j });
    if (o.kAt(i, j - 1) !== 0) continue;
    const wz = z - 0.7;
    if (!o.isTall(i, j)) {
      if (rng() < 0.2) { // broken column on a low wall
        const hgt = 0.3 + rng() * 0.6;
        box(solid, 0.34, hgt, 0.34, x, LOW_WALL + hgt / 2, wz, stone());
        box(solid, 0.42, 0.08, 0.42, x, LOW_WALL + 0.04, wz, stone());
      }
      continue;
    }
    for (const sx of [-0.25, 0.25]) if (rng() < 0.75) box(solid, 0.3, 0.2, 0.42, x + sx, TALL_WALL + 0.1, wz, stone());
    if (o.torchCells.has(i + "," + j) || bannered.has(i - 1 + "," + j) || rng() >= 0.4) continue;
    bannered.add(i + "," + j);
    const bz = z - 0.48;
    box(solid, 0.6, 0.05, 0.06, x, 1.32, bz, 0x2a2233);
    box(solid, 0.46, 0.62, 0.02, x, 0.99, bz, d.banner);
    box(solid, 0.325, 0.325, 0.02, x, 0.68, bz, d.banner, Math.PI / 4);
    box(solid, 0.15, 0.15, 0.02, x, 1.02, bz + 0.012, d.emblem, Math.PI / 4);
  }
  if (solid.length) {
    const geo = mergeGeometries(solid, false), mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    solid.forEach((g) => g.dispose());
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.name = "decor-solid";
    ctx.group.add(m); ctx.ownedGeos.push(geo); ctx.ownedMats.push(mat);
  }

  // guide lines: a rune at the start and before each exit, dashes along the walkable path between them
  const lines = [], seen = new Set();
  rune(lines, L.start.x, L.start.z);
  for (const e of L.exits) {
    const p = guidePath(L, L.start, e);
    for (let n = 1; n < p.length - 1; n++) {
      const a = p[n - 1], b = p[n], key = Math.min(a, b) + ":" + Math.max(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      const ai = a % L.w, aj = (a - ai) / L.w, bi = b % L.w, bj = (b - bi) / L.w;
      strip(lines, 0.46, 0.055, (cx(ai) + cx(bi)) / 2, (cz(aj) + cz(bj)) / 2, ai === bi ? Math.PI / 2 : 0);
    }
    if (p.length > 2) { const k = p[p.length - 2], i = k % L.w; rune(lines, cx(i), cz((k - i) / L.w)); }
  }
  const lgeo = mergeGeometries(lines, false);
  const lmat = new THREE.MeshBasicMaterial({ color: d.line, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  lines.forEach((g) => g.dispose());
  const lm = new THREE.Mesh(lgeo, lmat); lm.name = "decor-lines"; lm.renderOrder = 1;
  ctx.group.add(lm); ctx.ownedGeos.push(lgeo); ctx.ownedMats.push(lmat);
  ctx.animFns.push((w, t) => { lmat.opacity = 0.42 + 0.14 * Math.sin(t * 1.3); });

  // waterfalls off the front (south / east) edges, spaced apart
  const falls = [], got = [];
  const cand = rng.shuffle(south.map((c) => ({ ...c, e: 0 })).concat(east.map((c) => ({ ...c, e: 1 }))));
  for (const c of cand) {
    if (got.length >= d.falls) break;
    if (!got.every((g) => Math.hypot(g.i - c.i, g.j - c.j) >= 3)) continue;
    got.push(c);
    const g = new THREE.PlaneGeometry(0.8, 7, 1, 1);
    g.translate(0, -3.5, 0.72);
    g.rotateY(c.e * Math.PI / 2);
    g.translate(cx(c.i), 0.02, cz(c.j));
    falls.push(g);
  }
  if (falls.length) {
    const geo = mergeGeometries(falls, false);
    falls.forEach((g) => g.dispose());
    const mat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uColor: { value: new THREE.Color(0x8fb4ff) } }, vertexShader: FALL_VS, fragmentShader: FALL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat); m.name = "decor-falls";
    ctx.group.add(m); ctx.ownedGeos.push(geo); ctx.ownedMats.push(mat);
    ctx.animFns.push((w, t) => { mat.uniforms.uT.value = t; });
  }
  return { banners: bannered.size, falls: falls.length, dashes: seen.size };
}
