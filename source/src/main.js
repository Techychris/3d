// Integrator: wires renderer, world, modules and the run state machine together.
import * as THREE from "three";
import { createRenderer } from "./engine/render.js";
import { createInput } from "./engine/input.js";
import { createBackdrop } from "./engine/backdrop.js";
import { createAudio } from "./engine/audio.js";
import { createWorld, clearRoom, dist } from "./game/world.js";
import { createRng, dailySeed } from "./core/rng.js";
import { createMachine } from "./core/fsm.js";
import { CLASSES, CLASS_IDS, classOf } from "./game/classes.js";
import { GAME_FLOW, ROOM_FLOW } from "./game/flow.js";
import { createPlayer } from "./game/player.js";
import { spawnProjectile, damageEnemy } from "./game/combat.js";
import * as GEAR from "./game/gear.js";
import { createFx } from "./game/fx.js";
import { createEnemy, ENEMY_TYPES } from "./game/enemies.js";
import { createBoss, BOSS_TYPES, bossOrder } from "./game/bosses.js";
import { buildRoom, buildHub, FLOORS } from "./game/rooms.js";
import { exitChoices, ROOM_TYPES } from "./game/route.js";
import { ITEMS, computeStats, rollShrine, describeCard, tagCounts } from "./game/items.js";
import * as P from "./game/progress.js";
import { createUI } from "./ui/ui.js";
import { makeAsset } from "./engine/assets.js";

const ROOMS_PER_FLOOR = 4;          // combat rooms before each boss (v1 scope)
const FLOORS_PER_RUN = 3;
const REROLL_COST = 10, SKIP_REWARD = 6;

const app = document.getElementById("app");
const R = createRenderer(app);
const backdrop = createBackdrop(R.scene, R.camera);
backdrop.setQuality(R.preset);
const setPreset = (q) => { R.setPreset(q); backdrop.setQuality(q); };
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
window.__game = { world, get state() { return flow.state; }, get run() { return run; }, get meta() { return meta; }, get room() { return room; } }; // test hook

let meta = P.loadMeta();
// The game's top-level machine: every screen the game can be on and every way to move between them.
// Nothing assigns the state; code asks for a move with flow.send(EVENT), which refuses moves that are not listed.
const flow = createMachine(GAME_FLOW, "boot");
// For moves the game makes itself: an illegal one is a bug, so fail loudly. (Moves asked for by a button use
// flow.send as a guard instead, so a stale or doubled click is ignored.)
function go(ev) { if (!flow.send(ev)) throw new Error(`flow: ${ev} is not legal in "${flow.state}"`); }
// Each room gets a fresh ROOM_FLOW machine: "fight" until no foes are left, then "clear".
const EXIT_LOCK = 0.6, DEATH_TIME = 0.9;
let roomFlow = createMachine(ROOM_FLOW, "fight"), roomAge = 0;
const inBossRoom = () => run.room >= ROOMS_PER_FLOOR;
let run = null, room = null, hinted = -1;
let runEmbers = 0, killerName = null, summons = [];
const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

// ---------------- settings ----------------
const QS_Q = ((q) => (q === "low" || q === "medium" || q === "high" ? q : null))(new URLSearchParams(location.search).get("q"));
function applySettings() {
  const s = meta.settings;
  audio.setVolume("music", s.music ?? 0.6); audio.setVolume("sfx", s.sfx ?? 0.8);
  R.setBlurAllowed(s.blur !== false);
  if (s.quality && s.quality !== "auto") setPreset(s.quality);
  if (QS_Q) setPreset(QS_Q); // ?q=low|medium|high overrides (slow devices, headless tests)
}
applySettings();

