// Module A: the player (hero-warrior). Move, melee arc, dodge, shield bash.
import * as THREE from "three";
import { makeAsset, COLORS } from "../engine/assets.js";
import { resolveCollision, inCone, yawOf } from "./world.js";
import { damageEnemy, applyStatus, makeSectorGeometry } from "./combat.js";
import { checkTable, createMachine } from "../core/fsm.js";

// What the player's body is doing. "free": walk, attack, bash. "dodge": a fixed dash with invulnerability.
// "recover": a brief lockout after the dash. Death is final.
export const PLAYER_FLOW = checkTable({
  free: { DODGE: "dodge", DIE: "dead" },
  dodge: { LAND: "recover", DIE: "dead" },
  recover: { READY: "free", DIE: "dead" },
  dead: {},
});
// The sword swing. Damage lands on HIT (SWING_HIT_AT of the way through); a dodge cancels the swing.
export const SWING_FLOW = checkTable({
  idle: { SWING: "windup" },
  windup: { HIT: "follow", CANCEL: "idle", SWING: "windup" },
  follow: { END: "idle", CANCEL: "idle", SWING: "windup" },
});

const S = Math.SQRT1_2;
const ATTACK_RADIUS = 1.3, ATTACK_ARC = Math.PI * 110 / 180;
const BASH_RADIUS = 1.6, BASH_ARC = Math.PI / 2, BASH_CD = 7;
const DODGE_TIME = 0.2, DODGE_DIST = 2, DODGE_RECOVER = 0.15;
const SWING_HIT_AT = 0.3;          // fraction of the swing at which damage lands
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function createPlayer(world, heroId = "hero-warrior") {
  const stats0 = world.stats || {};
  const asset = makeAsset(heroId);
  const group = new THREE.Group(); group.name = "player";
  const body = new THREE.Group();            // animated child: lunge / tilt / squash
  body.add(asset.group);
  group.add(body);
  world.add(group);

  // Effects that live in world space (follow the player's logical yaw, not the smoothed visual yaw).
  const fxRoot = new THREE.Group(); fxRoot.name = "player-fx";
  const slashGeo = makeSectorGeometry(ATTACK_RADIUS, 0.7, 10);
  const slashMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const slash = new THREE.Mesh(slashGeo, slashMat); slash.position.y = 0.3; slash.visible = false;
  const bashGeo = makeSectorGeometry(BASH_RADIUS, BASH_ARC, 16);
  const bashMat = new THREE.MeshBasicMaterial({ color: COLORS.magic, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const bash = new THREE.Mesh(bashGeo, bashMat); bash.position.y = 0.25; bash.visible = false;
  fxRoot.add(slash, bash);
  world.add(fxRoot);

  // Materials that go translucent while dodging (restyle() gave the hero its own clones).
  const bodyMats = [];
  asset.group.traverse((o) => { if (o.isMesh && o.name !== "shadow") (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => bodyMats.push(m)); });
  const setGhost = (on) => {
    for (const m of bodyMats) { m.transparent = on; m.opacity = on ? 0.35 : 1; m.needsUpdate = true; }
  };

  const maxHp = stats0.maxHp || 100;
  const player = {
    x: 0, z: 0, yaw: 0, hp: maxHp, maxHp, radius: 0.3, group, invuln: 0, dodgeCd: 0, skillCd: 0, shield: 0, dead: false, name: "You",
    // extras (see exports): read-only for other modules
    get dodging() { return act.is("dodge"); }, slowMul: 1, skillMax: BASH_CD, dodgeMax: stats0.dodgeCooldown || 0.8,
    update, dispose, heal,
  };

  let visYaw = 0, atkCd = 0;
  // the body goes translucent exactly while the state is "dodge"
  const act = createMachine(PLAYER_FLOW, "free", (next, prev) => { if ((next === "dodge") !== (prev === "dodge")) setGhost(next === "dodge"); });
  const swing = createMachine(SWING_FLOW, "idle");
  let swingT = 0, swingDur = 0.2, swingYaw = 0, swingDir = 1; // swingT: 0..1 through the swing
  const pose = { move: 0, act: "idle", k: 0 }; let walk = 0;
  let left = 0, dodgeX = 0, dodgeZ = 1;                        // left: seconds left in "dodge" / "recover"
  let lungeT = 0, bashT = -1, deadT = 0, stepT = 0, wasHurtBlink = false;
  let lastMaxHp = maxHp;

  function heal(amount) {
    if (player.dead) return;
    const a = Math.min(amount, player.maxHp - player.hp);
    if (a <= 0) return;
    player.hp += a;
    world.events.emit("player:heal", { amount: a });
    if (world.fx) world.fx.number(player.x, 1.3, player.z, "+" + Math.round(a), COLORS.heal);
  }

  function doSwing(st) {
    swingDur = Math.min(0.24, 0.85 / Math.max(0.5, st.attackRate || 2.2));
    swing.send("SWING"); swingT = 0; swingYaw = player.yaw; swingDir = -swingDir;
    atkCd = 1 / (st.attackRate || 2.2);
    if (world.audio) world.audio.play("swing");
  }

  function resolveSwing(st) {
    const dmg = st.damage || 10;
    for (const e of world.enemies) {
      if (e.dead || !inCone(e.x, e.z, player.x, player.z, swingYaw, ATTACK_RADIUS, ATTACK_ARC, e.radius || 0.3)) continue;
      const crit = world.rng() < (st.critChance || 0);
      damageEnemy(world, e, crit ? dmg * (st.critMult || 1.5) : dmg, { crit });
    }
  }

  function doBash(st) {
    player.skillCd = BASH_CD;
    bashT = 0; lungeT = 0.2;
    const yaw = player.yaw;
    world.shake(0.12);
    if (world.audio) world.audio.play("slam");
    for (const e of world.enemies) {
      if (e.dead || !inCone(e.x, e.z, player.x, player.z, yaw, BASH_RADIUS, BASH_ARC, e.radius || 0.3)) continue;
      damageEnemy(world, e, (st.damage || 10) * 1.5, { heavy: true });
      applyStatus(world, e, { stun: 1 });
      if (!e.dead) { e.x += Math.sin(yaw) * 0.35; e.z += Math.cos(yaw) * 0.35; resolveCollision(world, e, e.radius || 0.3); }
    }
    for (const pr of world.projectiles) {
      if (pr.dead || !pr.hostile || !inCone(pr.x, pr.z, player.x, player.z, yaw, BASH_RADIUS, BASH_ARC, pr.radius || 0.2)) continue;
      if (pr.kill) pr.kill(world, true); else pr.dead = true;
      if (world.fx) world.fx.burst(pr.x, pr.y || 0.7, pr.z, COLORS.magic, 8, 3);
    }
  }

  function update(w, dt, input) {
    const st = w.stats || stats0;
    if (player.dead) { act.send("DIE"); asset.update(w.time); animateDeath(dt); return; }

    // keep max hp in step with stats (items); gaining max hp also heals that amount
    if (st.maxHp && st.maxHp !== lastMaxHp) {
      if (st.maxHp > lastMaxHp) player.hp += st.maxHp - lastMaxHp;
      player.maxHp = st.maxHp; lastMaxHp = st.maxHp; player.hp = Math.min(player.hp, player.maxHp);
    }
    player.dodgeMax = st.dodgeCooldown || 0.8;

    // timers
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
    if (player.dodgeCd > 0) player.dodgeCd = Math.max(0, player.dodgeCd - dt);
    if (player.skillCd > 0) player.skillCd = Math.max(0, player.skillCd - dt);
    if (atkCd > 0) atkCd -= dt;
    const slow = player.slowMul; player.slowMul = 1; // hazards re-apply it each frame while active

    // intent
    const mx = input.move ? input.move.x : 0, my = input.move ? input.move.y : 0;
    const moving = mx * mx + my * my > 0.0004;
    const wmx = (mx * S - my * S), wmz = (-mx * S - my * S); // = screenToWorld, without allocating
    const ax = input.aim ? input.aim.x : 0, ay = input.aim ? input.aim.y : 0;
    const aiming = !!input.aim && ax * ax + ay * ay > 0.0004;

    const busy = !act.is("free");

    // facing: aim if given, else movement. Locked while dodging.
    if (!busy) {
      if (aiming) player.yaw = yawOf(ax * S - ay * S, -ax * S - ay * S);
      else if (moving) player.yaw = yawOf(wmx, wmz);
    }

    // dodge
    if (input.dodge && !busy && player.dodgeCd <= 0) {
      let dx = moving ? wmx : Math.sin(player.yaw), dz = moving ? wmz : Math.cos(player.yaw);
      const l = Math.hypot(dx, dz); dodgeX = dx / l; dodgeZ = dz / l; // l never 0: stick past dead zone, or sin/cos of yaw
      act.send("DODGE"); left = DODGE_TIME;
      player.invuln = Math.max(player.invuln, DODGE_TIME);
      player.dodgeCd = st.dodgeCooldown || 0.8;
      swing.send("CANCEL");
      if (w.audio) w.audio.play("dodge");
      if (w.fx) w.fx.burst(player.x, 0.1, player.z, 0xa893b8, 8, 2);
    }

    if (act.is("dodge")) {
      const step = Math.min(dt, left);
      const k = DODGE_DIST / DODGE_TIME * step;
      player.x += dodgeX * k; player.z += dodgeZ * k;
      resolveCollision(w, player, player.radius);
      left -= dt;
      if (w.fx && ((w.time * 60) | 0) % 3 === 0) w.fx.burst(player.x, 0.2, player.z, 0xa893b8, 1, 0.6);
      if (left <= 0) { act.send("LAND"); left = DODGE_RECOVER; }
    } else if (act.is("recover")) {
      left -= dt;
      if (left <= 0) act.send("READY");
    } else {
      // movement (slower while the swing is mid-air)
      if (moving) {
        const len = Math.min(1, Math.hypot(mx, my)), l = Math.hypot(wmx, wmz); // never 0: only used past the stick dead zone
        const sp = (st.moveSpeed || 4.2) * slow * (swing.is("idle") ? 1 : 0.8) * len / l;
        player.x += wmx * sp * dt; player.z += wmz * sp * dt;
        resolveCollision(w, player, player.radius);
        stepT -= dt;
        if (stepT <= 0 && w.fx) { stepT = 0.28; w.fx.burst(player.x, 0.05, player.z, 0x8a7a9a, 2, 0.8); }
      }
      // skill, then attack
      if (input.skill && player.skillCd <= 0) doBash(st);
      else if (input.attack && atkCd <= 0) doSwing(st);
    }

    // swing progress
    if (!swing.is("idle")) {
      swingT += dt / swingDur;
      if (swingT >= SWING_HIT_AT && swing.send("HIT")) resolveSwing(st);
      if (swingT >= 1) swing.send("END");
    }
    if (lungeT > 0) lungeT -= dt;

    // what the model plays: how fast it walks, and its act (the swing's "follow" is the model's "attack")
    walk += ((moving && act.is("free") ? Math.min(1, Math.hypot(mx, my)) : 0) - walk) * Math.min(1, dt * 14);
    pose.move = walk;
    pose.act = act.is("dodge") ? "dodge" : bashT >= 0 ? "bash" : swing.is("follow") ? "attack" : swing.state;
    pose.k = act.is("dodge") ? 1 : bashT >= 0 ? Math.sin(Math.min(1, bashT) * Math.PI) : swing.is("windup") ? swingT / SWING_HIT_AT : (swingT - SWING_HIT_AT) / (1 - SWING_HIT_AT);
    asset.update(w.time, pose);

    animate(dt, st);
  }

  function animate(dt, st) {
    // visual yaw eases toward logical yaw
    visYaw += angleDiff(player.yaw, visYaw) * (1 - Math.exp(-28 * dt));
    group.position.set(player.x, 0, player.z);
    group.rotation.y = visYaw;

    let lunge = 0, tilt = 0, roll = 0;
    if (!swing.is("idle")) {
      const u = swingT, e = Math.sin(Math.min(1, u * 1.4) * Math.PI); // quick out, settle back
      lunge = 0.16 * e; tilt = 0.28 * e; roll = swingDir * 0.35 * Math.sin(u * Math.PI);
      // slash wedge sweeps across the arc
      slash.visible = true;
      fxRoot.position.set(player.x, 0, player.z);
      fxRoot.rotation.y = swingYaw;
      slash.rotation.y = swingDir * (ATTACK_ARC / 2 - 0.35) * (1 - 2 * Math.min(1, u * 1.3));
      slashMat.opacity = 0.7 * Math.max(0, 1 - u) ;
    } else slash.visible = false;
    if (lungeT > 0) { lunge = Math.max(lunge, 0.3 * Math.sin(lungeT / 0.2 * Math.PI * 0.5 + 0.0)); tilt = Math.max(tilt, 0.2); }
    if (bashT >= 0) {
      bashT += dt / 0.28;
      if (bashT >= 1) { bashT = -1; bash.visible = false; }
      else {
        bash.visible = true;
        fxRoot.position.set(player.x, 0, player.z);
        if (swing.is("idle")) fxRoot.rotation.y = player.yaw;
        const s = 0.35 + 0.65 * Math.min(1, bashT * 2.5);
        bash.scale.set(s, 1, s); bash.rotation.y = 0;
        bashMat.opacity = 0.7 * (1 - bashT);
      }
    }
    body.position.z = lunge;
    body.rotation.x = tilt;
    body.rotation.z = roll;
    if (act.is("dodge")) body.scale.set(0.9, 0.85, 1.3);
    else body.scale.set(1, 1, 1);

    // hurt blink (not while dodging, which has its own look)
    const blink = player.invuln > 0 && !player.dodging && ((player.invuln * 20) | 0) % 2 === 0;
    if (blink !== wasHurtBlink) { asset.group.visible = !blink; wasHurtBlink = blink; }
  }

  function animateDeath(dt) {
    deadT += dt;
    const u = Math.min(1, deadT / 0.4);
    asset.group.visible = true;
    body.rotation.x = -u * 1.5; body.position.y = -u * 0.1; body.position.z = 0; body.rotation.z = 0; body.scale.set(1, 1, 1);
    slash.visible = false; bash.visible = false;
  }

  function dispose(w) {
    const ww = w || world;
    ww.remove(group); ww.remove(fxRoot);
    slashGeo.dispose(); slashMat.dispose(); bashGeo.dispose(); bashMat.dispose();
    const done = new Set(); // meshes can share a geometry or material: free each once
    const free = (r) => { if (!done.has(r)) { done.add(r); r.dispose(); } };
    asset.group.traverse((o) => {
      if (!o.isMesh) return;
      free(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(free);
    });
  }

  group.position.set(player.x, 0, player.z);
  return player;
}
