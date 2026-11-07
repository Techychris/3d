// Integrator: wires renderer, world, modules and the run state machine together.
import * as THREE from "three";
import { createRenderer } from "./engine/render.js";
import { createInput } from "./engine/input.js";
import { createAudio } from "./engine/audio.js";
import { createWorld, clearRoom, dist } from "./game/world.js";
import { createRng, dailySeed } from "./core/rng.js";
import { createPlayer } from "./game/player.js";
import { spawnProjectile } from "./game/combat.js";
import { createFx } from "./game/fx.js";
import { createEnemy, ENEMY_TYPES } from "./game/enemies.js";
import { createBoss, BOSS_TYPES } from "./game/bosses.js";
import { buildRoom, buildHub, FLOORS } from "./game/rooms.js";
import { ITEMS, computeStats, rollShrine, describeCard, tagCounts } from "./game/items.js";
import * as P from "./game/progress.js";
import { createUI } from "./ui/ui.js";
import { makeAsset } from "./engine/assets.js";

const ROOMS_PER_FLOOR = 4;          // combat rooms before each boss (v1 scope)
const FLOORS_PER_RUN = 3;
const BOSSES = { 1: "slime-king", 2: "stone-golem", 3: "necromancer" };
const BOSS_NAMES = { "slime-king": "Slime King", "stone-golem": "Stone Golem", "necromancer": "Necromancer" };
const REROLL_COST = 10, SKIP_REWARD = 6;

const app = document.getElementById("app");
const R = createRenderer(app);
const world = createWorld(R.scene);
world.camera = R.camera;
world.shake = (a) => { if (meta.settings.shake !== false) R.shake(a); };
let hitStopT = 0;
world.hitStop = (s) => { hitStopT = Math.max(hitStopT, s); };
const input = createInput(app);
const audio = createAudio();
world.audio = audio;
world.fx = createFx(world);
const ui = createUI(document.getElementById("ui"));
window.__game = { world, get state() { return state; }, get run() { return run; }, get meta() { return meta; } }; // test hook

let meta = P.loadMeta();
let run = null, room = null, state = "boot", cleared = false, exitLock = 0;
let runEmbers = 0, killerName = null, summons = [];
const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

// ---------------- settings ----------------
function applySettings() {
  const s = meta.settings;
  audio.setVolume("music", s.music ?? 0.6); audio.setVolume("sfx", s.sfx ?? 0.8);
  R.setBlurAllowed(s.blur !== false);
  if (s.quality && s.quality !== "auto") R.setPreset(s.quality);
}
applySettings();

// ---------------- helpers ----------------
function setStats() {
  world.stats = computeStats(run ? run.items : [], meta);
}
function hudUpdate() {
  if (!world.player) return;
  const p = world.player, boss = world.enemies.find(e => e.boss && !e.dead);
  ui.hud.update({
    hp: Math.max(0, Math.round(p.hp)), maxHp: Math.round(world.stats.maxHp), shield: Math.round(p.shield || 0),
    tags: tagCounts(run ? run.items : []), currency: meta.currency, floor: run ? run.floor : 0,
    room: run ? Math.min(run.room, ROOMS_PER_FLOOR) : 0, rooms: ROOMS_PER_FLOOR + 1,
    saved: savedFlash > 0, boss: boss ? { name: boss.name, hp: Math.max(0, boss.hp), maxHp: boss.maxHp } : null,
    skillCd: p.skillCd || 0, skillMax: 7, dodgeCd: p.dodgeCd || 0, dodgeMax: world.stats.dodgeCooldown,
  });
}
let savedFlash = 0;
function save() { if (run) { run.hp = world.player ? world.player.hp : run.hp; P.saveRun(run); } P.saveMeta(meta); savedFlash = 2.5; }

function disposeRoom() {
  clearRoom(world);
  summons.forEach(s => world.remove(s.group)); summons = [];
  if (room) { room.dispose(world); room = null; }
  world.fx.clear();
}

function spawnPlayer(pos) {
  if (world.player) { world.player.dispose(world); world.player = null; }
  world.player = createPlayer(world, run ? run.hero : "hero-warrior");
  world.player.x = pos.x; world.player.z = pos.z;
}

