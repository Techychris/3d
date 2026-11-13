// Unit tests for src/core/fsm.js (explicit state machines).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkTable, createMachine, transition } from "../../src/core/fsm.js";

const DOOR = { shut: { OPEN: "open" }, open: { SHUT: "shut", SLAM: "shut" } };

describe("checkTable", () => {
  it("returns a sound table and rejects one that points at a missing state", () => {
    assert.equal(checkTable(DOOR), DOOR);
    assert.throws(() => checkTable({ a: { GO: "nowhere" } }), /a --GO--> unknown state "nowhere"/);
  });
});

describe("createMachine", () => {
  it("rejects an unknown initial state and a broken table", () => {
    assert.throws(() => createMachine(DOOR, "ajar"), /unknown initial state "ajar"/);
    assert.throws(() => createMachine({ a: { GO: "b" } }, "a"), /unknown state "b"/);
  });
  it("moves only on events the current state accepts, and reports whether it moved", () => {
    const m = createMachine(DOOR, "shut");
    assert.equal(m.send("SHUT"), false);
    assert.equal(m.state, "shut");
    assert.equal(m.send("OPEN"), true);
    assert.ok(m.is("open")); assert.ok(m.is("shut", "open")); assert.ok(!m.is("shut"));
  });
  it("counts time in the current state and restarts the count on every move", () => {
    const m = createMachine(DOOR, "shut");
    m.tick(0.5); m.tick(0.25);
    assert.equal(m.time, 0.75);
    m.send("OPEN");
    assert.equal(m.time, 0);
  });
  it("tells onChange the new state, the old one, the event and its payload", () => {
    const seen = [];
    const m = createMachine(DOOR, "shut", (...a) => seen.push(a));
    m.send("OPEN", { by: "wind" }); m.send("OPEN"); m.send("SLAM");
    assert.deepEqual(seen, [["open", "shut", "OPEN", { by: "wind" }], ["shut", "open", "SLAM", undefined]]);
  });
});

describe("transition", () => {
  it("moves an object's state field along the table, or throws on an illegal move", () => {
    const d = { state: "shut" };
    assert.equal(transition(DOOR, d, "OPEN"), "open");
    assert.equal(d.state, "open");
    assert.throws(() => transition(DOOR, d, "OPEN"), /"OPEN" is not legal in state "open"/);
    assert.equal(d.state, "open");
  });
});

// ---- every state table in the game, checked against itself
import { GAME_FLOW, ROOM_FLOW } from "../../src/game/flow.js";
import { ENEMY_FLOW } from "../../src/game/enemies.js";
import { BOSS_FLOW } from "../../src/game/bosses.js";
import { TELEGRAPH_FLOW } from "../../src/game/combat.js";
import { PLAYER_FLOW, SWING_FLOW } from "../../src/game/player.js";

const reachable = (table, initial) => {
  const seen = new Set([initial]), q = [initial];
  for (const s of q) for (const to of Object.values(table[s])) if (!seen.has(to)) { seen.add(to); q.push(to); }
  return [...seen].sort();
};
const TABLES = { GAME_FLOW: [GAME_FLOW, "boot"], ROOM_FLOW: [ROOM_FLOW, "fight"], ENEMY_FLOW: [ENEMY_FLOW, "idle"], BOSS_FLOW: [BOSS_FLOW, "aggro"], TELEGRAPH_FLOW: [TELEGRAPH_FLOW, "windup"], PLAYER_FLOW: [PLAYER_FLOW, "free"], SWING_FLOW: [SWING_FLOW, "idle"] };

describe("the game's state tables", () => {
  for (const [name, [table, initial]] of Object.entries(TABLES)) {
    it(`${name}: every state can be reached from "${initial}"`, () => {
      assert.deepEqual(reachable(table, initial), Object.keys(table).sort());
    });
  }
  it("GAME_FLOW refuses moves that used to be possible by assigning the state", () => {
    const at = (state) => { const m = createMachine(GAME_FLOW, "boot"); for (const ev of { hub: ["HUB"], run: ["HUB", "START"], dying: ["HUB", "START", "DIE"], shrine: ["HUB", "START", "SHRINE"], recap: ["HUB", "START", "WIN"] }[state]) m.send(ev); assert.equal(m.state, state); return m; };
    assert.equal(at("dying").send("WIN"), false);     // cannot win while dying
    assert.equal(at("dying").send("PAUSE"), false);
    assert.equal(at("shrine").send("PAUSE"), false);
    assert.equal(at("shrine").send("DIE"), false);
    assert.equal(at("run").send("LOSE"), false);      // losing always goes through "dying"
    assert.equal(at("run").send("CHOSEN"), false);    // a doubled shrine click cannot advance twice
    assert.equal(at("hub").send("HUB"), false);
    assert.equal(at("recap").send("ADVANCE"), false);
  });
  it("only the dead and finished states are terminal", () => {
    const terminal = (t) => Object.keys(t).filter((s) => Object.values(t[s]).every((to) => to === s));
    assert.deepEqual(terminal(GAME_FLOW), []);
    assert.deepEqual(terminal(ROOM_FLOW), ["clear"]);
    assert.deepEqual(terminal(ENEMY_FLOW), []);
    assert.deepEqual(terminal(BOSS_FLOW), []);
    assert.deepEqual(terminal(TELEGRAPH_FLOW), ["done", "cancelled"]);
    assert.deepEqual(terminal(PLAYER_FLOW), ["dead"]);
    assert.deepEqual(terminal(SWING_FLOW), []);
  });
});
