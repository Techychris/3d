// Module B: bosses. Three bosses, 3 phases (66% / 33% hp), every attack telegraphed >= 0.6 s (we use 0.8-1.0 s).
import { yawOf, clamp } from "./world.js";
import { checkTable, transition } from "../core/fsm.js";
import {
  createActor, createEnemy, tele, killTelegraphs, shoot, aimLine, say, turn, walk, lerp, clampInside,
} from "./enemies.js";

const TMP = { x: 0, z: 0 };

export const BOSS_TYPES = {
  "slime-king": { name: "Slime King", asset: "boss-slime-king", hp: 300, speed: 1.0, radius: 0.9, damage: 14,
    tip: "The King crouches before every hop. Leave the circle, then punish him while he wobbles. At half health he splits off slimes." },
  "stone-golem": { name: "Stone Golem", asset: "boss-golem", hp: 450, speed: 0.8, radius: 1.0, damage: 18,
    tip: "Slams land in circles; cracks run in lines with safe gaps between them. Stand in the gaps." },
  necromancer: { name: "Necromancer", asset: "boss-necromancer", hp: 600, speed: 1.4, radius: 0.75, damage: 12,
    tip: "Watch the red lines for skulls, kill summoned skeletons fast, and sidestep the cone blasts." },
};

export function createBoss(world, bossId, x, z) {
  const B = BOSS_TYPES[bossId];
  if (!B) throw new Error(`unknown boss ${bossId}`);
  const e = createActor(world, {
    type: bossId, name: B.name, asset: B.asset, hp: B.hp, speed: B.speed, radius: B.radius, damage: B.damage,
    tip: B.tip, x, z, boss: true, drop: 25,
    yaw: world.player ? yawOf(world.player.x - x, world.player.z - z) : 0,
  });
  e.phase = 1;
  e.action = null;
  e.gap = 1.4;
  e.next = null;
  e.brain = bossBrain;
  e.def = BRAINS[bossId];
  e.state = "aggro";
  return e;
}

// ---------------------------------------------------------------- action runner
// An action is a timeline: events fire once when t passes `at`; `during(t)` runs every frame; ends at `dur`.
function seq(dur, events, during) { return { t: 0, dur, events, during, i: 0 }; }
function chain(...factories) { return { factories, cur: null }; }

function runAction(a, e, w, dt) {
  if (a.factories) {
    if (!a.cur) {
      const f = a.factories.shift();
      if (!f) return true;
      a.cur = f(e, w);
    }
    if (runAction(a.cur, e, w, dt)) a.cur = null;
    return false;
  }
  a.t += dt;
  for (const ev of a.events) {
    if (!ev.done && a.t >= ev.at) { ev.done = true; ev.fn(); }
  }
  if (a.during) a.during(a.t);
  return a.t >= a.dur;
}
const at = (t, fn) => ({ at: t, fn, done: false });

// The whole boss machine. "aggro": between attacks (moves, counts e.gap down). "attack": e.action is running.
// e.action is non-null exactly while the state is "attack".
export const BOSS_FLOW = checkTable({
  aggro: { ATTACK: "attack" },
  attack: { DONE: "aggro", INTERRUPT: "aggro" },   // a stun or freeze interrupts the attack, like regular enemies
});
function endAttack(e, ev) { transition(BOSS_FLOW, e, ev); e.action = null; e.gap = e.def.gap[e.phase - 1]; }

function bossBrain(e, w, dt) {
  const p = w.player;
  e.sx = 1; e.sy = 1; e.pitch = 0;
  const ratio = e.hp / e.maxHp;
  const want = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
  while (e.phase < want) {
    e.phase++;
    w.events.emit("boss:phase", { boss: e, phase: e.phase });
    say(w, "boss");
    if (w.shake) w.shake(0.25);
    if (e.def.onPhase) e.def.onPhase(e, w);
  }
  if (!p || p.dead) return;
  const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 0.0001;
  const ux = dx / d, uz = dz / d;
  const helpless = e.status.stunT > 0 || e.status.frozenT > 0;
  if (e.state === "attack") {
    if (helpless) { killTelegraphs(e); endAttack(e, "INTERRUPT"); } // bosses get half-length stuns
    else if (runAction(e.action, e, w, dt)) endAttack(e, "DONE");
  } else if (!helpless) {
    e.gap -= dt;
    turn(e, yawOf(dx, dz), 3 * dt);
    if (e.speedMul > 0.01) e.def.move(e, w, dt, d, ux, uz);
    if (e.gap <= 0) {
      e.action = e.next || e.def.pick(e, w, d);
      e.next = null;
      transition(BOSS_FLOW, e, "ATTACK");
      e.aim = yawOf(ux, uz); e.yaw = e.aim;
    }
  }
}