// ---------------- hub ----------------
function enterHub() {
  state = "hub"; disposeRoom(); run = P.loadRun();
  setStats();
  room = buildHub(world);
  R.addLampsFrom(room.group);
  spawnPlayer(room.playerStart);
  R.lookAt(0, 0);
  ui.hideAll(); ui.hud.show(false);
  audio.startMusic("hub");
  showHubPanel();
}
function showHubPanel() {
  ui.showHub(meta, {
    upgradeCost: P.upgradeCost(meta, "vigor"),
    resumable: !!P.loadRun(),
    onStart: () => startRun(null),
    onDaily: () => startRun(dailySeed(), true),
    onUpgrade: () => {
      const cost = P.upgradeCost(meta, "vigor");
      if (cost != null && meta.currency >= cost) { meta.currency -= cost; meta.upgrades.vigor = (meta.upgrades.vigor || 0) + 1; P.saveMeta(meta); audio.play("pickup"); ui.toast("Vigor raised: more max health"); }
      else ui.toast(cost == null ? "Vigor is maxed" : `Vigor needs ${cost} embers`);
      showHubPanel();
    },
    onCodex: () => ui.showCodex(ITEMS.map(it => ({ name: it.name, tags: it.tags, desc: it.desc, seen: meta.codex.includes(it.id) })), { onClose: showHubPanel }),
    onSettings: () => openSettings(showHubPanel),
  });
}

// ---------------- run ----------------
function startRun(seed, daily = false) {
  audio.unlock();
  const existing = P.loadRun();
  if (existing && !seed) run = existing;
  else { run = P.newRun(seed || `run-${Date.now()}`); run.daily = daily; meta.runsStarted = (meta.runsStarted || 0) + 1; }
  runEmbers = run.embers || 0; killerName = null;
  world.rng = createRng(`${run.seed}`);
  enterRoom();
}

function enterRoom() {
  disposeRoom();
  ui.hideAll(); ui.hud.show(true);
  setStats();
  const boss = run.room >= ROOMS_PER_FLOOR;
  world.rng = createRng(`${run.seed}:${run.floor}:${run.room}`);
  room = buildRoom(world, { floor: run.floor, index: run.room, boss, seed: `${run.seed}:${run.floor}:${run.room}` });
  R.addLampsFrom(room.group);
  spawnPlayer(room.playerStart);
  const p = world.player;
  p.maxHp = world.stats.maxHp;
  p.hp = run.hp == null ? p.maxHp : Math.min(run.hp, p.maxHp);
  p.shield = (world.stats.roomShield || 0) * p.maxHp;
  if (boss) {
    const id = BOSSES[run.floor];
    const bs = room.bossSpawn || { x: 0, z: -1.5 }; createBoss(world, room.bossId || id, bs.x, bs.z);
    audio.play("boss"); ui.toast(`${BOSS_NAMES[id]}`);
  } else {
    for (const s of room.spawns) createEnemy(world, s.type, s.x, s.z);
  }
  for (let i = 0; i < (world.stats.summons || 0); i++) summons.push(makeSummon(i));
  cleared = false; exitLock = 0.6;
  state = "run";
  R.lookAt(0, 0);
  audio.startMusic("combat");
  save();
}

function makeSummon(i) {
  const a = makeAsset("enemy-wisp");
  a.group.scale.setScalar(0.6);
  // friendly: recolour core to heal teal so it never reads as a threat
  a.group.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.name !== "shadow" && o.name !== "dropLine") { o.material.color.setHex(0x6fe0c0); o.material.emissive.setHex(0x6fe0c0); } });
  world.add(a.group);
  return { a, group: a.group, phase: i * Math.PI, cd: 1 + i };
}
function updateSummons(dt) {
  const p = world.player; if (!p) return;
  for (const s of summons) {
    s.phase += dt * 1.6;
    s.group.position.set(p.x + Math.cos(s.phase) * 0.9, 0, p.z + Math.sin(s.phase) * 0.9);
    s.a.update(world.time);
    s.cd -= dt;
    if (s.cd <= 0) {
      s.cd = 2;
      let best = null, bd = 6;
      for (const e of world.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - s.group.position.x, e.z - s.group.position.z); if (d < bd) { bd = d; best = e; } }
      if (best) {
        const dx = best.x - s.group.position.x, dz = best.z - s.group.position.z, l = Math.hypot(dx, dz) || 1;
        spawnProjectile(world, { x: s.group.position.x, z: s.group.position.z, y: 0.6, dirX: dx / l, dirZ: dz / l, speed: 7, damage: world.stats.damage * 0.6, radius: 0.18, kind: "orb", hostile: false, sourceName: "Wisp ally" });
      }
    }
  }
}

function onRoomClear() {
  cleared = true;
  world.events.emit("room:clear", {});
  room.exit.setOpen(true);
  audio.play("door");
  ui.toast(run.room >= ROOMS_PER_FLOOR ? "Boss defeated: the way down is open" : "Room clear: the portal is open");
}

