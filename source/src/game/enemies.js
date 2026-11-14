// Module B: enemies. Shared actor kit (also used by bosses.js) plus the regular enemy types.
// Every attack is a telegraph (spawnTelegraph) or a projectile preceded by a line telegraph with damage 0.
import { makeAsset } from "../engine/assets.js";
import { yawOf, resolveCollision, clamp } from "./world.js";
import { spawnTelegraph, spawnProjectile, damagePlayer, tickStatus } from "./combat.js";
import { checkTable, transition } from "../core/fsm.js";

export { createBoss } from "./bosses.js";

const AGGRO = 5;
const TMP = { x: 0, z: 0 };
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- helpers (exported for bosses.js)
export const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export function turn(e, target, maxStep) { e.yaw += clamp(angDiff(target, e.yaw), -maxStep, maxStep); }
export function walk(e, ux, uz, speed, dt) {
  const k = speed * e.speedMul * dt;
  e.x += ux * k; e.z += uz * k;
}
export function lerp(a, b, u) { return a + (b - a) * u; }
export function say(w, name) { if (w.audio && w.audio.play) w.audio.play(name); }

// Spawn a telegraph owned by an actor (tracked so it can be cancelled on stun/death).
export function tele(e, w, o) {
  if (o.sourceName === undefined) o.sourceName = e.name;
  if (o.damage === undefined) o.damage = e.damage;
  o.damage *= e.dmgMul || 1;
  const t = spawnTelegraph(w, o);
  if (t) {
    if (e.tels.length > 8) e.tels = e.tels.filter(x => !x.dead);
    e.tels.push(t);
  }
  return t;
}
export function killTelegraphs(e) {
  for (const t of e.tels) { if (t.cancel) t.cancel(); else t.dead = true; }
  e.tels.length = 0;
}
// Fire a hostile projectile at yaw `angle`.
export function shoot(e, w, angle, o = {}) {
  const dx = Math.sin(angle), dz = Math.cos(angle);
  const off = o.off === undefined ? 0.4 : o.off;
  return spawnProjectile(w, {
    x: e.x + dx * off, z: e.z + dz * off, y: o.y === undefined ? 0.7 : o.y, dirX: dx, dirZ: dz,
    speed: o.speed || 5, damage: (o.damage === undefined ? e.damage : o.damage) * (e.dmgMul || 1), radius: o.radius || 0.2,
    kind: o.kind || "orb", hostile: true, range: o.range || 12, sourceName: e.name,
  });
}
// Harmless line that shows where a projectile will fly.
export function aimLine(e, w, angle, windup, length = 8, width = 0.3, x = e.x, z = e.z) {
  return tele(e, w, { shape: "line", x, z, angle, length, width, windup, damage: 0 });
}
export function clampInside(w, x, z, r, out) {
  out.x = x; out.z = z;
  resolveCollision(w, out, r);
  return out;
}

// Fade a whole actor (ghost). Materials are cached once.
function setAlpha(e, a) {
  if (!e.mats) {
    e.mats = [];
    e.group.traverse(o => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) { m.transparent = true; m.needsUpdate = true; e.mats.push({ m, base: m.opacity }); }
    });
  }
  for (const r of e.mats) r.m.opacity = r.base * a;
}

