# Dusk Roguelite: module contract (v1)

Several people build modules of one game at the same time. Each person owns ONLY the files listed for their module. **Do not edit any other file** (create new files only inside your own folder or with your module prefix). If you need something another module provides, code against the interface below exactly as written; if an interface is missing something you need, add a clearly named export in YOUR file and note it in your reply.

Stack: three.js r187 (`import * as THREE from "three"`), plain ES modules, bundled by esbuild. No other libraries. No network, no external images or fonts (system fonts only). Build check for any file: `cd /home/claude/game && npx esbuild <file> --bundle --outfile=/tmp/<name>.js --log-level=error` must print nothing.

## three.js rules (r187; verified)
- Never `THREE.Clock`; time comes from `world.time` / `world.dt` (seconds).
- No allocation inside per-frame update loops: create vectors/objects once and reuse them.
- Dispose geometry and materials of anything you create when it is removed (`geometry.dispose()`, `material.dispose()`).
- Shadows use `PCFShadowMap` (set by the renderer, not you).
- Add-on imports (if any) from `three/addons/...`.

## Coordinates and camera
- 1 unit = one floor tile. y is up. Floor top is y = 0. Rooms are about 10 × 8 tiles: `world.bounds = {minX:-5,maxX:5,minZ:-4,maxZ:4}`.
- Fixed orthographic camera at (+x, +y, +z) looking at the origin (isometric, about 35° down). Screen-up on the screen = world direction (-1, 0, -1)/√2. Use `screenToWorld(sx, sy)` from `src/game/world.js`.
- Yaw: `yawOf(dx, dz) = atan2(dx, dz)`; 0 faces +z. Set `group.rotation.y = yaw`.

## Shared core (already written; read them, do not edit)
- `src/core/events.js`: `world.events.on(name, fn)` / `world.events.emit(name, payload)`.
- `src/core/rng.js`: `createRng(seed)` → `rng()` float in [0,1), `rng.int(lo,hi)`, `rng.pick(arr)`, `rng.shuffle(arr)`; `dailySeed()`. **Gameplay randomness must use `world.rng`, never `Math.random`** (cosmetic particles may use Math.random).
- `src/engine/assets.js`: `makeAsset(id)` → `{ group, meta, update(t) }` (dusk-restyled). Call `asset.update(world.time)` every frame for animated assets. `COLORS` = `{danger:0xff3d5a, ember:0xffb060, magic:0xa070ff, heal:0x6fe0c0, gold:0xf0b860, shadow:0x1a1030}`. `setEmissiveFlash(group, amount, hex)` for hit flashes (amount 0 restores). Asset ids: see `src/assets/*.js` (e.g. `hero-warrior`, `enemy-skeleton`, `boss-slime-king`, `tile-floor-moss`, `prop-campfire`, `vfx-portal`, `vfx-fireball`, `pickup-item-pedestal`). Assets' origin is their bottom centre; units are tiles.
- `src/game/world.js`: `createWorld(scene)`, `clearRoom(world)`, `screenToWorld`, `yawOf`, `resolveCollision(world, pos, r)`, `inCircle`, `inLine(px,pz,x,z,angle,length,width,pad)`, `inCone(px,pz,x,z,angle,r,arc,pad)`, `dist`, `clamp`.

## The world object
```
world = {
  THREE, scene, root, time, dt, paused, rng, events,
  bounds:{minX,maxX,minZ,maxZ}, obstacles:[{x,z,r}],
  player, enemies:[], projectiles:[], telegraphs:[], hazards:[], pickups:[],
  stats,            // derived player stats, see Items
  fx, audio, camera,
  shake(amount), hitStop(seconds),
  add(object3d), remove(object3d)
}
```
Every live thing in a list has `update(world, dt)` and `dispose(world)`, and a boolean `dead` (the owner of the list removes dead entries: main calls `update`, then filters `dead`, calling `dispose`).

