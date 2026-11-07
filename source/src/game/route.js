// Per-floor branching route. Each cleared room offers portals to the next room; the player picks one.
// Deterministic from the run seed, so a saved run reloads with the same choices.
import { createRng, hashString } from "../core/rng.js";

export const ROOM_TYPES = {
  combat: { label: "Battle", hint: "A normal fight, then a shrine." },
  elite: { label: "Elite", hint: "Tougher foes. +20 embers and a free shrine reroll." },
  treasure: { label: "Treasure", hint: "A light fight guarding a chest of embers." },
  rest: { label: "Rest", hint: "No fight. A campfire restores 35% health." },
  boss: { label: "Boss", hint: "The floor's guardian waits beyond." },
  stairs: { label: "Descend", hint: "Take the stairs down." },
};

const WEIGHTS = [["combat", 45], ["elite", 20], ["treasure", 15], ["rest", 20]];

function pick(rng, pool) {
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total, i = 0;
  // rng() < 1, so r < total and the walk always stops on a real entry
  while (r >= pool[i][1]) { r -= pool[i][1]; i++; }
  return pool[i][0];
}

// Exits shown in room `room` (0-based) of `floor`. roomsPerFloor combat rooms come before the boss.
export function exitChoices(seed, floor, room, roomsPerFloor, currentType) {
  if (room >= roomsPerFloor) return ["stairs"];       // boss room
  if (room + 1 >= roomsPerFloor) return ["boss"];      // last room before the boss
  const rng = createRng(hashString(`${seed}|route|${floor}|${room}`));
  let pool = WEIGHTS.filter(([t]) => !(t === "rest" && (currentType === "rest" || room === 0)));
  const a = pick(rng, pool);
  pool = pool.filter(([t]) => t !== a);
  const b = pick(rng, pool);
  return [a, b];
}