// ---------------------------------------------------------------- actor base
const hooked = new WeakSet();
export function createActor(world, cfg) {
  if (!hooked.has(world)) {
    hooked.add(world);
    // combat sets dead=true on lethal damage; make sure drops/splits/boss:death happen even if update never runs again
    world.events.on("enemy:death", (p) => { const en = p && p.enemy; if (en && en.world === world && en.brain) finish(en, world); });
  }
  const asset = makeAsset(cfg.asset);
  const group = new world.THREE.Group();
  group.rotation.order = "YXZ";
  group.add(asset.group);
  // Red aura on the ground under every hostile actor: a soft disc and a bright ring, sized to its body.
  const T = world.THREE, r = cfg.radius;
  const auraMat = (opacity) => new T.MeshBasicMaterial({ color: AURA_COLOR, transparent: true, opacity, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
  const aura = new T.Group(); aura.name = "aura"; aura.position.y = 0.03;
  const glow = new T.Mesh(new T.CircleGeometry(r * 1.9, 24).rotateX(-Math.PI / 2), auraMat(0.16));
  const ring = new T.Mesh(new T.RingGeometry(r * 1.45, r * 1.7, 28).rotateX(-Math.PI / 2), auraMat(0.55));
  glow.name = ring.name = "aura"; ring.position.y = 0.005;
  aura.add(glow, ring);
  group.add(aura);
  world.add(group);
  const e = {
    type: cfg.type, name: cfg.name, maxHp: cfg.hp, x: cfg.x, z: cfg.z, y: 0, radius: cfg.radius,
    speed: cfg.speed, damage: cfg.damage, tip: cfg.tip || "", boss: !!cfg.boss, drop: cfg.drop || 0,
    dead: false, status: { burnT: 0, burnDps: 0, slowT: 0, slowPct: 0, frozenT: 0, bleedT: 0, bleedDps: 0, stunT: 0 },
    speedMul: 1, group, asset, world, yaw: cfg.yaw || 0, pitch: 0, sx: 1, sy: 1, baseScale: cfg.scale || 1,
    state: "idle", t: 0, cd: 0, tels: [], brain: null, def: null, _done: false, guard: false,
    aura, dmgMul: 1, act: "idle", k: 0, mv: 0, px: cfg.x, pz: cfg.z, // what the model is told: its act, 0..1 through it, and how fast it walks
  };
  e.hp = cfg.hp;
  e.update = (w, dt) => updateActor(e, w, dt);
  e.dispose = (w) => disposeActor(e, w);
  world.enemies.push(e);
  sync(e);
  return e;
}

function sync(e) {
  // the aura stays flat on the ground while the body hops, hovers or squashes, and breathes slowly
  e.aura.position.y = (0.03 - e.y) / (e.baseScale * e.sy);
  const pulse = 1 + 0.08 * Math.sin(e.world.time * 4 + e.x + e.z);
  e.aura.scale.set(pulse / e.sx, 1, pulse / e.sx);
  e.group.position.set(e.x, e.y, e.z);
  e.group.rotation.y = e.yaw;
  e.group.rotation.x = e.pitch;
  const s = e.baseScale;
  e.group.scale.set(s * e.sx, s * e.sy, s * e.sx);
}

function updateActor(e, w, dt) {
  if (e.dead || e.hp <= 0) { finish(e, w); return; }
  tickStatus(w, e, dt);
  if (e.dead || e.hp <= 0) { finish(e, w); return; }
  if (e.brain) e.brain(e, w, dt);
  if (e.dead || e.hp <= 0) { finish(e, w); return; }
  if (!e.noSep) separate(e, w);
  TMP.x = e.x; TMP.z = e.z;
  resolveCollision(w, TMP, e.radius);
  e.x = TMP.x; e.z = TMP.z;
  // the model walks as fast as the actor actually moved this frame (smoothed), and plays the brain's act
  const sp = Math.hypot(e.x - e.px, e.z - e.pz) / Math.max(dt, 1e-3) / Math.max(e.speed, 0.5);
  e.px = e.x; e.pz = e.z;
  e.mv += (Math.min(1, sp) - e.mv) * Math.min(1, dt * 12);
  POSE.move = e.mv; POSE.act = e.act; POSE.k = e.k;
  e.asset.update(w.time, POSE);
  sync(e);
}
const POSE = { move: 0, act: "idle", k: 0 };
const AURA_COLOR = 0xff3d5a; // the danger red used by telegraphs

function separate(e, w) {
  const list = w.enemies;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o === e || o.dead || o.noSep) continue;
    const dx = e.x - o.x, dz = e.z - o.z, min = (e.radius + o.radius) * 0.9;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2), push = (min - d) * (o.boss ? 0.9 : 0.5);
      if (d < 1e-6) { e.x += push * (i % 2 ? 1 : -1); continue; } // stacked exactly: split sideways
      e.x += dx / d * push; e.z += dz / d * push;
    }
  }
  const p = w.player;
  if (p && !p.dead) {
    const dx = e.x - p.x, dz = e.z - p.z, min = e.radius + p.radius * 0.8, d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2) || 0.001;
      e.x += dx / d * (min - d); e.z += dz / d * (min - d);
    }
  }
}

function finish(e, w) {
  if (e._done) return;
  e._done = true;
  e.dead = true;
  killTelegraphs(e);
  e.group.visible = false;
  if (e.def && e.def.die) e.def.die(e, w);
  if (e.onDeath) e.onDeath(e, w);
  if (e.drop > 0) w.events.emit("currency", { amount: e.drop });
  if (w.fx && w.fx.burst) w.fx.burst(e.x, 0.5, e.z, 0xa070ff, e.boss ? 24 : 8, e.boss ? 5 : 3);
}

function disposeActor(e, w) {
  killTelegraphs(e);
  w.remove(e.group);
  e.group.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.dispose(); }
  });
}

