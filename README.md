# Dusk Isles: an isometric roguelite

Play: https://techychris.github.io/3d/

Browser game built with three.js r187. Fight through 3 floors of floating-island rooms, pick 1 of 3 blessings at each shrine, and beat the Slime King, Stone Golem and Necromancer.

**Controls**
- Desktop: WASD to move, mouse to aim, J or left click to attack, Space or K to dodge, L to bash, Esc to pause.
- Phone: play in landscape, with an on-screen stick and buttons.

## What's in v1.1
- Procedurally generated rooms (seeded): irregular shapes, pits, props, hazards; every spawn and exit reachable.
- Branching route: after each room pick a Battle, Elite, Treasure or Rest portal.
- Immersive backdrop: animated cloud sea, distant floating islands, drifting motes, per-floor skies.
- HUD v2, effect lines on shrine cards, double-tap zoom blocked on phones.
- Add `?q=low` to the URL to force the low-quality preset on slow devices.

## Source and tests
This branch holds the built site at the root (`index.html`, `game.js`) and everything else in `source/`.

```
cd source
npm install
npm run build      # esbuild -> dist/game.js (copy it and index.html to the root to publish)
npm test           # 1,035 unit tests (node:test, jsdom)
npm run coverage   # fails below 100% lines, branches or functions; see tests/COVERAGE.txt
python3 tests/play.py god   # headless bot playthrough (needs playwright + Chrome)
```
Coverage covers every file in `src/` except `main.js` (the boot file), which the headless playthrough exercises.