function aimAt(e, w) {
  const p = w.player;
  e.aim = yawOf(p.x - e.x, p.z - e.z);
  e.yaw = e.aim;
  return e.aim;
}

function weighted(w, list) {
  let total = 0;
  for (const [, wt] of list) total += wt;
  let r = w.rng() * total;
  for (const [f, wt] of list) { r -= wt; if (r <= 0) return f; }
  return list[0][0];
}

// ================================================================ Slime King
function kingHop(radius, damage) {
  return (e, w) => {
    const p = w.player;
    const wu = 0.9;
    clampInside(w, p.x, p.z, e.radius, TMP);
    const hx = e.x, hz = e.z, tx = TMP.x, tz = TMP.z;
    aimAt(e, w);
    return seq(1.3, [
      at(0, () => tele(e, w, { shape: "circle", x: tx, z: tz, radius, windup: wu, damage })),
      at(wu, () => { e.x = tx; e.z = tz; e.y = 0; say(w, "slam"); if (w.shake) w.shake(0.25); if (w.fx) w.fx.burst(tx, 0.2, tz, 0x7cc8a0, 14, 4); }),
    ], (t) => {
      if (t < 0.55) { const u = t / 0.55; e.sy = 1 - 0.28 * u; e.sx = 1 + 0.14 * u; }
      else if (t < wu) {
        const u = (t - 0.55) / (wu - 0.55);
        e.x = lerp(hx, tx, u); e.z = lerp(hz, tz, u);
        e.y = Math.sin(u * Math.PI) * 1.8; e.sy = 1.12; e.sx = 0.94;
      } else { const u = clamp((t - wu) / 0.4, 0, 1); e.sy = 0.7 + 0.3 * u; e.sx = 1.25 - 0.25 * u; }
    });
  };
}

function kingSpit(n) {
  return (e, w) => {
    const base = aimAt(e, w), step = 0.4, wu = 0.85;
    const angles = [];
    for (let i = 0; i < n; i++) angles.push(base + (i - (n - 1) / 2) * step);
    return seq(1.5, [
      at(0, () => { for (const a of angles) aimLine(e, w, a, wu, 9, 0.3); }),
      at(wu, () => { say(w, "slam"); for (const a of angles) shoot(e, w, a, { speed: 4.6, damage: 9, kind: "orb", range: 11, radius: 0.25, y: 0.9 }); }),
    ], (t) => { if (t < wu) { const u = t / wu; e.sx = 1 + 0.15 * u; e.sy = 1 - 0.1 * u; } });
  };
}

function kingSplit() {
  return (e, w) => {
    e.splitDone = true;
    return seq(1.5, [
      at(1.0, () => {
        say(w, "slam"); if (w.shake) w.shake(0.3);
        for (let i = 0; i < 3; i++) {
          const a = e.yaw + (i / 3) * Math.PI * 2 + 0.5;
          clampInside(w, e.x + Math.sin(a) * 1.7, e.z + Math.cos(a) * 1.7, 0.35, TMP);
          createEnemy(w, "slime", TMP.x, TMP.z, { aggro: true });
          if (w.fx) w.fx.burst(TMP.x, 0.3, TMP.z, 0x7cc8a0, 8, 3);
        }
      }),
    ], (t) => {
      if (t < 1.0) { const u = t / 1.0; e.sx = e.sy = 1 + 0.3 * u + Math.sin(t * 50) * 0.03; }
      else { e.sx = e.sy = 1.3 - 0.3 * clamp((t - 1) / 0.3, 0, 1); }
    });
  };
}