## Events (names and payloads)
- `player:hit` `{amount, source}` · `player:death` `{killer}` (killer = display name, e.g. "Skeleton grunt") · `player:heal` `{amount}`
- `enemy:hit` `{enemy, amount, crit}` · `enemy:death` `{enemy}` · `boss:phase` `{boss, phase}` · `boss:death` `{boss}`
- `room:clear` `{}` (emitted by main) · `item:taken` `{item}` · `currency` `{amount}`

## Module A: player, combat and effects (`src/game/player.js`, `src/game/combat.js`, `src/game/fx.js`)
```
createPlayer(world, heroId = "hero-warrior") -> player
  player = { x, z, yaw, hp, maxHp, radius:0.3, group, invuln (s), dodgeCd (s), skillCd (s), shield, dead, name:"You",
             update(world, dt, input), dispose(world) }
  input = { move:{x,y} (screen space, length <= 1), aim:{x,y}|null (screen space dir), attack:bool (held), dodge:bool (pressed this frame), skill:bool (pressed this frame) }
```
- Move speed `world.stats.moveSpeed` tiles/s; screen-relative via `screenToWorld`. Collide with `resolveCollision`.
- **Attack**: melee arc in front (cone radius 1.3, arc 110°), rate `world.stats.attackRate` swings/s, damage `world.stats.damage`, crit chance `world.stats.critChance` × `critMult`. Uses `damageEnemy`. Faces aim if given, else move direction.
- **Dodge**: 0.2 s invulnerable, travels 2 tiles over 0.2 s, 0.15 s recovery, cooldown `world.stats.dodgeCooldown`. If `world.stats.shieldOnDodge` and an enemy telegraph is resolving on you during the dodge, refill shield.
- **Skill (warrior "Shield bash")**: cone 1.6 / 90°, damage 1.5× `stats.damage`, stuns 1 s, destroys hostile projectiles in the cone, cooldown 7 s.
- Shield absorbs damage before hp (`player.shield`, set to `stats.roomShield * maxHp` at each room start by main).
```
// combat.js
damageEnemy(world, enemy, amount, {crit=false, fromPlayer=true}={}) -> actual damage   // applies on-hit tag effects (burn, slow, freeze, bleed) from world.stats; emits enemy:hit / enemy:death; enemy.hp -= ...
damagePlayer(world, amount, sourceName) -> actual damage  // respects player.invuln and shield; emits player:hit, player:death
spawnTelegraph(world, {shape:"circle"|"line"|"cone", x, z, angle=0, radius=1, length=3, width=0.8, arc=Math.PI/2, windup=0.6, damage=10, sourceName, onResolve}) -> telegraph
   // danger-red outline + translucent fill that grows from 0 to full over `windup` seconds (ground, y≈0.03), plays world.audio.play("windup") at spawn;
   // on resolve: if player inside shape (pad = player.radius) and not invulnerable -> damagePlayer; calls onResolve(world, hitPlayer); then removes itself. Added to world.telegraphs.
spawnProjectile(world, {x, z, y=0.7, dirX, dirZ, speed=5, damage=8, radius=0.2, kind:"orb"|"arrow"|"fireball", hostile=true, range=12, sourceName}) -> projectile
   // hostile ones hit the player, friendly ones hit enemies. Every projectile has a blob shadow on the floor and a thin drop line (readability rule). Danger-red for hostile.
applyStatus(world, enemy, {burn, slow, freeze, bleed, stun})  // enemy.status = {burnT, burnDps, slowT, slowPct, frozenT, bleedT, bleedDps, stunT}; ticks in tickStatus
tickStatus(world, enemy, dt)  // call from enemy update; deals DoT via damageEnemy(...,{fromPlayer:false})
```
- Enemy fields used by combat: `{hp, maxHp, x, z, radius, group, name, dead, boss, status, speedMul}` (speedMul is 0 when frozen/stunned, 1 - slowPct when slowed; enemies multiply their speed by it).
```
// fx.js
createFx(world) -> fx = { burst(x, y, z, colorHex, count, speed), number(x, y, z, text, colorHex), flash(group, seconds), update(world, dt), clear() }
```
- `burst`: small cube particles (pooled, ≤200 alive). `number`: floating damage number as a sprite/canvas texture or small mesh; must be cheap. `flash`: uses setEmissiveFlash for a few frames.
- On enemy hit: flash + burst + `world.audio.play("hit")`, crit → bigger. Heavy hits call `world.shake(0.15)` and `world.hitStop(0.05)`; light hits `world.shake(0.06)` and `world.hitStop(0.033)`. Player hurt: `world.shake(0.2)`, `audio.play("hurt")`.

