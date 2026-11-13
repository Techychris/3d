// The game's top-level state tables (data only; main.js runs them).
import { checkTable } from "../core/fsm.js";

// Every screen the game can be on and every way to move between them.
export const GAME_FLOW = checkTable({
  boot: { HUB: "hub" },
  hub: { START: "run" },
  run: { ADVANCE: "run", SHRINE: "shrine", PAUSE: "paused", DIE: "dying", WIN: "recap" },
  dying: { LOSE: "recap" },                      // the death animation plays; the world still simulates
  shrine: { REROLL: "shrine", CHOSEN: "run" },
  paused: { RESUME: "run", HUB: "hub" },         // settings opened from pause stay "paused"
  recap: { START: "run", HUB: "hub" },
});

// Each room: "fight" until no foes are left, then "clear" (exits open).
export const ROOM_FLOW = checkTable({ fight: { CLEAR: "clear" }, clear: {} });