// ---------------------------------------------------------------- regular enemy state machine
// The whole machine: every state a regular enemy can be in and every move it can make. e.t is seconds in the state.
export const ENEMY_FLOW = checkTable({
  idle: { NOTICE: "aggro" },                           // waits until the player is near or it is hurt
  aggro: { WINDUP: "windup" },                         // approaches; attacks when off cooldown and in range
  windup: { STRIKE: "attack", INTERRUPT: "recover" },  // the tell; a stun or freeze cancels it with no damage
  attack: { END: "recover" },
  recover: { READY: "aggro" },
});
function go(e, ev) { transition(ENEMY_FLOW, e, ev); e.t = 0; }
function regularBrain(e, w, dt) {
  const D = e.def, p = w.player;
  e.sx = 1; e.sy = 1; e.pitch = 0;
  if (!p || p.dead) return;
  const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 0.0001;
  const ux = dx / d, uz = dz / d;
  e.t += dt;
  switch (e.state) {
    case "idle":
      if (d < AGGRO || e.hp < e.maxHp) { go(e, "NOTICE"); e.cd = D.first !== undefined ? D.first : 0.5 + w.rng() * 0.5; }
      break;
    case "aggro":
      turn(e, yawOf(dx, dz), 7 * dt);
      e.cd -= dt;
      if (e.speedMul > 0.01) {
        if (D.move) D.move(e, w, dt, d, ux, uz);
        if (e.cd <= 0 && D.canAttack(e, d)) {
          go(e, "WINDUP"); e.wu = D.windup;
          e.aim = yawOf(ux, uz); e.yaw = e.aim; e.aimX = p.x; e.aimZ = p.z;
          D.start(e, w, d, ux, uz);
        }
      }
      break;
    case "windup": {
      if (e.status.stunT > 0 || e.status.frozenT > 0) { cancel(e); break; }   // interrupted: no damage
      const k = clamp(e.t / e.wu, 0, 1);
      e.k = k;
      e.noSep = !!D.noSepWindup;
      if (D.windupTick) D.windupTick(e, w, dt, k);
      if (e.t >= e.wu) {
        go(e, "STRIKE");
        if (D.attack) D.attack(e, w);
      }
      break;
    }
    case "attack": {
      const hold = D.hold === undefined ? 0.12 : D.hold;
      e.k = clamp(e.t / hold, 0, 1);
      if (D.attackTick) D.attackTick(e, w, dt, e.k);
      if (e.t >= hold) { go(e, "END"); e.noSep = false; if (D.endAttack) D.endAttack(e, w); }
      break;
    }
    case "recover":
      if (e.speedMul <= 0.01) e.t -= dt;      // frozen / stunned: stay helpless
      e.k = clamp(e.t / D.recover, 0, 1);
      if (D.recoverTick) D.recoverTick(e, w, dt, d, ux, uz);
      if (e.t >= D.recover) {
        go(e, "READY"); e.guard = D.guard === true;
        e.cd = D.cd * (0.75 + w.rng() * 0.5);
      }
      break;
  }
  e.act = e.state === "aggro" ? "idle" : e.state; // the model has no pose for "aggro": it idles or walks
}

function cancel(e) {
  killTelegraphs(e);
  if (e.def.cancel) e.def.cancel(e);
  e.y = 0; e.group.visible = true; e.noSep = false;
  go(e, "INTERRUPT");
}

// Shared small moves
function keepDistance(e, w, dt, d, ux, uz, near, far, mul = 1) {
  if (d < near) walk(e, -ux, -uz, e.speed * 1.15 * mul, dt);
  else if (d > far) walk(e, ux, uz, e.speed * mul, dt);
  else {
    e.strafeT = (e.strafeT || 0) - dt;
    if (e.strafeT <= 0) { e.strafe = w.rng() < 0.5 ? -1 : 1; e.strafeT = 1 + w.rng() * 1.5; }
    walk(e, -uz * e.strafe, ux * e.strafe, e.speed * 0.6 * mul, dt);
  }
}

// ---------------------------------------------------------------- type definitions
const RAT_R = 0.9;