// ================================================================ Stone Golem
function golemSlam(radius = 1.8, wu = 0.9, damage = 20) {
  return (e, w) => {
    const p = w.player;
    const d = Math.min(Math.hypot(p.x - e.x, p.z - e.z), 3.4);
    const a = aimAt(e, w);
    const cx = e.x + Math.sin(a) * d, cz = e.z + Math.cos(a) * d;
    return seq(wu + 0.6, [
      at(0, () => tele(e, w, { shape: "circle", x: cx, z: cz, radius, windup: wu, damage })),
      at(wu, () => { say(w, "slam"); if (w.shake) w.shake(0.35); if (w.hitStop) w.hitStop(0.05); if (w.fx) w.fx.burst(cx, 0.2, cz, 0xa893b8, 16, 4); }),
    ], (t) => {
      if (t < wu) { const u = t / wu; e.pitch = -0.28 * u; e.sy = 1 + 0.08 * u; }
      else { e.pitch = 0.25 * (1 - clamp((t - wu) / 0.5, 0, 1)); }
    });
  };
}

function golemFan() {
  return (e, w) => {
    const a = aimAt(e, w), wu = 1.0;
    const offs = [-1.0, -0.5, 0, 0.5, 1.0];
    return seq(wu + 0.7, [
      at(0, () => { for (const o of offs) tele(e, w, { shape: "line", x: e.x, z: e.z, angle: a + o, length: 8, width: 0.7, windup: wu, damage: 14 }); }),
      at(wu, () => { say(w, "slam"); if (w.shake) w.shake(0.3); }),
    ], (t) => { if (t < wu) { e.pitch = -0.3 * (t / wu); e.sy = 1 + 0.06 * t; } else e.pitch = 0.2 * (1 - clamp((t - wu) / 0.5, 0, 1)); });
  };
}

function golemStar() {
  return (e, w) => {
    const a = aimAt(e, w), wu = 1.0;
    const ring = (rot, windup) => { for (let i = 0; i < 8; i++) tele(e, w, { shape: "line", x: e.x, z: e.z, angle: rot + i * Math.PI / 4, length: 7.5, width: 0.7, windup, damage: 13 }); };
    return seq(wu + 0.9 + 0.7, [
      at(0, () => ring(a, wu)),
      at(wu, () => { say(w, "slam"); if (w.shake) w.shake(0.3); }),
      at(0.9, () => ring(a + Math.PI / 8, 0.9)),
      at(0.9 + 0.9, () => { say(w, "slam"); if (w.shake) w.shake(0.3); }),
    ], (t) => { e.pitch = t < wu ? -0.3 * (t / wu) : 0.1; });
  };
}

// ================================================================ Necromancer
function necVolley(n) {
  return (e, w) => {
    const a = aimAt(e, w), wu = 0.8, step = 0.38;
    const angles = [];
    for (let i = 0; i < n; i++) angles.push(a + (i - (n - 1) / 2) * step);
    return seq(1.5, [
      at(0, () => { for (const o of angles) aimLine(e, w, o, wu, 9, 0.28); }),
      at(wu, () => { say(w, "windup"); for (const o of angles) shoot(e, w, o, { speed: 5.4, damage: 9, kind: "orb", range: 12, y: 1.1 }); }),
    ], (t) => { e.pitch = t < wu ? -0.15 * (t / wu) : 0; });
  };
}

function necNova() {
  return (e, w) => {
    const wu = 0.9;
    const rot = w.rng() * Math.PI;
    return seq(1.6, [
      at(0, () => {
        tele(e, w, { shape: "circle", x: e.x, z: e.z, radius: 2.0, windup: wu, damage: 10 });
        for (let i = 0; i < 8; i++) aimLine(e, w, rot + i * Math.PI / 4, wu, 7, 0.22);
      }),
      at(wu, () => { say(w, "slam"); if (w.shake) w.shake(0.2); for (let i = 0; i < 8; i++) shoot(e, w, rot + i * Math.PI / 4, { speed: 3.4, damage: 8, kind: "orb", range: 10, y: 1.0, off: 0.9 }); }),
    ], (t) => { if (t < wu) { e.sx = e.sy = 1 + 0.12 * (t / wu); } });
  };
}

