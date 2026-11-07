# Dusk Isles: an isometric roguelite

Play: https://techychris.github.io/3d/

Browser game built with three.js r187. Fight through 3 floors of floating-island rooms, pick 1 of 3 blessings at each shrine, and beat the Slime King, Stone Golem and Necromancer.

**Controls**
- Desktop: WASD to move, mouse to aim, J or left click to attack, Space or L to dodge, K for skill, Esc to pause.
- Phone: play in landscape, with an on-screen stick and buttons.

This branch holds the built site at the root (`index.html` and `game.js`). The source is in `source/`. To rebuild, run `cd source && npm i three@0.187.0 esbuild && npm run build`, then copy `dist/game.js` here.
