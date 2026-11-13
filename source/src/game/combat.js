// Module A: damage, telegraphs, projectiles and status effects.
import * as THREE from "three";
import { COLORS } from "../engine/assets.js";
import { inCircle, inLine, inCone, yawOf } from "./world.js";
import { checkTable, transition } from "../core/fsm.js";

const TAU = Math.PI * 2;
const HURT_IFRAMES = 0.4;        // brief invulnerability after a real hit (>= 5 damage)
const DOT_TICK = 0.5;            // burn / bleed damage is applied in chunks this often

// ---------------------------------------------------------------------------
// Geometry helpers (shared with player.js)
// ---------------------------------------------------------------------------

// Flat circular sector in the XZ plane, apex at the origin, centred on +z, normal +y.
export function makeSectorGeometry(radius, arc, segments = 20) {
  const pos = [0, 0, 0];
  for (let i = 0; i <= segments; i++) {
    const a = -arc / 2 + arc * (i / segments);
    pos.push(Math.sin(a) * radius, 0, Math.cos(a) * radius);
  }
  const idx = [];
  for (let i = 1; i <= segments; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Thick outline of a polyline in the XZ plane. pts = flat [x,z,x,z,...]. Squared-off quads overlap at joints.
// Closed outline ribbon around a polygon (telegraph edges).
function strokeGeometry(pts, thickness) {
  const n = pts.length / 2, segs = n, h = thickness / 2;
  const pos = new Float32Array(segs * 4 * 3), idx = new Uint16Array(segs * 6);
  for (let s = 0; s < segs; s++) {
    const ax = pts[s * 2], az = pts[s * 2 + 1];
    const bx = pts[((s + 1) % n) * 2], bz = pts[((s + 1) % n) * 2 + 1];
    let dx = bx - ax, dz = bz - az; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const nx = -dz * h, nz = dx * h, ex = dx * h, ez = dz * h;
    const o = s * 12;
    pos.set([ax - ex + nx, 0, az - ez + nz, ax - ex - nx, 0, az - ez - nz, bx + ex - nx, 0, bz + ez - nz, bx + ex + nx, 0, bz + ez + nz], o);
    const v = s * 4; idx.set([v, v + 1, v + 2, v, v + 2, v + 3], s * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

function circlePts(r, n) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; p.push(Math.cos(a) * r, Math.sin(a) * r); } return p; }

// ---------------------------------------------------------------------------
// Status effects
// ---------------------------------------------------------------------------

function ensureStatus(enemy) {
  if (!enemy.status) enemy.status = { burnT: 0, burnDps: 0, slowT: 0, slowPct: 0, frozenT: 0, bleedT: 0, bleedDps: 0, stunT: 0 };
  const s = enemy.status;
  if (s.dotAcc === undefined) { s.dotAcc = 0; s.hits = 0; s.puff = 0; }
  if (enemy.speedMul === undefined) enemy.speedMul = 1;
  return s;
}
const num = (v, k, d) => (typeof v === "number" ? v : (v && (v[k] ?? v.time ?? v.t ?? v.duration)) ?? d);

// burn:{dps,time} slow:{pct,time} bleed:{dps,time} freeze:seconds stun:seconds. Bosses get half-length freeze/stun.
export function applyStatus(world, enemy, fx = {}) {
  if (!enemy || enemy.dead) return;
  const s = ensureStatus(enemy), cc = enemy.boss ? 0.5 : 1;
  if (fx.burn) { s.burnDps = Math.max(s.burnT > 0 ? s.burnDps : 0, fx.burn.dps || 0); s.burnT = Math.max(s.burnT, num(fx.burn, "time", 3)); }
  if (fx.slow) { s.slowPct = Math.max(s.slowT > 0 ? s.slowPct : 0, fx.slow.pct ?? 0.2); s.slowT = Math.max(s.slowT, num(fx.slow, "time", 2)); }
  if (fx.bleed) { s.bleedDps = Math.max(s.bleedT > 0 ? s.bleedDps : 0, fx.bleed.dps || 0); s.bleedT = Math.max(s.bleedT, num(fx.bleed, "time", 4)); }
  if (fx.freeze) { s.frozenT = Math.max(s.frozenT, num(fx.freeze, "time", 1) * cc); if (world.fx) world.fx.burst(enemy.x, 0.5, enemy.z, 0x9fe8ff, 8, 2.2); }
  if (fx.stun) { s.stunT = Math.max(s.stunT, num(fx.stun, "time", 1) * cc); if (world.fx) world.fx.burst(enemy.x, 0.9, enemy.z, COLORS.gold, 6, 1.8); }
  enemy.speedMul = (s.frozenT > 0 || s.stunT > 0) ? 0 : 1 - (s.slowT > 0 ? s.slowPct : 0);
}

// Call from the enemy's update. Ticks timers, applies DoT, refreshes enemy.speedMul.
export function tickStatus(world, enemy, dt) {
  if (enemy.dead) return;
  const s = ensureStatus(enemy);
  const fx = world.fx;
  s.puff -= dt;
  const puff = s.puff <= 0; if (puff) s.puff = 0.22;
  let dps = 0;
  if (s.burnT > 0) { s.burnT -= dt; dps += s.burnDps; if (puff && fx) fx.burst(enemy.x, 0.6, enemy.z, COLORS.ember, 1, 0.8); }
  if (s.bleedT > 0) { s.bleedT -= dt; dps += s.bleedDps; if (puff && fx) fx.burst(enemy.x, 0.5, enemy.z, COLORS.danger, 1, 0.8); }
  if (s.slowT > 0) s.slowT -= dt;
  if (s.frozenT > 0) { s.frozenT -= dt; if (puff && fx) fx.burst(enemy.x, 0.7, enemy.z, 0x9fe8ff, 1, 0.6); }
  if (s.stunT > 0) { s.stunT -= dt; if (puff && fx) fx.burst(enemy.x, 1.0, enemy.z, COLORS.gold, 1, 0.6); }
  enemy.speedMul = (s.frozenT > 0 || s.stunT > 0) ? 0 : 1 - (s.slowT > 0 ? s.slowPct : 0);

  if (dps > 0) {
    s.dotAcc += dps * dt;
    if (s.dotAcc >= dps * DOT_TICK || (s.burnT <= 0 && s.bleedT <= 0 && s.dotAcc > 0.5)) {
      const amt = s.dotAcc; s.dotAcc = 0;
      damageEnemy(world, enemy, amt, { fromPlayer: false, dot: true, color: s.bleedT > 0 && s.burnT <= 0 ? COLORS.danger : COLORS.ember });
    }
  } else s.dotAcc = 0;
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

// opts: crit, fromPlayer (default true), heavy (force heavy hit-stop), dot (internal), color
export function damageEnemy(world, enemy, amount, { crit = false, fromPlayer = true, heavy = false, dot = false, color = 0 } = {}) {
  if (!enemy || enemy.dead || enemy.hp <= 0 || amount <= 0) return 0;
  const st = world.stats || {}, s = ensureStatus(enemy);
  if (fromPlayer && !dot && s.bleedT > 0 && st.bleedAmp) amount *= 1 + st.bleedAmp;
  const dealt = Math.min(amount, enemy.hp);
  enemy.hp -= amount;
  const fx = world.fx, audio = world.audio;
  const big = crit || heavy;
  const y = (enemy.height || 0.7) + 0.2;

  if (fx) {
    fx.number(enemy.x, y, enemy.z, String(Math.max(1, Math.round(amount))) + (crit ? "!" : ""), color || (crit ? COLORS.gold : dot ? COLORS.ember : 0xffffff));
    if (!dot) {
      fx.flash(enemy.group, big ? 0.12 : 0.08);
      fx.burst(enemy.x, 0.5, enemy.z, crit ? COLORS.gold : 0xfff0e0, big ? 12 : 6, big ? 4 : 2.8);
    }
  }
  if (!dot) {
    if (audio) audio.play(crit ? "crit" : "hit");
    if (fromPlayer) {
      if (big) { world.shake(0.15); world.hitStop(0.05); } else { world.shake(0.06); world.hitStop(0.033); }
    }
  }
  world.events.emit("enemy:hit", { enemy, amount: dealt, crit });

  // On-hit tag effects (only direct hits by the player).
  if (fromPlayer && !dot && enemy.hp > 0) {
    if (st.burnPct) applyStatus(world, enemy, { burn: { dps: amount * st.burnPct, time: 3 } });
    if (st.slowPct) applyStatus(world, enemy, { slow: { pct: st.slowPct, time: 2 } });
    if (crit && st.bleedPct) applyStatus(world, enemy, { bleed: { dps: amount * st.bleedPct / 4, time: 4 } });
    if (st.freezeEvery && ++s.hits >= st.freezeEvery) { s.hits = 0; applyStatus(world, enemy, { freeze: 1 }); }
  }

  if (enemy.hp <= 0) {
    enemy.hp = 0; enemy.dead = true;
    if (fx) fx.burst(enemy.x, 0.5, enemy.z, enemy.boss ? COLORS.gold : 0xfff0e0, enemy.boss ? 40 : 16, enemy.boss ? 6 : 4);
    if (st.burnSpread && s.burnT > 0) {
      for (const e of world.enemies) {
        if (e !== enemy && !e.dead && Math.hypot(e.x - enemy.x, e.z - enemy.z) < 2.5) applyStatus(world, e, { burn: { dps: s.burnDps, time: 3 } });
      }
    }
    if (audio && enemy.boss) audio.play("death");
    world.events.emit("enemy:death", { enemy });
    if (enemy.boss) world.events.emit("boss:death", { boss: enemy });
  }
  return dealt;
}

export function damagePlayer(world, amount, sourceName = "Something") {
  const p = world.player;
  if (!p || p.dead || p.invuln > 0 || amount <= 0) return 0;
  let rest = amount;
  if (p.shield > 0) { const a = Math.min(p.shield, rest); p.shield -= a; rest -= a; }
  p.hp -= rest;
  const fx = world.fx;
  if (amount >= 1) {
    if (amount >= 5) p.invuln = Math.max(p.invuln, HURT_IFRAMES);
    world.shake(0.2);
    if (world.audio) world.audio.play("hurt");
    if (fx) {
      fx.flash(p.group, 0.12);
      fx.burst(p.x, 0.5, p.z, COLORS.danger, 10, 3);
      fx.number(p.x, 1.2, p.z, String(Math.round(amount)), COLORS.danger);
    }
    world.events.emit("player:hit", { amount, source: sourceName });
  }
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true;
    if (world.audio) world.audio.play("death");
    if (fx) fx.burst(p.x, 0.5, p.z, COLORS.danger, 30, 5);
    world.hitStop(0.12);
    world.events.emit("player:death", { killer: sourceName });
  }
  return amount;
}

// ---------------------------------------------------------------------------
// Telegraphs
// ---------------------------------------------------------------------------

const Y_BASE = 0.03;

// A telegraph fills during "windup", resolves once (damage) and fades, then is "done". Cancelled in windup, it never
// resolves. `resolved` and `dead` are read-outs of the state, so they cannot disagree with it.
export const TELEGRAPH_FLOW = checkTable({
  windup: { RESOLVE: "fade", CANCEL: "cancelled" },
  fade: { END: "done", CANCEL: "done" },
  done: { CANCEL: "done" },
  cancelled: { CANCEL: "cancelled" },
});

export function spawnTelegraph(world, o) {
  const shape = o.shape || "circle";
  const t = {
    shape, x: o.x, z: o.z, angle: o.angle ?? 0, radius: o.radius ?? 1, length: o.length ?? 3, width: o.width ?? 0.8,
    arc: o.arc ?? Math.PI / 2, windup: Math.max(0.05, o.windup ?? 0.6), damage: o.damage ?? 10,
    sourceName: o.sourceName || "Something", onResolve: o.onResolve || null,
    age: 0, progress: 0, state: "windup", fade: 0, group: new THREE.Group(), update, dispose, cancel,
    get resolved() { return t.state === "fade" || t.state === "done"; },
    get dead() { return t.state === "done" || t.state === "cancelled"; },
  };
  const owned = [];

  // Shapes in local space: circle centred at origin; line from origin along +z; cone apex at origin facing +z.
  let fillGeo, outlinePts, scaleAxis; // scaleAxis: "xz" (grow radially) or "z" (grow along length)
  if (shape === "circle") {
    fillGeo = new THREE.CircleGeometry(t.radius, 40).rotateX(-Math.PI / 2);
    outlinePts = circlePts(t.radius, 48); scaleAxis = "xz";
  } else if (shape === "line") {
    fillGeo = new THREE.PlaneGeometry(t.width, t.length).rotateX(-Math.PI / 2).translate(0, 0, t.length / 2);
    const hw = t.width / 2; outlinePts = [-hw, 0, hw, 0, hw, t.length, -hw, t.length]; scaleAxis = "z";
  } else {
    fillGeo = makeSectorGeometry(t.radius, t.arc, 24);
    outlinePts = [0, 0];
    for (let i = 0; i <= 24; i++) { const a = -t.arc / 2 + t.arc * i / 24; outlinePts.push(Math.sin(a) * t.radius, Math.cos(a) * t.radius); }
    scaleAxis = "xz";
  }
  const outGeo = strokeGeometry(outlinePts, 0.08);
  const mk = (color, opacity, order) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    m.userData.order = order; owned.push(m); return m;
  };
  const baseMat = mk(COLORS.danger, 0.12, 10), fillMat = mk(COLORS.danger, 0.3, 11), lineMat = mk(COLORS.danger, 1, 12);
  lineMat.color.multiplyScalar(1.5); // push past 1.0 so it reads as emissive and catches bloom
  const base = new THREE.Mesh(fillGeo, baseMat), fill = new THREE.Mesh(fillGeo, fillMat), line = new THREE.Mesh(outGeo, lineMat);
  base.position.y = 0; fill.position.y = 0.005; line.position.y = 0.01;
  base.renderOrder = 10; fill.renderOrder = 11; line.renderOrder = 12;
  base.name = fill.name = line.name = "telegraph";
  t.group.add(base, fill, line);
  t.group.position.set(t.x, Y_BASE, t.z);
  t.group.rotation.y = shape === "circle" ? 0 : t.angle;
  fill.scale.set(0.001, 1, 0.001);
  world.add(t.group);
  world.telegraphs.push(t);
  if (world.audio) world.audio.play("windup");

  function update(w, dt) {
    if (t.dead) return;
    t.group.position.x = t.x; t.group.position.z = t.z;
    if (shape !== "circle") t.group.rotation.y = t.angle;
    if (t.state === "windup") {
      t.age += dt;
      t.progress = Math.min(1, t.age / t.windup);
      const k = Math.max(0.001, t.progress);
      if (scaleAxis === "xz") fill.scale.set(k, 1, k); else fill.scale.set(1, 1, k);
      fillMat.opacity = 0.25 + 0.4 * t.progress;
      // outline flickers brighter in the last quarter: the hit is imminent
      if (t.progress > 0.75) lineMat.color.setHex(((t.age * 14) | 0) % 2 ? 0xffffff : COLORS.danger).multiplyScalar(((t.age * 14) | 0) % 2 ? 1 : 1.5);
      if (t.progress >= 1) resolve(w);
    } else {
      t.fade += dt;
      const u = Math.min(1, t.fade / 0.18);
      fillMat.opacity = 0.9 * (1 - u); baseMat.opacity = 0.12 * (1 - u); lineMat.opacity = 1 - u;
      if (u >= 1) transition(TELEGRAPH_FLOW, t, "END");
    }
  }

  function resolve(w) {
    transition(TELEGRAPH_FLOW, t, "RESOLVE");
    fill.scale.set(1, 1, 1);
    fillMat.color.setHex(0xffd0d8); lineMat.color.setHex(0xffffff);
    const p = w.player;
    let inside = false, hit = false;
    if (p && !p.dead) {
      const pad = p.radius ?? 0.3;
      inside = shape === "circle" ? inCircle(p.x, p.z, t.x, t.z, t.radius, pad)
        : shape === "line" ? inLine(p.x, p.z, t.x, t.z, t.angle, t.length, t.width, pad)
        : inCone(p.x, p.z, t.x, t.z, t.angle, t.radius, t.arc, pad);
      if (inside) {
        if (t.damage > 0 && p.dodging && w.stats && w.stats.shieldOnDodge) {
          const full = (w.stats.roomShield || 0.15) * p.maxHp;
          if (p.shield < full) p.shield = full;
          if (w.fx) { w.fx.number(p.x, 1.3, p.z, "Shielded", COLORS.heal); w.fx.burst(p.x, 0.6, p.z, COLORS.heal, 10, 2.5); }
        }
        if (t.damage > 0) hit = damagePlayer(w, t.damage, t.sourceName) > 0;
        else hit = p.invuln <= 0;
      }
    }
    if (t.damage > 0 && w.fx) w.fx.burst(t.x, 0.1, t.z, COLORS.danger, shape === "circle" ? 10 : 6, 2.5);
    if (t.onResolve) t.onResolve(w, hit);
  }

  function cancel() { transition(TELEGRAPH_FLOW, t, "CANCEL"); }
  function dispose(w) {
    if (t.disposed) return; t.disposed = true; cancel();
    (w || world).remove(t.group);
    fillGeo.dispose(); outGeo.dispose();
    for (const m of owned) m.dispose();
  }
  return t;
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------

export function spawnProjectile(world, o) {
  const hostile = o.hostile !== false, kind = o.kind || "orb", radius = o.radius ?? 0.2;
  let dx = o.dirX, dz = o.dirZ; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
  const color = hostile ? COLORS.danger : kind === "fireball" ? COLORS.ember : COLORS.magic;
  const geos = [], mats = [];
  const g = (geo) => (geos.push(geo), geo);
  const m = (color, opacity = 1, bright = 1) => {
    const mm = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, toneMapped: false });
    if (bright !== 1) mm.color.multiplyScalar(bright);
    mats.push(mm); return mm;
  };

  const p = {
    kind, hostile, x: o.x, z: o.z, y: o.y ?? 0.7, dirX: dx, dirZ: dz, speed: o.speed ?? 5, damage: o.damage ?? 8, radius,
    range: o.range ?? 12, travelled: 0, sourceName: o.sourceName || "Projectile", dead: false, group: new THREE.Group(),
    update, dispose, kill,
  };
  const root = p.group, body = new THREE.Group();
  root.add(body);

  if (kind === "arrow") {
    const shaft = new THREE.Mesh(g(new THREE.BoxGeometry(0.05, 0.05, 0.5)), m(0xefd9d6));
    const head = new THREE.Mesh(g(new THREE.ConeGeometry(0.09, 0.22, 6).rotateX(Math.PI / 2).translate(0, 0, 0.3)), m(color, 1, 1.4));
    const glow = new THREE.Mesh(g(new THREE.BoxGeometry(0.12, 0.12, 0.6)), m(color, 0.3));
    body.add(shaft, head, glow);
  } else if (kind === "fireball") {
    body.add(new THREE.Mesh(g(new THREE.IcosahedronGeometry(radius * 1.1, 1)), m(hostile ? 0xffd0d8 : 0xfff0c0)));
    body.add(new THREE.Mesh(g(new THREE.IcosahedronGeometry(radius * 1.7, 1)), m(color, 0.55, 1.3)));
    const tail = new THREE.Mesh(g(new THREE.ConeGeometry(radius * 1.2, radius * 4, 8).rotateX(-Math.PI / 2).translate(0, 0, -radius * 2.4)), m(color, 0.45, 1.2));
    body.add(tail);
  } else {
    body.add(new THREE.Mesh(g(new THREE.IcosahedronGeometry(radius, 1)), m(color, 1, 1.5)));
    body.add(new THREE.Mesh(g(new THREE.IcosahedronGeometry(radius * 1.7, 1)), m(color, 0.3, 1.3)));
  }
  body.position.y = p.y;

  // Readability: blob shadow on the floor and a thin drop line from the projectile down to it.
  const shadow = new THREE.Mesh(g(new THREE.CircleGeometry(Math.max(0.16, radius * 1.5), 16).rotateX(-Math.PI / 2)), m(0x000000, 0.45));
  shadow.position.y = 0.02; shadow.name = "shadow"; shadow.renderOrder = 5;
  const drop = new THREE.Mesh(g(new THREE.CylinderGeometry(0.014, 0.014, 1, 6).translate(0, 0.5, 0)), m(color, 0.6, 1.2));
  drop.scale.y = Math.max(0.01, p.y); drop.name = "dropLine";
  root.add(shadow, drop);
  root.position.set(p.x, 0, p.z);
  body.rotation.y = yawOf(dx, dz);
  world.add(root);
  world.projectiles.push(p);

  let trail = 0;
  function update(w, dt) {
    if (p.dead) return;
    const step = p.speed * dt;
    p.x += dx * step; p.z += dz * step; p.travelled += step;
    root.position.x = p.x; root.position.z = p.z;
    if (kind === "orb") body.rotation.y += dt * 6;
    trail -= dt;
    if (trail <= 0 && w.fx) { trail = 0.06; w.fx.burst(p.x - dx * 0.2, p.y, p.z - dz * 0.2, color, 1, 0.4); }

    if (p.travelled >= p.range) return kill(w, false);
    const b = w.bounds;
    if (p.x < b.minX - 0.5 || p.x > b.maxX + 0.5 || p.z < b.minZ - 0.5 || p.z > b.maxZ + 0.5) return kill(w, false);
    for (const ob of w.obstacles) if (Math.hypot(p.x - ob.x, p.z - ob.z) < ob.r + radius * 0.5) return kill(w, true);

    if (hostile) {
      const pl = w.player;
      if (pl && !pl.dead && pl.invuln <= 0 && Math.hypot(pl.x - p.x, pl.z - p.z) <= radius + pl.radius) {
        damagePlayer(w, p.damage, p.sourceName);
        kill(w, true);
      }
    } else {
      for (const e of w.enemies) {
        if (e.dead || Math.hypot(e.x - p.x, e.z - p.z) > radius + (e.radius || 0.3)) continue;
        damageEnemy(w, e, p.damage, { fromPlayer: true });
        return kill(w, true);
      }
    }
  }
  function kill(w, burst = true) {
    if (p.dead) return;
    p.dead = true;
    if (burst && (w || world).fx) (w || world).fx.burst(p.x, p.y, p.z, color, 7, 2.6);
  }
  function dispose(w) {
    if (p.disposed) return; p.disposed = true; p.dead = true;
    (w || world).remove(root);
    for (const x of geos) x.dispose();
    for (const x of mats) x.dispose();
  }
  return p;
}