function onExit() {
  run.hp = world.player.hp;
  const wasBoss = run.room >= ROOMS_PER_FLOOR;
  if (wasBoss) {
    if (run.floor >= FLOORS_PER_RUN) return endRun(true);
    run.floor += 1; run.room = 0;
    run.hp = Math.min(world.stats.maxHp, run.hp + world.stats.maxHp * 0.3); // breather between floors
    return enterRoom();
  }
  openShrine();
}

function openShrine(rerolled = false) {
  state = "shrine";
  const ids = rollShrine(world.rng, run.items, 3);
  const cards = ids.map(id => describeCard(id, run.items));
  ids.forEach(id => { if (!meta.codex.includes(id)) meta.codex.push(id); });
  ui.showShrine(cards, {
    rerollCost: REROLL_COST, canReroll: meta.currency >= REROLL_COST && !rerolled,
    onTake: (id) => {
      run.items.push(id);
      const it = ITEMS.find(i => i.id === id);
      world.events.emit("item:taken", { item: it });
      audio.play("pickup"); ui.toast(`${it.name} taken`);
      nextRoom();
    },
    onReroll: () => { if (meta.currency >= REROLL_COST && !rerolled) { meta.currency -= REROLL_COST; audio.play("coin"); openShrine(true); } },
    onSkip: () => { meta.currency += SKIP_REWARD; runEmbers += SKIP_REWARD; audio.play("coin"); nextRoom(); },
  });
}
function nextRoom() { run.room += 1; run.embers = runEmbers; enterRoom(); }

function endRun(won) {
  state = "recap";
  const p = world.player;
  const itemsLost = won ? [] : run.items.map(id => (ITEMS.find(i => i.id === id) || {}).name).filter(Boolean);
  const endingsNew = [];
  if (won) {
    meta.runsWon = (meta.runsWon || 0) + 1;
    for (const id of P.endingsEarned({ won: true, bossId: BOSSES[FLOORS_PER_RUN], hitsTaken: run.hitsTaken || 0, daily: !!run.daily })) {
      if (!meta.endings.includes(id)) { meta.endings.push(id); const e = P.ENDINGS.find(x => x.id === id); endingsNew.push(e ? e.name : id); }
    }
  }
  const type = Object.values(ENEMY_TYPES).find(t => t.name === killerName) || Object.values(BOSS_TYPES).find(t => t.name === killerName);
  const tip = type ? type.tip : (killerName ? "Watch the red ground marks: step out before the fill completes." : "");
  P.clearRun(); P.saveMeta(meta);
  audio.play(won ? "pickup" : "death"); audio.startMusic("hub");
  ui.hud.show(false);
  ui.showRecap({ won, killer: killerName, tip, floor: run.floor, room: run.room, itemsLost, currencyKept: runEmbers, endingsNew }, {
    onAgain: () => { run = null; startRun(null); },
    onHub: () => { run = null; enterHub(); },
  });
  run = null;
}

// ---------------- events ----------------
world.events.on("player:hit", ({ amount }) => { if (run && amount > 0) run.hitsTaken = (run.hitsTaken || 0) + 1; });
world.events.on("currency", ({ amount }) => { meta.currency += amount; runEmbers += amount; audio.play("coin"); });
world.events.on("player:death", ({ killer }) => { killerName = killer; if (state !== "run") return; state = "dying"; setTimeout(() => { if (state === "dying") endRun(false); }, 900); });

// ---------------- pause / settings ----------------
function pause() {
  if (state !== "run") return;
  state = "paused";
  ui.showPause({ onResume: resume, onSettings: () => openSettings(() => { state = "run"; pause(); }), onQuit: () => { save(); state = "hub"; enterHub(); } });
}
function resume() { ui.hideAll(); ui.hud.show(true); state = "run"; }
function openSettings(back) {
  ui.showSettings(meta.settings, {
    onChange: (k, v) => { meta.settings[k] = v; if (k === "quality" && v === "auto") autoQ.reset(); applySettings(); P.saveMeta(meta); },
    onCopyCode: () => P.encodeSave(meta, run || P.loadRun()),
    onLoadCode: (code) => {
      try { const d = P.decodeSave(code); meta = d.meta; P.saveMeta(meta); if (d.run) P.saveRun(d.run); else P.clearRun(); applySettings(); return { ok: true, message: "Save loaded" }; }
      catch (e) { return { ok: false, message: e.message || "That code doesn't match a save." }; }
    },
    onClose: back,
  });
}
ui.hud.onPause(() => (state === "paused" ? resume() : pause()));
document.addEventListener("visibilitychange", () => { if (document.hidden) { if (state === "run") pause(); save(); } });