const DEFS = {
  skeleton: {
    windup: 0.5, hold: 0.14, recover: 0.8, cd: 0.7,
    canAttack: (e, d) => d < 1.5,
    move(e, w, dt, d, ux, uz) { if (d > 1.0) walk(e, ux, uz, e.speed, dt); },
    start(e, w) {
      tele(e, w, { shape: "cone", x: e.x, z: e.z, angle: e.aim, radius: 1.6, arc: 1.75, windup: e.wu });
    },
    windupTick(e, w, dt, k) { e.pitch = -0.35 * k; e.sy = 1 + 0.06 * k; },
    attackTick(e, w, dt) { walk(e, Math.sin(e.aim), Math.cos(e.aim), 3.2, dt); e.pitch = 0.3; },
  },

  slime: slimeDef(1.0, 3.4, 1.0),
  slimeling: slimeDef(0.7, 2.6, 0.72),

  rats: {
    windup: 0.38, hold: 0.1, recover: 0.5, cd: 0.35, first: 0.4,
    canAttack: (e, d) => d < 1.25,
    move(e, w, dt, d, ux, uz) { if (d > 0.6) walk(e, ux, uz, e.speed, dt); },
    start(e, w) {
      tele(e, w, { shape: "circle", x: e.x + Math.sin(e.aim) * 0.4, z: e.z + Math.cos(e.aim) * 0.4, radius: RAT_R, windup: e.wu });
    },
    windupTick(e, w, dt, k) { e.sy = 1 - 0.25 * k; e.sx = 1 + 0.2 * k; },
    attackTick(e, w, dt) { walk(e, Math.sin(e.aim), Math.cos(e.aim), 4, dt); },
  },

  archer: {
    windup: 0.62, hold: 0.1, recover: 1.0, cd: 1.3, first: 0.9,
    canAttack: (e, d) => d < 7.5 && d > 1.2,
    move(e, w, dt, d, ux, uz) { keepDistance(e, w, dt, d, ux, uz, 3.2, 6.2); },
    start(e, w) { aimLine(e, w, e.aim, e.wu, 8.5, 0.35); },
    windupTick(e, w, dt, k) { e.pitch = -0.2 * k; },
    attack(e, w) { shoot(e, w, e.aim, { speed: 9, damage: e.damage, kind: "arrow", range: 10, y: 0.5 }); },
  },

  bat: {
    windup: 0.58, hold: 0.1, recover: 0.9, cd: 1.5, first: 0.8,
    canAttack: (e, d) => d < 5.2,
    move(e, w, dt, d, ux, uz) {
      // circle the player at about 2.8 tiles
      e.orb = (e.orb === undefined ? w.rng() * TAU : e.orb) + dt * 1.5 * (e.orbDir || (e.orbDir = w.rng() < 0.5 ? -1 : 1));
      const p = w.player, tx = p.x + Math.cos(e.orb) * 2.8, tz = p.z + Math.sin(e.orb) * 2.8;
      const ax = tx - e.x, az = tz - e.z, ad = Math.hypot(ax, az) || 1;
      walk(e, ax / ad, az / ad, e.speed * Math.min(1, ad), dt);
    },
    start(e, w) {
      e.sx0 = e.x - Math.sin(e.aim) * 0.4; e.sz0 = e.z - Math.cos(e.aim) * 0.4;
      e.dashLen = 4.6;
      tele(e, w, { shape: "line", x: e.sx0, z: e.sz0, angle: e.aim, length: e.dashLen, width: 0.8, windup: e.wu });
    },
    windupTick(e, w, dt, k) {
      const dashAt = e.wu - 0.2, dx = Math.sin(e.aim), dz = Math.cos(e.aim);
      if (e.t < dashAt) {
        const u = e.t / dashAt;       // pull back, shaking
        e.x = lerp(e.x, e.sx0, 0.25); e.z = lerp(e.z, e.sz0, 0.25);
        e.pitch = 0.5 * u; e.sx = 1 + 0.06 * Math.sin(e.t * 60);
      } else {
        const u = (e.t - dashAt) / 0.2;
        e.x = e.sx0 + dx * e.dashLen * u; e.z = e.sz0 + dz * e.dashLen * u; e.pitch = -0.4;
      }
    },
    attackTick(e, w, dt) { e.pitch = -0.2; },
    noSepWindup: true,
  },

  ghost: {
    windup: 0.8, hold: 0.25, recover: 1.0, cd: 1.6, first: 1.0,
    canAttack: (e, d) => d < 5.5,
    move(e, w, dt, d, ux, uz) { if (d > 3.0) walk(e, ux, uz, e.speed, dt); },
    start(e, w) {
      tele(e, w, { shape: "circle", x: e.aimX, z: e.aimZ, radius: 1.2, windup: e.wu });
    },
    windupTick(e, w, dt, k) {
      setAlpha(e, k < 0.5 ? 1 - 0.88 * (k / 0.5) : 0.12);
      if (e.t > e.wu - 0.05) { e.x = e.aimX; e.z = e.aimZ; }    // reappears where the circle is
    },
    attack(e, w) { e.x = e.aimX; e.z = e.aimZ; },
    attackTick(e, w, dt, k) { setAlpha(e, 0.12 + 0.88 * k); },
    cancel(e) { setAlpha(e, 1); },
    endAttack(e) { setAlpha(e, 1); },
  },

  wisp: {
    windup: 0.6, hold: 0.1, recover: 1.3, cd: 1.5, first: 1.0,
    canAttack: (e, d) => d < 7.5,
    move(e, w, dt, d, ux, uz) { keepDistance(e, w, dt, d, ux, uz, 3.5, 5.5); },
    start(e, w) { for (const o of [-0.3, 0, 0.3]) aimLine(e, w, e.aim + o, e.wu, 7.5, 0.25); },
    windupTick(e, w, dt, k) { e.sx = e.sy = 1 + 0.25 * k; },
    attack(e, w) { for (const o of [-0.3, 0, 0.3]) shoot(e, w, e.aim + o, { speed: 4.2, damage: e.damage, kind: "orb", range: 9, y: 0.9 }); },
  },

  brute: {
    windup: 0.7, hold: 0.15, recover: 1.4, cd: 1.1, first: 0.9,
    canAttack: (e, d) => d < 2.2,
    move(e, w, dt, d, ux, uz) { if (d > 1.3) walk(e, ux, uz, e.speed, dt); },
    start(e, w) {
      tele(e, w, { shape: "circle", x: e.x + Math.sin(e.aim) * 1.0, z: e.z + Math.cos(e.aim) * 1.0, radius: 1.75, windup: e.wu });
    },
    windupTick(e, w, dt, k) { e.sy = 1 + 0.12 * k; e.pitch = -0.3 * k; },
    attack(e, w) { say(w, "slam"); if (w.shake) w.shake(0.15); e.pitch = 0.3; },
    attackTick(e) { e.pitch = 0.3; e.sy = 0.92; },
  },

  spider: {
    windup: 0.8, hold: 0.15, recover: 1.0, cd: 1.3, first: 0.8,
    canAttack: (e, d) => d < 4.8,
    move(e, w, dt, d, ux, uz) {
      e.zig = (e.zig || 0) + dt * 5;
      walk(e, ux - uz * 0.5 * Math.sin(e.zig), uz + ux * 0.5 * Math.sin(e.zig), e.speed, dt);
    },
    start(e, w) {
      tele(e, w, { shape: "circle", x: e.aimX, z: e.aimZ, radius: 1.1, windup: e.wu });
    },
    windupTick(e, w, dt, k) {
      const t = e.t, wu = e.wu;
      if (t < 0.3) { e.y = 6 * (t / 0.3) * (t / 0.3); e.sy = 1 + 0.2 * (t / 0.3); }
      else if (t < wu - 0.25) { e.y = 6; e.x = e.aimX; e.z = e.aimZ; }
      else { const u = (t - (wu - 0.25)) / 0.25; e.y = 6 * (1 - u * u); e.x = e.aimX; e.z = e.aimZ; }
      e.group.visible = e.y < 3.5;
    },
    attack(e, w) { e.y = 0; e.x = e.aimX; e.z = e.aimZ; e.group.visible = true; if (w.shake) w.shake(0.08); },
    attackTick(e) { e.sy = 0.7; e.sx = 1.2; },
    cancel(e) { e.y = 0; },
    noSepWindup: true,
  },

  cultist: {
    windup: 0.7, hold: 0.1, recover: 1.5, cd: 1.9, first: 1.2,
    canAttack: (e, d) => d < 7,
    move(e, w, dt, d, ux, uz) { keepDistance(e, w, dt, d, ux, uz, 3.0, 6.0); },
    start(e, w) {
      tele(e, w, { shape: "circle", x: e.aimX, z: e.aimZ, radius: 1.25, windup: e.wu });
    },
    windupTick(e, w, dt, k) { e.sy = 1 + 0.1 * k; e.y = 0.1 * k; },
    attackTick(e) { e.y = 0; },
  },

  knight: {
    windup: 0.75, hold: 0.12, recover: 1.1, cd: 1.3, first: 1.0, guard: true,
    canAttack: (e, d) => d < 5.5,
    move(e, w, dt, d, ux, uz) { if (d > 1.4) walk(e, ux, uz, e.speed, dt); },
    start(e, w, d) {
      e.guard = false;
      if (d > 2.4) {
        e.mode = "charge"; e.wu = 0.75; e.sx0 = e.x; e.sz0 = e.z; e.dashLen = 5.5;
        tele(e, w, { shape: "line", x: e.x, z: e.z, angle: e.aim, length: e.dashLen, width: 1.0, windup: e.wu, damage: e.damage });
      } else {
        e.mode = "bash"; e.wu = 0.55;
        tele(e, w, { shape: "cone", x: e.x, z: e.z, angle: e.aim, radius: 1.7, arc: 1.75, windup: e.wu, damage: Math.round(e.damage * 0.85) });
      }
    },
    windupTick(e, w, dt, k) {
      e.guard = false;
      if (e.mode === "charge") {
        const dashAt = e.wu - 0.25;
        if (e.t < dashAt) e.pitch = -0.25 * (e.t / dashAt);
        else {
          const u = (e.t - dashAt) / 0.25, dx = Math.sin(e.aim), dz = Math.cos(e.aim);
          e.x = e.sx0 + dx * e.dashLen * u; e.z = e.sz0 + dz * e.dashLen * u; e.pitch = 0.3;
        }
      } else e.pitch = -0.3 * k;
    },
    attackTick(e) { e.pitch = 0.2; },
    recoverTick(e) { e.guard = false; },        // guard is down while recovering: strike now
    noSepWindup: true,
  },

  mushroom: {
    windup: 0.7, hold: 0.1, recover: 1.6, cd: 1.6, first: 1.0,
    canAttack: (e, d) => d < 5.5,
    move(e, w, dt, d, ux, uz) { if (d > 3.5) walk(e, ux, uz, e.speed, dt); },
    start(e, w) {
      const x = e.aimX, z = e.aimZ, name = e.name;
      tele(e, w, {
        shape: "circle", x, z, radius: 1.5, windup: e.wu, damage: e.damage,
        onResolve: (world) => { world.hazards.push(createSporeCloud(world, x, z, 1.5, name)); },
      });
    },
    windupTick(e, w, dt, k) { e.sy = 1 - 0.2 * k; e.sx = 1 + 0.25 * k; },
    attackTick(e) { e.sy = 1.2; e.sx = 0.9; },
  },
};