function necSummon() {
  return (e, w) => {
    const p = w.player, wu = 1.0;
    const a = aimAt(e, w);
    const spots = [];
    for (const s of [-1, 1]) {
      clampInside(w, e.x + Math.sin(a) * 2.4 + Math.cos(a) * 2.6 * s, e.z + Math.cos(a) * 2.4 - Math.sin(a) * 2.6 * s, 0.4, TMP);
      spots.push({ x: TMP.x, z: TMP.z });
    }
    return seq(1.6, [
      at(0, () => {
        for (const s of spots) {
          tele(e, w, {
            shape: "circle", x: s.x, z: s.z, radius: 0.9, windup: wu, damage: 8,
            onResolve: (world) => { createEnemy(world, "skeleton", s.x, s.z, { aggro: true }); if (world.fx) world.fx.burst(s.x, 0.3, s.z, 0xa070ff, 10, 3); },
          });
        }
      }),
    ], (t) => { if (t < wu) { e.y = 0.25 * Math.sin((t / wu) * Math.PI); e.pitch = -0.2 * (t / wu); } });
  };
}

function necCone() {
  return (e, w) => {
    const a = aimAt(e, w), wu = 0.9;
    return seq(1.5, [
      at(0, () => tele(e, w, { shape: "cone", x: e.x, z: e.z, angle: a, radius: 6.5, arc: 1.2, windup: wu, damage: 16 })),
      at(wu, () => { say(w, "slam"); if (w.shake) w.shake(0.25); }),
    ], (t) => { e.pitch = t < wu ? -0.2 * (t / wu) : 0.2; });
  };
}

function liveSkeletons(w) {
  let n = 0;
  for (const o of w.enemies) if (!o.dead && o.type === "skeleton") n++;
  return n;
}

// ---------------------------------------------------------------- per-boss brains
function keep(e, w, dt, d, ux, uz, near, far, mul = 1) {
  if (d < near) walk(e, -ux, -uz, e.speed * 1.3 * mul, dt);
  else if (d > far) walk(e, ux, uz, e.speed * mul, dt);
}

const BRAINS = {
  "slime-king": {
    gap: [0.9, 0.7, 0.5],
    move(e, w, dt, d, ux, uz) { if (d > 2.5) walk(e, ux, uz, e.speed, dt); e.sy = 1 + 0.03 * Math.sin(w.time * 6); },
    pick(e, w) {
      if (e.hp / e.maxHp <= 0.5 && !e.splitDone) return chain(kingSplit());
      const r = [1.8, 2.0, 2.3][e.phase - 1], dmg = 14 + e.phase * 2;
      if (e.phase === 1) return chain(kingHop(r, dmg));
      if (e.phase === 2) return weighted(w, [
        [() => chain(kingHop(r, dmg)), 2], [() => chain(kingHop(r, dmg), kingHop(r, dmg)), 1], [() => chain(kingSpit(3)), 1],
      ])();
      return weighted(w, [
        [() => chain(kingHop(r, dmg), kingHop(r, dmg)), 2], [() => chain(kingHop(r, dmg)), 1], [() => chain(kingSpit(5)), 1.5],
      ])();
    },
  },
  "stone-golem": {
    gap: [1.1, 0.9, 0.7],
    move(e, w, dt, d, ux, uz) { if (d > 2.6) walk(e, ux, uz, e.speed, dt); },
    pick(e, w) {
      if (e.phase === 1) return chain(golemSlam());
      if (e.phase === 2) return weighted(w, [[() => chain(golemSlam()), 2], [() => chain(golemFan()), 3]])();
      return weighted(w, [
        [() => chain(golemSlam(1.6, 0.9), golemSlam(1.6, 0.8)), 3], [() => chain(golemStar()), 3], [() => chain(golemFan()), 2],
      ])();
    },
  },
  necromancer: {
    gap: [1.0, 0.8, 0.6],
    move(e, w, dt, d, ux, uz) { keep(e, w, dt, d, ux, uz, 3.8, 5.6); e.y = 0.1 + 0.08 * Math.sin(w.time * 2); },
    onPhase(e) { if (e.phase === 2) e.next = chain(necSummon()); },
    pick(e, w) {
      if (e.phase === 1) return weighted(w, [[() => chain(necVolley(3)), 3], [() => chain(necNova()), 2]])();
      if (e.phase === 2) {
        const many = liveSkeletons(w) >= 3;
        return weighted(w, [
          [() => chain(necSummon()), many ? 0 : 3], [() => chain(necVolley(5)), 2], [() => chain(necNova()), 3],
        ])();
      }
      return weighted(w, [
        [() => chain(necCone(), necCone()), 4], [() => chain(necVolley(5)), 2], [() => chain(necNova()), 2],
        [() => chain(necSummon()), liveSkeletons(w) >= 2 ? 0 : 1],
      ])();
    },
  },
};