// ---------------- quality auto-preset ----------------
const autoQ = {
  t: 0, frames: 0, done: false,
  reset() { this.t = 0; this.frames = 0; this.done = false; },
  tick(dt) {
    if (this.done || (meta.settings.quality && meta.settings.quality !== "auto")) return;
    this.t += dt; this.frames++;
    if (this.t >= 3) {
      const fps = this.frames / this.t;
      if (fps < 28 && R.preset !== "low") R.setPreset(R.preset === "high" ? "medium" : "low");
      else if (fps < 45 && R.preset === "high") R.setPreset("medium");
      this.t = 0; this.frames = 0;
      if (fps >= 45 || R.preset === "low") this.done = true;
    }
  },
};
if (isTouch && (!meta.settings.quality || meta.settings.quality === "auto")) R.setPreset("medium");

// ---------------- main loop ----------------
const timer = new THREE.Timer(); timer.connect(document);
// ---------------- test bot (?bot): steers the player so headless tests can play whole runs ----------------
const QS = new URLSearchParams(location.search);
const BOT = QS.has("bot"), GOD = QS.has("god");
let botT = 0;
function botDrive(st) {
  const p = world.player; if (!p || p.dead) return;
  if (GOD) p.hp = p.maxHp;
  botT += 1;
  let tx = 0, tz = 0, want = 1.1;
  const foe = world.enemies.filter(e => !e.dead).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (foe) { tx = foe.x; tz = foe.z; } else if (cleared && room) { tx = room.exit.x; tz = room.exit.z; want = 0; }
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
  const toScreen = (x, z) => { const sx = x - z, sy = -(x + z), n = Math.hypot(sx, sy) || 1; return { x: sx / n, y: sy / n }; };
  st.move = d > want ? toScreen(dx, dz) : { x: 0, y: 0 };
  // sidestep out of any telegraph the player stands in
  const inDanger = world.telegraphs.some(t => t.hostile !== false && Math.hypot(t.x - p.x, t.z - p.z) < (t.radius || t.length || 1.5));
  if (inDanger && botT % 40 === 0) st.dodge = true;
  if (foe) { st.aim = toScreen(dx, dz); st.attack = d < 2.2; st.skill = d < 1.6 && botT % 90 === 0; }
}

let acc = 0;
function frame() {
  timer.update();
  let dt = Math.min(timer.getDelta(), 0.05);
  const minFrame = 1 / R.maxFps; acc += dt; if (acc < minFrame * 0.95) return; dt = acc; acc = 0; dt = Math.min(dt, 0.05);
  input.update();
  if (BOT && state === "run") botDrive(input.state);
  if (input.pausePressed()) { if (state === "run") pause(); else if (state === "paused") resume(); }
  const portrait = isTouch && innerHeight > innerWidth;
  ui.showRotate(portrait);
  if (portrait && state === "run") pause();

  const simulate = state === "run" || state === "dying" || state === "hub";
  let sdt = dt;
  if (hitStopT > 0) { hitStopT -= dt; sdt = 0; }
  if (simulate && state !== "hub") {
    world.dt = sdt; world.time += sdt;
    const p = world.player;
    if (p && !p.dead) p.update(world, sdt, input.state);
    for (const list of [world.enemies, world.projectiles, world.telegraphs, world.hazards, world.pickups]) {
      for (const e of list) if (!e.dead) e.update(world, sdt);
      for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) { list[i].dispose(world); list.splice(i, 1); }
    }
    updateSummons(sdt);
    if (room) room.update(world, sdt);
    world.fx.update(world, sdt);
    if (state === "run") {
      if (!cleared && world.enemies.length === 0) onRoomClear();
      exitLock -= sdt;
      if (cleared && exitLock <= 0 && p && Math.hypot(p.x - room.exit.x, p.z - room.exit.z) < 0.9) onExit();
    }
    autoQ.tick(dt);
  } else if (state === "hub") {
    world.dt = dt; world.time += dt;
    if (room) room.update(world, dt);
    if (world.player) { world.player.group.rotation.y = Math.sin(world.time * 0.4) * 0.3 + 0.8; world.player.group.position.set(world.player.x, 0, world.player.z); }
  }
  savedFlash -= dt;
  hudUpdate();
  R.render(dt, world.player);
}

R.resize();
enterHub();
ui.showLoading(null);
R.renderer.setAnimationLoop(frame);