function slimeDef(scaleCircle, maxHop, _s) {
  return {
    windup: 0.7, hold: 0.12, recover: 0.9, cd: 0.8, first: 0.7,
    canAttack: (e, d) => d < maxHop && d > 0.9,
    move(e, w, dt, d, ux, uz) {
      e.hopT = (e.hopT || 0) + dt;
      const cyc = (e.hopT % 0.9) / 0.9;
      if (cyc < 0.35) {
        e.y = Math.sin(cyc / 0.35 * Math.PI) * 0.22;
        if (d > 1.05) walk(e, ux, uz, e.speed * 2.4, dt);
      } else { e.y = 0; e.sy = 0.9; e.sx = 1.06; }
    },
    start(e, w, d, ux, uz) {
      const dist = Math.min(d, maxHop);
      clampInside(w, e.x + ux * dist, e.z + uz * dist, e.radius, TMP);
      e.hx = e.x; e.hz = e.z; e.tx = TMP.x; e.tz = TMP.z; e.y = 0;
      tele(e, w, { shape: "circle", x: e.tx, z: e.tz, radius: scaleCircle, windup: e.wu });
    },
    windupTick(e, w, dt, k) {
      const t = e.t;
      if (t < 0.4) { const u = t / 0.4; e.sy = 1 - 0.3 * u; e.sx = 1 + 0.15 * u; }
      else {
        const u = clamp((t - 0.4) / 0.3, 0, 1);
        e.x = lerp(e.hx, e.tx, u); e.z = lerp(e.hz, e.tz, u);
        e.y = Math.sin(u * Math.PI) * 0.9; e.sy = 1.15; e.sx = 0.92;
      }
    },
    attack(e, w) { e.x = e.tx; e.z = e.tz; e.y = 0; },
    attackTick(e) { e.sy = 0.7; e.sx = 1.25; },
    cancel(e) { e.y = 0; },
    noSepWindup: true,
    die(e, w) {
      if (e.type !== "slime") return;
      for (let i = 0; i < 2; i++) {
        const a = (i ? Math.PI : 0) + w.rng() * 1.2;
        createEnemy(w, "slimeling", e.x + Math.cos(a) * 0.5, e.z + Math.sin(a) * 0.5, { aggro: true });
      }
    },
  };
}