// ---------------- helpers ----------------
// The class in play: the run's once a run exists, otherwise the one picked at camp.
const heroClass = () => classOf(run ? run.cls : meta.cls);
function setStats() {
  world.stats = computeStats(run ? run.items : [], meta, [heroClass().mods, ...(run ? GEAR.gearMods(run.inv) : [])]);
}
function hudUpdate() {
  if (!world.player) return;
  const p = world.player, boss = world.enemies.find(e => e.boss && !e.dead);
  ui.hud.update({
    hp: Math.max(0, Math.round(p.hp)), maxHp: Math.round(world.stats.maxHp), shield: Math.round(p.shield || 0),
    tags: tagCounts(run ? run.items : []), currency: meta.currency, floor: run ? run.floor : 0,
    room: run ? Math.min(run.room, ROOMS_PER_FLOOR) : 0, rooms: ROOMS_PER_FLOOR + 1,
    path: run ? (run.path || []).concat(inBossRoom() ? [] : [run.roomType || "combat"]) : null,
    exitCount: room && room.exits ? room.exits.length : 1, saved: savedFlash > 0, boss: boss ? { name: boss.name, hp: Math.max(0, boss.hp), maxHp: boss.maxHp } : null,
    potions: run ? run.inv.potions : 0, bombs: run ? run.inv.bombs : 0,
    skillCd: p.skillCd || 0, skillMax: p.skillMax || 7, dodgeCd: p.dodgeCd || 0, dodgeMax: p.dodgeMax || world.stats.dodgeCooldown,
    map: world.player ? { grid: world.grid, bounds: world.bounds, px: world.player.x, pz: world.player.z, exits: room && flow.is("run") && !world.enemies.some(e => !e.dead) ? (room.exits || []) : [], foes: world.enemies.filter(e => !e.dead) } : null,
    foes: flow.is("run", "dying") ? world.enemies.filter(e => !e.dead).length : null, touch: input.isTouchVisible ? input.isTouchVisible() : false,
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
  world.player = createPlayer(world, heroClass().hero, heroClass());
  world.player.x = pos.x; world.player.z = pos.z;
}

// ---------------- hub ----------------
function enterHub() {
  if (!flow.send("HUB")) return;
  disposeRoom(); run = P.loadRun();
  setStats();
  room = buildHub(world);
  R.addLampsFrom(room.group);
  spawnPlayer(room.playerStart);
  R.setRoomFrame(world.bounds); backdrop.setTheme("hub");
  ui.hideAll(); ui.hud.show(false);
  audio.startMusic("hub");
  showHubPanel();
}
function showHubPanel() {
  ui.showHub(meta, {
    upgradeCost: P.upgradeCost(meta, "vigor"),
    resumable: !!P.loadRun(),
    classes: CLASS_IDS.map(id => CLASSES[id]), classId: heroClass().id,
    onClass: (id) => { if (run) return; meta.cls = id; P.saveMeta(meta); setStats(); spawnPlayer(room.playerStart); audio.play("pickup"); showHubPanel(); },
    onNew: () => { P.clearRun(); run = null; setStats(); spawnPlayer(room.playerStart); ui.toast("Saved run dropped. Pick a class and start fresh."); showHubPanel(); },
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
  if (!flow.send("START")) return;
  audio.unlock();
  const existing = P.loadRun();
  if (existing && !seed) run = existing;
  else { run = P.newRun(seed || `run-${Date.now()}`, meta.cls); run.daily = daily; meta.runsStarted = (meta.runsStarted || 0) + 1; }
  runEmbers = run.embers || 0; killerName = null;
  world.rng = createRng(`${run.seed}`);
  enterRoom();
}

function enterRoom() {
  disposeRoom();
  ui.hideAll(); ui.hud.show(true);
  setStats();
  const boss = inBossRoom();
  const type = boss ? "boss" : (run.roomType || "combat");
  const exits = exitChoices(run.seed, run.floor, run.room, ROOMS_PER_FLOOR, type);
  world.rng = createRng(`${run.seed}:${run.floor}:${run.room}`);
  room = buildRoom(world, { floor: run.floor, index: run.room, boss, seed: `${run.seed}:${run.floor}:${run.room}:${type}`, exits, roomType: boss ? undefined : type });
  if (!room.exits) room.exits = [room.exit];
  R.addLampsFrom(room.group);
  R.setRoomFrame(room.cameraBounds || world.bounds);
  backdrop.setTheme(run.floor);
  spawnPlayer(room.playerStart);
  const p = world.player;
  p.maxHp = world.stats.maxHp;
  p.hp = run.hp == null ? p.maxHp : Math.min(run.hp, p.maxHp);
  p.shield = (world.stats.roomShield || 0) * p.maxHp;
  if (boss) {
    const id = bossOrder(run.seed)[run.floor - 1]; // three of the four bosses, in an order set by the seed
    const bs = room.bossSpawn || { x: 0, z: -1.5 }; createBoss(world, id, bs.x, bs.z, run.floor);
    audio.play("boss"); ui.toast(`${BOSS_TYPES[id].name}`);
  } else {
    for (const s of room.spawns) createEnemy(world, s.type, s.x, s.z);
    if (type === "rest") ui.toast(run.roomDone ? "Rest room: you have already rested here" : "Rest room: walk to the campfire to heal");
    else if (type === "elite") ui.toast("Elite room: tougher foes, better reward");
    else if (type === "treasure") ui.toast("Treasure room: clear the guards, then open the chest");
    if (run.roomDone && room.chest) room.chest.open(); // resumed after the chest was already taken
  }
  for (let i = 0; i < (world.stats.summons || 0); i++) summons.push(makeSummon(i));
  roomFlow = createMachine(ROOM_FLOW, "fight"); roomAge = 0; hinted = -1; sealedHint = false;
  audio.startMusic(type === "rest" ? "hub" : "combat");
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
  world.events.emit("room:clear", {});
  for (const e of room.exits) e.setOpen(true);
  audio.play("door");
  const type = inBossRoom() ? "boss" : run.roomType;
  if (type === "elite") world.events.emit("currency", { amount: 20 });
  const loot = type === "elite" || type === "boss";
  if (loot) { if (type === "boss") GEAR.addConsumable(run.inv, "potions"); giveGear(type === "boss" ? 0.35 : 0.1); }
  else if (type === "rest") ui.toast(room.exits.length > 1 ? "Choose your path: walk into a portal" : "The portal is open");
  else ui.toast(type === "treasure" ? (run.roomDone ? "Room clear" : "Guards down: walk to the chest to open it") : room.exits.length > 1 ? "Room clear: choose a portal" : "Room clear: the portal is open");
}

function onExit(i) {
  run.hp = world.player.hp;
  if (inBossRoom()) {
    if (run.floor >= FLOORS_PER_RUN) return endRun(true);
    go("ADVANCE");
    run.floor += 1; run.room = 0; run.roomType = "combat"; run.path = []; run.roomDone = false;
    run.hp = Math.min(world.stats.maxHp, run.hp + world.stats.maxHp * 0.3); // breather between floors
    return enterRoom();
  }
  const chosen = room.exits[i] ? room.exits[i].type : "combat";
  run.path = (run.path || []).concat(run.roomType || "combat");
  const fromType = run.roomType;
  run.roomType = ROOM_TYPES[chosen] && chosen !== "boss" ? chosen : "combat";
  if (fromType === "rest") { go("ADVANCE"); return nextRoom(); }
  openShrine(false, fromType === "elite");
}

function openShrine(rerolled = false, freeReroll = false) {
  go(rerolled ? "REROLL" : "SHRINE");
  const ids = rollShrine(world.rng, run.items, 3);
  const cards = ids.map(id => describeCard(id, run.items));
  ids.forEach(id => { if (!meta.codex.includes(id)) meta.codex.push(id); });
  ui.showShrine(cards, {
    rerollCost: freeReroll ? 0 : REROLL_COST, canReroll: !rerolled && (freeReroll || meta.currency >= REROLL_COST),
    onTake: (id) => {
      if (!flow.send("CHOSEN")) return;
      run.items.push(id);
      const it = ITEMS.find(i => i.id === id);
      world.events.emit("item:taken", { item: it });
      audio.play("pickup"); ui.toast(`${it.name} taken`);
      nextRoom();
    },
    onReroll: () => { if (rerolled) return; if (freeReroll) { audio.play("coin"); return openShrine(true); } if (meta.currency >= REROLL_COST) { meta.currency -= REROLL_COST; audio.play("coin"); openShrine(true); } },
    onSkip: () => { if (!flow.send("CHOSEN")) return; meta.currency += SKIP_REWARD; runEmbers += SKIP_REWARD; audio.play("coin"); nextRoom(); },
  });
}
function nextRoom() { run.room += 1; run.embers = runEmbers; run.roomDone = false; enterRoom(); }

// Treasure chests and rest campfires are used by walking up to them, once per room.
let sealedHint = false;
function useRoomFeature(p) {
  if (run.roomDone) return;
  const chest = room.roomType === "treasure", f = chest ? room.chest : room.roomType === "rest" ? room.campfire : null;
  if (!f || Math.hypot(p.x - f.x, p.z - f.z) > 1.5) return;
  if (chest && !roomFlow.is("clear")) {
    if (!sealedHint) { sealedHint = true; ui.toast("The chest is sealed: clear the guards first"); }
    return;
  }
  if (chest) {
    room.chest.open();
    world.events.emit("currency", { amount: 30 });
    world.fx.burst(f.x, 0.8, f.z, 0xf0b860, 24, 1.6);
    GEAR.addConsumable(run.inv, "potions");
    giveGear(0.25); // the toast names the piece; the chest also holds 30 embers and a potion
  } else {
    const heal = Math.round(Math.min(p.maxHp * 0.35, p.maxHp - p.hp));
    p.hp += heal;
    world.events.emit("player:heal", { amount: heal });
    world.fx.burst(p.x, 0.6, p.z, 0x6fe0c0, 18, 1.2);
    audio.play("pickup");
    ui.toast(heal > 0 ? `You rest by the fire: +${heal} health` : "You rest by the fire. Already at full health");
  }
  run.roomDone = true; save();
}

function endRun(won) {
  go(won ? "WIN" : "LOSE");
  const p = world.player;
  const itemsLost = won ? [] : run.items.map(id => (ITEMS.find(i => i.id === id) || {}).name).filter(Boolean);
  const endingsNew = [];
  if (won) {
    meta.runsWon = (meta.runsWon || 0) + 1;
    for (const id of P.endingsEarned({ won: true, hitsTaken: run.hitsTaken || 0, daily: !!run.daily })) {
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
world.events.on("player:hit", ({ amount }) => { if (run && amount > 0) { run.hitsTaken = (run.hitsTaken || 0) + 1; ui.hud.hurt(Math.min(1, amount / 20)); } });
world.events.on("currency", ({ amount }) => { meta.currency += amount; runEmbers += amount; audio.play("coin"); });
world.events.on("player:death", ({ killer }) => { killerName = killer; flow.send("DIE"); }); // frame() ends the run after DEATH_TIME

// ---------------- pause / settings ----------------
function pause() { if (flow.send("PAUSE")) showPausePanel(); }
function showPausePanel() {
  ui.showPause({ onResume: resume, onInventory: showInventoryPanel, onSettings: () => openSettings(showPausePanel), onQuit: () => { if (flow.is("paused")) { save(); enterHub(); } } });
}
function resume() { if (flow.send("RESUME")) { ui.hideAll(); ui.hud.show(true); } }

// ---------------- inventory: gear and consumables ----------------
// The inventory screen is shown while "paused" (opening it from play pauses the game).
function openInventory() { if (flow.is("run")) flow.send("PAUSE"); if (flow.is("paused")) showInventoryPanel(); }
function showInventoryPanel() {
  const inv = run.inv, s = world.stats, view = (k) => { const g = GEAR.gearInfo(k); return g && { name: g.name, rarity: g.rarity, effect: g.effect }; };
  const changed = (ok) => { if (!ok) return ui.toast("Your bag is full"); setStats(); world.player.syncMaxHp(world.stats.maxHp); audio.play("pickup"); save(); showInventoryPanel(); };
  ui.showInventory({
    equip: GEAR.SLOTS.map(slot => ({ slot, slotName: GEAR.SLOT_NAMES[slot], item: view(inv.equip[slot]) })),
    bag: inv.bag.map(view), bagSize: GEAR.BAG_SIZE,
    consumables: Object.entries(GEAR.CONSUMABLES).map(([k, c]) => ({ ...c, count: inv[k] })),
    stats: [["Class", heroClass().name], ["Max health", String(Math.round(s.maxHp))], ["Damage", String(Math.round(s.damage))], ["Attacks per second", s.attackRate.toFixed(1)],
      ["Move speed", s.moveSpeed.toFixed(1)], ["Crit chance", Math.round(s.critChance * 100) + "%"]],
  }, {
    onEquip: (i) => changed(GEAR.equip(inv, i)), onUnequip: (slot) => changed(GEAR.unequip(inv, slot)), onDrop: (i) => changed(GEAR.dropGear(inv, i)),
    onClose: resume,
  });
}
// Drops go straight into the bag; with a full bag the piece is scrapped for embers.
function giveGear(bonus) {
  const g = GEAR.gearInfo(GEAR.rollGear(world.rng, run.floor, bonus));
  if (GEAR.addGear(run.inv, g.key)) ui.toast(`Found ${g.name} (${g.effect}). Open your bag to equip it`);
  else { world.events.emit("currency", { amount: GEAR.SCRAP_EMBERS }); ui.toast(`Bag full: ${g.name} scrapped for ${GEAR.SCRAP_EMBERS} embers`); }
}
function giveConsumable(kind) { if (GEAR.addConsumable(run.inv, kind)) ui.toast(`Picked up a ${GEAR.CONSUMABLES[kind].name.toLowerCase()}`); }
function useItem(kind) {
  const p = world.player;
  if (!flow.is("run") || !p || p.dead || run.inv[kind] < 1) return;
  if (kind === "potions") {
    if (p.hp >= p.maxHp) return ui.toast("Already at full health");
    p.heal(p.maxHp * GEAR.POTION_HEAL);
    world.fx.burst(p.x, 0.6, p.z, 0x6fe0c0, 18, 1.4);
  } else {
    for (const e of world.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) <= GEAR.BOMB_RADIUS + e.radius) damageEnemy(world, e, GEAR.BOMB_DAMAGE, { heavy: true });
    world.fx.burst(p.x, 0.5, p.z, 0xffb060, 60, 7); world.shake(0.35); audio.play("slam");
  }
  run.inv[kind] -= 1; audio.play("pickup"); save();
}
ui.hud.onUse(useItem); ui.hud.onBag(openInventory);
addEventListener("keydown", (e) => {
  if (e.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === "q") useItem("potions"); else if (k === "e") useItem("bombs"); else if (k === "i" || k === "tab") { e.preventDefault(); if (flow.is("paused")) resume(); else openInventory(); }
});
// Ordinary foes sometimes drop a consumable.
world.events.on("enemy:death", ({ enemy }) => {
  if (!run || enemy.boss) return;
  const r = Math.random();
  if (r < 0.07) giveConsumable("potions"); else if (r < 0.11) giveConsumable("bombs");
});
const togglePause = () => (flow.is("paused") ? resume() : pause());
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
ui.hud.onPause(togglePause);
document.addEventListener("visibilitychange", () => { if (document.hidden) { pause(); save(); } });

// ---------------- quality auto-preset ----------------
const autoQ = {
  t: 0, frames: 0, done: false,
  reset() { this.t = 0; this.frames = 0; this.done = false; },
  tick(dt) {
    if (this.done || QS_Q || (meta.settings.quality && meta.settings.quality !== "auto")) return;
    this.t += dt; this.frames++;
    if (this.t >= 3) {
      const fps = this.frames / this.t;
      if (fps < 28 && R.preset !== "low") setPreset(R.preset === "high" ? "medium" : "low");
      else if (fps < 45 && R.preset === "high") setPreset("medium");
      this.t = 0; this.frames = 0;
      if (fps >= 45 || R.preset === "low") this.done = true;
    }
  },
};
if (isTouch && (!meta.settings.quality || meta.settings.quality === "auto")) setPreset("medium");

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
  if (foe) { tx = foe.x; tz = foe.z; } else if (roomFlow.is("clear") && room) { tx = room.exit.x; tz = room.exit.z; want = 0; }
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
  const toScreen = (x, z) => { const sx = x - z, sy = -(x + z), n = Math.hypot(sx, sy) || 1; return { x: sx / n, y: sy / n }; };
  // walk the grid around pits, stubs and props: steer at the next cell of a breadth-first path
  const way = botWaypoint(p.x, p.z, tx, tz);
  st.move = d > want ? toScreen(way.x - p.x, way.z - p.z) : { x: 0, y: 0 };
  const inDanger = world.telegraphs.some(t => t.hostile !== false && Math.hypot(t.x - p.x, t.z - p.z) < (t.radius || t.length || 1.5));
  if (inDanger && botT % 40 === 0) st.dodge = true;
  if (foe) { st.aim = toScreen(dx, dz); st.attack = d < 2.2; st.skill = d < 1.6 && botT % 90 === 0; }
}
function botWaypoint(px, pz, tx, tz) {
  const g = world.grid; if (!g) return { x: tx, z: tz };
  const W = g.w, H = g.h, cell = (x, z) => [Math.floor(x - g.x0), Math.floor(z - g.z0)];
  const blocked = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!g.walk[j * W + i]) { blocked[j * W + i] = 1; continue; }
    const cx = g.x0 + i + 0.5, cz = g.z0 + j + 0.5;
    for (const o of world.obstacles) if (Math.hypot(cx - o.x, cz - o.z) < o.r + 0.35) { blocked[j * W + i] = 1; break; }
  }
  const [si, sj] = cell(px, pz), [ti, tj] = cell(tx, tz);
  if (si < 0 || sj < 0 || si >= W || sj >= H || ti < 0 || tj < 0 || ti >= W || tj >= H) return { x: tx, z: tz };
  const prev = new Int32Array(W * H).fill(-2), q = [tj * W + ti];
  prev[tj * W + ti] = -1; blocked[sj * W + si] = 0; blocked[tj * W + ti] = 0;
  while (q.length) { // search from the target so prev[] at the start points one step toward it
    const c = q.shift(), ci = c % W, cj = (c / W) | 0;
    if (c === sj * W + si) break;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + a, nj = cj + b, n = nj * W + ni;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H || blocked[n] || prev[n] !== -2) continue;
      prev[n] = c; q.push(n);
    }
  }
  const nx = prev[sj * W + si];
  if (nx < 0) return { x: tx, z: tz };
  return { x: g.x0 + (nx % W) + 0.5, z: g.z0 + ((nx / W) | 0) + 0.5 };
}

let acc = 0;
function frame() {
  timer.update();
  let dt = Math.min(timer.getDelta(), 0.05);
  const minFrame = 1 / R.maxFps; acc += dt; if (acc < minFrame * 0.95) return; dt = acc; acc = 0; dt = Math.min(dt, 0.05);
  input.update();
  flow.tick(dt);
  if (BOT && flow.is("run")) botDrive(input.state);
  if (input.pausePressed()) togglePause();
  const portrait = isTouch && innerHeight > innerWidth;
  ui.showRotate(portrait);
  if (portrait) pause();

  let sdt = dt;
  if (hitStopT > 0) { hitStopT -= dt; sdt = 0; }
  if (flow.is("run", "dying")) {
    world.dt = sdt; world.time += sdt;
    const p = world.player;
    if (p) p.update(world, sdt, input.state); // a dead player still updates: it plays its fall
    for (const list of [world.enemies, world.projectiles, world.telegraphs, world.hazards, world.pickups]) {
      for (const e of list) if (!e.dead) e.update(world, sdt);
      for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) { list[i].dispose(world); list.splice(i, 1); }
    }
    updateSummons(sdt);
    if (room) room.update(world, sdt);
    world.fx.update(world, sdt);
    if (flow.is("run")) {
      if (world.enemies.length === 0 && roomFlow.send("CLEAR")) onRoomClear();
      roomAge += sdt;
      if (p && !p.dead) useRoomFeature(p);
      if (roomFlow.is("clear") && p) {
        for (let i = 0; i < room.exits.length; i++) {
          const ex = room.exits[i], d = Math.hypot(p.x - ex.x, p.z - ex.z);
          if (roomAge >= EXIT_LOCK && d < 0.9) { onExit(i); break; }
          if (d < 2.4 && hinted !== i && room.exits.length > 1) { hinted = i; const T = ROOM_TYPES[ex.type]; if (T) ui.toast(`${T.label}: ${T.hint}`); }
        }
      }
    } else if (flow.time >= DEATH_TIME) endRun(false);
    autoQ.tick(dt);
  } else if (flow.is("hub")) {
    world.dt = dt; world.time += dt;
    if (room) room.update(world, dt);
    if (world.player) { world.player.group.rotation.y = Math.sin(world.time * 0.4) * 0.3 + 0.8; world.player.group.position.set(world.player.x, 0, world.player.z); }
  }
  savedFlash -= dt;
  hudUpdate();
  backdrop.update(dt, world.time, R.target.x, R.target.z);
  R.render(dt, world.player);
}

R.resize();
enterHub();
ui.showLoading(null);
R.renderer.setAnimationLoop(frame);