## Module B: enemies and bosses (`src/game/enemies.js`, `src/game/bosses.js`)
```
ENEMY_TYPES = { skeleton:{name:"Skeleton grunt", asset:"enemy-skeleton", hp, speed, radius, damage, tip, floors:[1,2]}, ... }
createEnemy(world, type, x, z) -> enemy   // pushes into world.enemies
createBoss(world, bossId, x, z) -> boss   // bossId: "slime-king" | "stone-golem" | "necromancer"; boss.boss = true; pushes into world.enemies
```
- Every enemy runs one shared state machine: `idle → aggro (aggro radius ~5 tiles) → windup (the tell) → attack → recover`. Every attack is a `spawnTelegraph` (≥ 0.3 s windup; bosses ≥ 0.6 s) or a `spawnProjectile` preceded by a ≥ 0.3 s visible windup (line telegraph along the shot with damage 0). **No attack without a visual tell.**
- Implement at least these 10 types with distinct behaviour: `skeleton` (melee arc), `slime` (hop, landing circle; splits into 2 small slimes on death), `rats` (asset enemy-rat-swarm; fast, small circle bites, low damage), `archer` (enemy-goblin-archer; keeps distance, line tell then arrow), `bat` (flying, dives along a line), `ghost` (fades out, reappears with a circle), `wisp` (orbs: danger-red projectiles), `brute` (slow, big circle slam), `spider` (drops from above: shadow circle first), `cultist` (circle under the player's position), plus `knight` (enemy-skeleton-knight; blocks frontal damage, charge line) and `mushroom` (spore circle that lingers 2 s) if time allows. Each type has `tip` (one sentence: how to beat it) used by the death recap.
- Floors: 1 Mossy ruins (skeleton, slime, rats, archer, bat), 2 Crypt (+ghost, spider, knight, brute), 3 Arcane spire (+wisp, cultist, mushroom, brute).
- Enemies face the player (`group.rotation.y = yawOf(...)`), keep their asset's idle `update(world.time)`, respect `speedMul`, collide with `resolveCollision`, avoid overlapping each other (simple separation).
- Bosses (2–3 phases, change at 66% / 33% hp, emit `boss:phase`): **Slime King** (hops with big landing circles; at 50% splits off 3 slimes), **Stone Golem** (fist slams = circles, then floor-crack lines in a fan), **Necromancer** (orbiting skull orbs, then summons 2 skeletons, then cone blasts). Boss hp ~ 300/450/600 at base damage 10. Every boss attack has ≥ 0.6 s telegraph.
- On death: `enemy:death` (combat emits it), drop currency via `world.events.emit("currency", {amount})` (regular 2–4, boss 25).

## Module C: items, progress and saves (`src/game/items.js`, `src/game/progress.js`) — pure logic, no three.js
```
TAGS = { fire:{name:"Fire", two:"…", three:"…"}, frost, bleed, crit, shield, speed, summon }
ITEMS = [ {id, name, tags:["fire"] | ["fire","crit"], desc, mods:{damage:+2, ...}} ... ]   // at least 28 items, every tag on ≥ 5 items
BASE_STATS = { maxHp:100, damage:10, attackRate:2.2, moveSpeed:4.2, critChance:0.05, critMult:1.5, dodgeCooldown:0.8 }
computeStats(itemIds, meta) -> stats   // base + item mods + tag bonuses + meta upgrades. stats also carries the tag effect numbers:
   // burnPct (Fire 2: 0.10 of hit per s, 3 s), burnSpread (Fire 3), slowPct (Frost 2: 0.2 for 2 s), freezeEvery (Frost 3: 4), bleedPct (Bleed 2: crits bleed 0.15 over 4 s), bleedAmp (Bleed 3: +0.15 dmg taken),
   // critChance += 0.10 (Crit 2), critMult += 0.5 (Crit 3), roomShield (Shield 2: 0.15), shieldOnDodge (Shield 3), moveSpeed ×1.1 (Speed 2), dodgeCooldown ×0.7 (Speed 3), summons (Summon 2: 1, Summon 3: 2)
tagCounts(itemIds) -> {fire:2, ...}
rollShrine(rng, ownedIds, n = 3) -> [itemId,...]   // no duplicates, avoid owned, weight items that complete a combo slightly higher
describeCard(itemId, ownedIds) -> { id, name, tags:[{id,name,owned:bool}], desc, pairsWith: "Ember Blade" | null, bonusNote: "Fire ×2: hits burn" | null }
```
```
// progress.js  (localStorage key "dusk-roguelite-v1"; wrap every storage call in try/catch; work without storage)
loadMeta() -> meta = { currency, upgrades:{vigor:0..2}, endings:[], codex:[itemIds seen], runsStarted, runsWon, settings:{ quality:"auto", shake:true, flashes:true, blur:true, music:0.6, sfx:0.8, screenRelative:true } }
saveMeta(meta) · loadRun() -> run|null · saveRun(run) · clearRun()
newRun(seed) -> run = { seed, floor:1, room:0, items:[], runCurrency:0, hp:null, hero:"hero-warrior", startedAt }
upgradeCost(meta, "vigor") -> number|null (null = maxed). Vigor: +5% max hp per level, max 2 levels (capped at +10%, per spec).
encodeSave(meta, run) -> string (base64 of JSON with a version and checksum) · decodeSave(code) -> {meta, run} | throws Error("That code doesn't match a save.")
ENDINGS = [{id:"spire", name:"Reached the spire's heart", how:"Beat the Necromancer"}, {id:"untouched", ...}, {id:"daily", ...}]  // 3 endings with simple unlock rules
```
- Write `tests/progress.test.mjs` and `tests/items.test.mjs` runnable with `node` (plain asserts) and make them pass.

## Module D: rooms and floors (`src/game/rooms.js`)
```
FLOORS = { 1:{name:"Mossy ruins", tiles:[...], props:[...], hazard:"water"|null}, 2:{name:"Crypt", hazard:"spikes"}, 3:{name:"Arcane spire", hazard:"embers"} }
buildRoom(world, {floor, index, boss=false, seed}) -> room = {
   group, playerStart:{x,z}, spawns:[{type, x, z}], exit:{x, z, open:false, group, setOpen(bool)}, update(world, dt), dispose(world) }
buildHub(world) -> room   // camp: campfire at centre, shop stall, weapon rack, cauldron, altar, portal to start a run; no enemies; exit = the portal (open)
waveFor(floor, index, rng) -> [{type, x, z}]   // 3–6 enemies on floor 1, growing; uses enemy type keys from Module B
```
- A room = a floating island slab 10 × 8 tiles (top at y=0), an earth edge below, floor tiles from the floor theme (instanced or merged: use `InstancedMesh` per tile type or merge static geometry per room, not 80 separate meshes), a back wall with torches, 2–4 obstacles (pillars/statues/barrels) registered in `world.obstacles` and set `world.bounds`. A few floating rocks around. Keep spawn points ≥ 3 tiles from `playerStart`.
- Exit: `vfx-portal` (or `tile-stairs-down` on boss rooms) at the far side; closed = dim and blocked by a violet seal; `setOpen(true)` when main says the room is clear. Main detects the player standing within 0.8 of the exit.
- Hazards (push into `world.hazards`, each `{update(world, dt), dispose(world), dead}`): floor 1 shallow water tiles slow the player 30% while inside (set `world.player.slowMul`), floor 2 spike traps (`tile-spike-trap`: warning glow ≥ 0.3 s, then spikes; 12 damage if the player stands on it), floor 3 ember cracks (`tile-floor-cracked`: 6 damage per second while standing on it). Use `damagePlayer` from `src/game/combat.js`.
- 3+ handmade layouts per floor (obstacle positions), picked by seed.

## Module E: UI (`src/ui/ui.js`, `src/ui/style.css`)
```
createUI(rootEl) -> ui = {
  hud: { show(bool), update({hp, maxHp, shield, tags:{fire:2,...}, currency, floor, room, rooms, saved:bool, boss:{name,hp,maxHp}|null, skillCd, skillMax, dodgeCd, dodgeMax}) },
  showHub(meta, {onStart, onDaily, onUpgrade, onCodex, onSettings, upgradeCost}),     // big Start run, Endings found X of 3, daily seed, Vigor upgrade (cost or "maxed"), codex, settings
  showShrine(cards, {onTake(id), onReroll(), onSkip(), rerollCost, canReroll}),      // 3 cards: name, tags (owned ones boxed + "owned"), desc, "Pairs with your X", bonus note; Take is primary; keyboard 1-3 + Enter
  showRecap({won, killer, tip, floor, room, itemsLost:[names], currencyKept, endingsNew:[names]}, {onAgain, onHub}),
  showPause({onResume, onSettings, onQuit}),
  showSettings(settings, {onChange(key, value), onCopyCode() -> string, onLoadCode(code) -> {ok, message}, onClose}),
  showCodex(entries:[{name, tags, desc, seen:bool}], {onClose}),
  showRotate(bool), showLoading(text|null), toast(text), hideAll()
}
```
- Dusk style: deep violet translucent panels, warm amber primary buttons, danger red only for damage/warnings, teal-green healing; system font stack; buttons ≥ 44 px; text contrast ≥ 4.5:1 (HUD text on a dark translucent plate); works at 390 px wide landscape phones and 1280 desktop. No emoji. Real `<button>` elements, focus styles, `aria-live` toast. HUD top-left health and shield, top-right currency + saved chip + pause button (44 px), bottom-left build tags chips, boss bar top-centre.
- The UI never touches three.js. It only calls handlers.

## Module F: input and audio (`src/engine/input.js`, `src/engine/audio.js`)
```
createInput(rootEl) -> input = { state:{move:{x,y}, aim, attack, dodge, skill}, update(), pausePressed():bool, setTouchVisible(bool), anyKey():bool, dispose() }
```
- Keyboard: WASD/arrows move (screen-relative), J or left mouse attack (held), Space or K dodge, L or right mouse skill, Esc/P pause. Mouse aim: direction from screen centre to cursor in screen space ({x: right, y: up}, normalised); keyboard-only → aim null (player faces move direction).
- Touch (pointer events, `touch-action:none`): left half = floating virtual stick (appears where the thumb lands, radius 60 px); right side buttons: Attack (76 px, hold), Dodge (56 px), Skill (56 px); pause button handled by UI. Multi-touch. Only shown on touch devices (`setTouchVisible`). Safe-area insets. Prevent page zoom/scroll gestures on the canvas.
- `dodge`/`skill` true for one frame per press; `attack` true while held. `update()` once per frame before the game reads `state`.
```
createAudio() -> audio = { play(name), setVolume(kind:"sfx"|"music", v), unlock(), startMusic(mode:"hub"|"combat"|"off"), muted }
```
- WebAudio synthesis only (no files): `hit`, `crit`, `hurt`, `windup` (rising tone, ~0.3 s), `slam`, `dodge`, `swing`, `pickup`, `coin`, `door`, `death`, `boss`, `ui`. Music: a soft generated pad/arpeggio loop for hub, a slightly faster layer for combat. Unlock on first user gesture. Mute when `document.hidden`.

## What main.js (owner: integrator) does
Creates renderer/scene/camera/post-effects/quality presets, the world, input, audio, UI, fx; runs `renderer.setAnimationLoop`; runs the state machine hub → rooms → shrine → boss → recap; autosaves at each room start; computes `world.stats` via `computeStats`; sets player.shield at room start; detects room clear and exit; handles pause and the portrait prompt.