// Lingering spore cloud (hazard). The telegraph circle before it is the tell; this just lingers for 2 s.
function createSporeCloud(w, x, z, r, name) {
  const T = w.THREE;
  const group = new T.Group();
  const disc = new T.Mesh(new T.CircleGeometry(r, 28), new T.MeshBasicMaterial({ color: 0x9ad06a, transparent: true, opacity: 0.35, depthWrite: false }));
  const ring = new T.Mesh(new T.RingGeometry(r - 0.07, r, 32), new T.MeshBasicMaterial({ color: 0xff3d5a, transparent: true, opacity: 0.7, depthWrite: false }));
  disc.rotation.x = ring.rotation.x = -Math.PI / 2;
  disc.position.y = 0.04; ring.position.y = 0.05;
  group.add(disc, ring); group.position.set(x, 0, z);
  w.add(group);
  const h = {
    dead: false, t: 0, tick: 0.3,
    update(world, dt) {
      h.t += dt;
      const fade = h.t > 1.5 ? 1 - (h.t - 1.5) / 0.5 : 1;
      disc.material.opacity = (0.28 + 0.1 * Math.sin(h.t * 8)) * fade;
      ring.material.opacity = 0.7 * fade;
      h.tick -= dt;
      const p = world.player;
      if (h.tick <= 0 && p && !p.dead) {
        h.tick = 0.5;
        if (Math.hypot(p.x - x, p.z - z) <= r + p.radius * 0.5) damagePlayer(world, 2, name);
      }
      if (h.t >= 2) h.dead = true;
    },
    dispose(world) {
      world.remove(group);
      disc.geometry.dispose(); disc.material.dispose(); ring.geometry.dispose(); ring.material.dispose();
    },
  };
  return h;
}

