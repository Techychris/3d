# Dusk Isles: an isometric roguelite

Play: https://techychris.github.io/3d/

Browser game built with three.js r187. Fight through 3 floors of floating-island rooms, pick 1 of 3 blessings at each shrine, and beat the Slime King, Stone Golem and Necromancer.

**Controls**
- Desktop: WASD to move, mouse to aim, J or left click to attack, Space or K to dodge, L to bash, Esc to pause.
- Phone: play in landscape, with an on-screen stick and buttons.

## What's in v1.3
- Bridged islands: a room can now be 2 to 4 small islands joined by stone bridges (2 tiles wide), generated from the seed. See `screenshots/bridged-room-v1.3.png`.
- About 47% of combat rooms are bridged (chance 0.4, 0.5, 0.6 on floors 1, 2, 3). The first room of a run and boss rooms stay one island.
- Bridges never hold props, hazards, spawns or exits. The start and the exits sit on outer edges, so most rooms make you cross.
- Walls stand only on edges that face open sky, so they never hide a gap or a bridge.
- Known limit: walking enemies do not path across bridges. They wait on their island until you come to them; ranged enemies shoot across the gap.

## What's in v1.2.1
- Restored two things the v1.2 build had dropped: the frameless HUD with minimap, and room dressing (banners, battlements, glowing guide lines, waterfalls).
- State that moves through stages now lives in explicit tables (`source/src/core/fsm.js`): game flow, room, player, sword swing, enemies, bosses, telegraphs. See "State machines" in `source/CONTRACT.md`.
- The death pause runs on the game clock, and the hero now falls over when defeated.

## What's in v1.2
- 14 new props (74 assets in total): dusk tree, lantern post, crates, glowcap mushrooms, sarcophagus, burial urns, bone pile, crystal cluster, rune stone, telescope, well, banner, signpost, anvil. See `screenshots/new-props-v1.2.png`.
- Each floor now draws from 6 or 7 props instead of 3, so rooms repeat less: ruins get trees, lanterns, crates and mushrooms; the crypt gets sarcophagi, urns and bones; the spire gets crystals, rune stones, telescopes and bookshelves.
- The camp has a well, an anvil, two banners by the portal, a signpost, a lantern, a tree and crates.
- 3 new enemies, using models that were built but never spawned: Ruin scorpion (floors 1 and 2; circles, then stings along a short line), Fire imp (floors 2 and 3; one fireball straight at you and one wide), Hex totem (floor 3; never moves, pulses a circle around itself).
- Seeded rooms and waves differ from v1.1 for the same seed, because the prop and enemy pools grew.

## What's in v1.1
- Procedurally generated rooms (seeded): irregular shapes, pits, props, hazards; every spawn and exit reachable.
- Branching route: after each room pick a Battle, Elite, Treasure or Rest portal.
- Immersive backdrop: animated cloud sea, distant floating islands, drifting motes, per-floor skies.
- HUD v2, effect lines on shrine cards, double-tap zoom blocked on phones.
- Add `?q=low` to the URL to force the low-quality preset on slow devices.

## UI design system
The UI looks come from the Dusk Isles UI design system: `src/ui/design-system/tokens.css` and `components.css` are the same files the design system publishes; `src/ui/layout.css` only positions them over the game. Icons live in `src/ui/icons.js` (34 line icons, `currentColor`). `node tests/gate.cjs <url>` runs the component gate (contrast, 4px grid, radii, motion, focus, hover, keyboard) on the UI demo pages (`tests/ui-demo.html?s=hub|hud|shrine|recap|settings|codex|pause`).

## Source and tests
This branch holds the built site at the root (`index.html`, `game.js`) and everything else in `source/`.

```
cd source
npm install
npm run build      # esbuild -> dist/game.js (copy it and index.html to the root to publish)
npm test           # 1,105 unit tests (node:test, jsdom)
npm run coverage   # fails below 100% lines, branches or functions; see tests/COVERAGE.txt
python3 tests/play.py god   # headless bot playthrough (needs playwright + Chrome)
```
Coverage covers every file in `src/` except `main.js` (the boot file), which the headless playthrough exercises.
