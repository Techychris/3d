import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOM_TYPES, exitChoices } from "../../src/game/route.js";

// Room kinds a regular (non-boss, non-stairs) exit can lead to.
const REGULAR = ["combat", "elite", "treasure", "rest"];
const SEEDS = Array.from({ length: 200 }, (_, i) => `seed-${i + 1}`);
const FLOORS = [1, 2, 3];

describe("ROOM_TYPES", () => {
  it("defines a label and a hint for every room kind", () => {
    assert.deepEqual(Object.keys(ROOM_TYPES).sort(), ["boss", "combat", "elite", "rest", "stairs", "treasure"]);
    for (const [k, v] of Object.entries(ROOM_TYPES)) {
      assert.ok(v.label && v.hint, k);
    }
  });
});

describe("exitChoices determinism", () => {
  it("returns the same choices for the same seed, floor and room", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      for (const floor of FLOORS) {
        for (let room = 0; room < 3; room++) {
          const first = exitChoices(seed, floor, room, 4, "combat");
          assert.deepEqual(exitChoices(seed, floor, room, 4, "combat"), first);
        }
      }
    }
  });

  it("gives different choices for different seeds", () => {
    const seen = new Set(SEEDS.map((s) => exitChoices(s, 1, 1, 6, "combat").join("|")));
    assert.ok(seen.size > 1, "all seeds gave the same choices");
  });

  it("depends on the floor and the room, not only the seed", () => {
    const seen = new Set();
    for (const floor of FLOORS) for (let room = 0; room < 4; room++) seen.add(exitChoices("same", floor, room, 6, "combat").join("|"));
    assert.ok(seen.size > 1);
  });
});

describe("boss and stairs rules", () => {
  it("offers only the boss on the room just before it", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      assert.deepEqual(exitChoices(seed, 1, 3, 4, "combat"), ["boss"]);
      assert.deepEqual(exitChoices(seed, 2, 5, 6, "rest"), ["boss"]);
    }
  });

  it("offers only the stairs once the boss room is cleared", () => {
    assert.deepEqual(exitChoices("s", 1, 4, 4, "combat"), ["stairs"]);
    assert.deepEqual(exitChoices("s", 1, 9, 4, "combat"), ["stairs"]);
  });

  it("uses the boss and stairs rules on a one-room floor", () => {
    assert.deepEqual(exitChoices("s", 1, 0, 1, "combat"), ["boss"]);
    assert.deepEqual(exitChoices("s", 1, 1, 1, "combat"), ["stairs"]);
  });

  it("never puts the boss or stairs in a regular choice", () => {
    for (const seed of SEEDS) {
      for (let room = 0; room < 3; room++) {
        for (const t of exitChoices(seed, 1, room, 4, "combat")) {
          assert.ok(REGULAR.includes(t), `room ${room} offered ${t}`);
        }
      }
    }
  });
});

describe("regular choices", () => {
  it("always offers two different room kinds", () => {
    for (const seed of SEEDS) {
      for (const floor of FLOORS) {
        for (let room = 0; room < 4; room++) {
          const [a, b, extra] = exitChoices(seed, floor, room, 6, "combat");
          assert.equal(extra, undefined);
          assert.notEqual(a, b, `${seed} f${floor} r${room}`);
        }
      }
    }
  });

  it("never offers rest in room 0, whatever the previous type was", () => {
    for (const seed of SEEDS) {
      for (const prev of [undefined, "combat", "elite", "treasure", "rest"]) {
        assert.ok(!exitChoices(seed, 1, 0, 4, prev).includes("rest"), `${seed} prev=${prev}`);
      }
    }
  });

  it("never offers rest straight after a rest room", () => {
    for (const seed of SEEDS) {
      for (const room of [1, 2]) {
        assert.ok(!exitChoices(seed, 2, room, 6, "rest").includes("rest"), `${seed} room ${room}`);
      }
    }
  });

  it("can offer rest mid-floor after a non-rest room", () => {
    let sawRest = false;
    for (const seed of SEEDS) {
      if (exitChoices(seed, 1, 2, 6, "combat").includes("rest")) { sawRest = true; break; }
    }
    assert.ok(sawRest, "rest never offered mid-floor");
  });

  it("only offers kinds from the regular set", () => {
    for (const seed of SEEDS) {
      for (const t of exitChoices(seed, 3, 2, 6, "elite")) assert.ok(REGULAR.includes(t));
    }
  });
});

describe("reachability", () => {
  it("reaches every room kind across many seeds", () => {
    const reached = new Set();
    for (const seed of SEEDS) {
      for (const floor of FLOORS) {
        // Mid-floor rooms, both after a fight and after a rest, plus room 0.
        for (const [room, prev] of [[0, undefined], [1, "combat"], [2, "treasure"], [2, "rest"]]) {
          for (const t of exitChoices(seed, floor, room, 6, prev)) reached.add(t);
        }
        reached.add(exitChoices(seed, floor, 5, 6, "combat")[0]); // boss
        reached.add(exitChoices(seed, floor, 6, 6, "combat")[0]); // stairs
      }
    }
    assert.deepEqual([...reached].sort(), Object.keys(ROOM_TYPES).sort());
  });

  it("reaches treasure and elite from room 0", () => {
    const reached = new Set();
    for (const seed of SEEDS) for (const t of exitChoices(seed, 1, 0, 4, "combat")) reached.add(t);
    assert.ok(reached.has("combat"));
    assert.ok(reached.has("elite"));
    assert.ok(reached.has("treasure"));
    assert.ok(!reached.has("rest"));
  });
});