// Imp: hovers at mid range and throws two fireballs, one straight and one wide to a random side. Scorpion: circles close, then stings along a
// short line. Totem: never moves; pulses a wide circle around itself when the player comes near.
const IMP_SPREAD = 0.3;
DEFS.imp = {
  windup: 0.55, hold: 0.1, recover: 0.8, cd: 1.7, first: 0.9,
  canAttack: (e, d) => d < 7 && d > 1.2,
  move(e, w, dt, d, ux, uz) { keepDistance(e, w, dt, d, ux, uz, 2.6, 5.0, 1.15); },
  start(e, w) {
    e.side = w.rng() < 0.5 ? -1 : 1;
    for (const k of [0, 1]) aimLine(e, w, e.aim + k * e.side * IMP_SPREAD, e.wu, 8, 0.4);
  },
  windupTick(e, w, dt, k) { e.sy = 1 + 0.12 * k; e.pitch = -0.15 * k; },
  attack(e, w) { for (const k of [0, 1]) shoot(e, w, e.aim + k * e.side * IMP_SPREAD, { speed: 6.5, kind: "fireball", radius: 0.24, range: 9 }); },
};
DEFS.scorpion = {
  windup: 0.45, hold: 0.12, recover: 0.9, cd: 0.9,
  canAttack: (e, d) => d < 2.3,
  move(e, w, dt, d, ux, uz) { keepDistance(e, w, dt, d, ux, uz, 1.2, 2.0); },
  start(e, w) { tele(e, w, { shape: "line", x: e.x, z: e.z, angle: e.aim, length: 2.8, width: 0.7, windup: e.wu }); },
  windupTick(e, w, dt, k) { e.pitch = 0.25 * k; e.sx = 1 + 0.05 * Math.sin(e.t * 50); },
  attackTick(e) { e.pitch = -0.3; },
};
DEFS.totem = {
  windup: 0.9, hold: 0.15, recover: 1.3, cd: 1.6, first: 0.8,
  canAttack: (e, d) => d < 3.4,
  start(e, w) { tele(e, w, { shape: "circle", x: e.x, z: e.z, radius: 2.4, windup: e.wu }); },
  windupTick(e, w, dt, k) { e.sy = 1 + 0.1 * k; e.sx = 1 - 0.05 * k; },
  attack(e, w) { say(w, "slam"); },
};

// ---------------------------------------------------------------- public tables
export const ENEMY_TYPES = {
  skeleton: { name: "Skeleton grunt", asset: "enemy-skeleton", hp: 30, speed: 2.0, radius: 0.3, damage: 10, floors: [1, 2],
    tip: "Its swing is slow and short: step out of the red cone, then hit it while it recovers." },
  slime: { name: "Slime", asset: "enemy-slime", hp: 24, speed: 1.6, radius: 0.35, damage: 8, floors: [1, 2],
    tip: "Slimes land where you stood. Move when it crouches, and expect two small slimes when it pops." },
  rats: { name: "Rat swarm", asset: "enemy-rat-swarm", hp: 14, speed: 3.4, radius: 0.35, damage: 4, floors: [1, 2],
    tip: "Rats are fast but weak and bite in a small circle. Dodge the bite, then cut them down." },
  archer: { name: "Goblin archer", asset: "enemy-goblin-archer", hp: 18, speed: 1.9, radius: 0.3, damage: 8, floors: [1, 2, 3],
    tip: "A red line shows the arrow's path. Step sideways off it, then close the distance." },
  bat: { name: "Cave bat", asset: "enemy-bat", hp: 12, speed: 3.2, radius: 0.3, damage: 8, floors: [1, 2, 3],
    tip: "The bat pulls back, then dives along the red line. Leave the line and hit it as it lands." },
  ghost: { name: "Ghost", asset: "enemy-ghost", hp: 20, speed: 1.5, radius: 0.35, damage: 10, floors: [2, 3],
    tip: "When the ghost fades, a circle marks where it returns. Walk out of the circle." },
  spider: { name: "Giant cave spider", asset: "enemy-spider", hp: 16, speed: 2.8, radius: 0.4, damage: 11, floors: [2, 3],
    tip: "It leaps out of sight and drops on the circle. Leave the circle before it lands." },
  knight: { name: "Skeleton knight", asset: "enemy-skeleton-knight", hp: 55, speed: 1.5, radius: 0.4, damage: 14, floors: [2, 3],
    tip: "Its shield blocks hits from the front. Dodge its charge, then strike from behind or while it recovers." },
  brute: { name: "Armoured brute", asset: "enemy-brute", hp: 70, speed: 1.0, radius: 0.5, damage: 18, floors: [2, 3],
    tip: "Its slam is slow but huge. Back away when it rears up, then hit it from behind its recovery." },
  wisp: { name: "Wisp", asset: "enemy-wisp", hp: 14, speed: 1.5, radius: 0.3, damage: 7, floors: [3],
    tip: "Wisps fire three slow orbs along red lines. Slip between the lines, or bash the orbs away." },
  cultist: { name: "Cultist", asset: "enemy-cultist", hp: 22, speed: 1.3, radius: 0.3, damage: 12, floors: [3],
    tip: "Its circle appears under you and fires after a beat. Keep moving, then rush it." },
  mushroom: { name: "Spore mushroom", asset: "enemy-mushroom", hp: 28, speed: 0.9, radius: 0.35, damage: 5, floors: [3],
    tip: "Spores linger for 2 seconds after the burst. Leave the cloud, then attack the mushroom." },
  scorpion: { name: "Ruin scorpion", asset: "enemy-scorpion", hp: 26, speed: 2.6, radius: 0.4, damage: 9, floors: [1, 2],
    tip: "It circles you, then stings along a short red line. Sidestep the line and hit it while the tail is stuck." },
  imp: { name: "Fire imp", asset: "enemy-imp", hp: 16, speed: 2.4, radius: 0.3, damage: 7, floors: [2, 3],
    tip: "Imps throw two fireballs: one straight at you, one wide to a side. Step to the side with no red line." },
  totem: { name: "Hex totem", asset: "enemy-totem", hp: 45, speed: 0, radius: 0.35, damage: 13, floors: [3],
    tip: "The totem never moves. Step out of its circle when it swells, then strike before the next pulse." },
  // Spawned by slimes dying; not placed in waves.
  slimeling: { name: "Small slime", asset: "enemy-slime", hp: 8, speed: 1.8, radius: 0.22, damage: 5, floors: [], scale: 0.6, drop: 1,
    tip: "Small slimes hop at you in a tight circle. Move after the crouch." },
};

export function createEnemy(world, type, x, z, opts = {}) {
  const T = ENEMY_TYPES[type];
  if (!T) throw new Error(`unknown enemy type ${type}`);
  const e = createActor(world, {
    type, name: T.name, asset: T.asset, hp: T.hp, speed: T.speed, radius: T.radius, damage: T.damage, tip: T.tip,
    x, z, scale: T.scale, drop: T.drop !== undefined ? T.drop : world.rng.int(2, 4),
    yaw: world.player ? yawOf(world.player.x - x, world.player.z - z) : 0,
  });
  e.def = DEFS[type];
  e.brain = regularBrain;
  e.guard = e.def.guard === true;
  if (type === "knight") installGuard(e);
  if (opts.aggro) { e.state = "aggro"; e.cd = 0.9 + world.rng() * 0.4; }
  return e;
}

// Knight: frontal hits are reduced to 25% while the guard is up (hp is an accessor so combat needs no change).
function installGuard(e) {
  let hp = e.maxHp;
  Object.defineProperty(e, "hp", {
    enumerable: true, configurable: true,
    get() { return hp; },
    set(v) {
      if (v < hp && e.guard && !e.dead) {
        const p = e.world.player;
        if (p && Math.abs(angDiff(yawOf(p.x - e.x, p.z - e.z), e.yaw)) < 1.2) {
          v = hp - (hp - v) * 0.25;
          const w = e.world;
          if (w.fx && w.fx.burst) w.fx.burst(e.x + Math.sin(e.yaw) * 0.4, 0.7, e.z + Math.cos(e.yaw) * 0.4, 0xa9a7c4, 5, 2.5);
        }
      }
      hp = v;
    },
  });
}
