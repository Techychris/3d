import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { createRng, hashString, dailySeed } from "../../src/core/rng.js";
import { createEvents } from "../../src/core/events.js";
import { spy } from "./helpers.mjs";

describe("createRng", () => {
  it("produces the same sequence for the same numeric seed", () => {
    const a = createRng(42), b = createRng(42);
    for (let i = 0; i < 50; i++) assert.equal(a(), b());
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1), b = createRng(2);
    const seqA = [a(), a(), a()], seqB = [b(), b(), b()];
    assert.notDeepEqual(seqA, seqB);
  });

  it("pins the first outputs for seed 1 so saved runs and daily seeds keep their layout", () => {
    const r = createRng(1);
    assert.equal(r(), 0.6270739405881613);
    assert.equal(r(), 0.002735721180215478);
    assert.equal(r(), 0.5274470399599522);
  });

  it("returns values in the half-open interval [0, 1)", () => {
    const r = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
    }
  });

  it("treats seed 0 as seed 1 (zero state is never used)", () => {
    assert.equal(createRng(0)(), createRng(1)());
  });

  it("hashes string seeds, so a string and its hash give the same sequence", () => {
    const fromString = createRng("dawn");
    const fromHash = createRng(hashString("dawn"));
    for (let i = 0; i < 10; i++) assert.equal(fromString(), fromHash());
  });

  it("exposes its internal state, which starts at the seed and moves after each draw", () => {
    const r = createRng(5);
    assert.equal(r.state(), 5);
    r();
    assert.notEqual(r.state(), 5);
    assert.equal(typeof r.state(), "number");
  });

  describe("int(lo, hi)", () => {
    it("is inclusive at both ends and stays in range", () => {
      const r = createRng(3);
      const seen = new Set();
      for (let i = 0; i < 300; i++) {
        const v = r.int(1, 3);
        assert.ok(Number.isInteger(v) && v >= 1 && v <= 3, `bad value ${v}`);
        seen.add(v);
      }
      assert.deepEqual([...seen].sort(), [1, 2, 3]);
    });

    it("returns the bound when lo equals hi", () => {
      const r = createRng(11);
      for (let i = 0; i < 20; i++) assert.equal(r.int(5, 5), 5);
    });
  });

  describe("pick(arr)", () => {
    it("only returns members of the array and eventually returns every member", () => {
      const r = createRng(7);
      const items = ["a", "b", "c"];
      const seen = new Set();
      for (let i = 0; i < 200; i++) {
        const v = r.pick(items);
        assert.ok(items.includes(v));
        seen.add(v);
      }
      assert.equal(seen.size, 3);
    });

    it("returns undefined for an empty array", () => {
      assert.equal(createRng(7).pick([]), undefined);
    });
  });

  describe("shuffle(arr)", () => {
    it("returns a permutation and leaves the input untouched", () => {
      const r = createRng(21);
      const input = [1, 2, 3, 4, 5, 6];
      const out = r.shuffle(input);
      assert.notEqual(out, input);
      assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
      assert.deepEqual([...out].sort((x, y) => x - y), [1, 2, 3, 4, 5, 6]);
    });

    it("actually reorders a long array for some seeds", () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      const out = createRng(21).shuffle(input);
      assert.notDeepEqual(out, input);
    });

    it("is repeatable for the same seed", () => {
      const input = ["x", "y", "z", "w"];
      assert.deepEqual(createRng(8).shuffle(input), createRng(8).shuffle(input));
    });

    it("handles arrays of length 0 and 1", () => {
      const r = createRng(2);
      assert.deepEqual(r.shuffle([]), []);
      assert.deepEqual(r.shuffle(["solo"]), ["solo"]);
    });
  });
});

describe("hashString", () => {
  it("matches the FNV-1a 32-bit value for a known input", () => {
    assert.equal(hashString("a"), 3826002220);
  });

  it("returns the FNV offset basis for the empty string", () => {
    assert.equal(hashString(""), 2166136261);
  });

  it("is deterministic and separates different strings", () => {
    assert.equal(hashString("route|1|0"), hashString("route|1|0"));
    assert.notEqual(hashString("route|1|0"), hashString("route|1|1"));
  });
});

describe("dailySeed", () => {
  it("uses the UTC calendar date of the given moment", () => {
    // 23:30 on Nov 7 in UTC-5 is already Nov 8 in UTC.
    assert.equal(dailySeed(new Date("2026-11-07T23:30:00-05:00")), "daily-2026-11-08");
    assert.equal(dailySeed(new Date("2026-11-07T00:00:00Z")), "daily-2026-11-07");
  });

  it("defaults to the current date when called without an argument", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-07T12:00:00Z") });
    try {
      assert.equal(dailySeed(), "daily-2026-11-07");
    } finally {
      t.mock.timers.reset();
    }
  });
});

describe("createEvents", () => {
  it("delivers a payload to every subscriber of that event name only", () => {
    const bus = createEvents();
    const a = spy(), b = spy(), other = spy();
    bus.on("hit", a);
    bus.on("hit", b);
    bus.on("heal", other);
    bus.emit("hit", { dmg: 5 });
    assert.deepEqual(a.calls, [[{ dmg: 5 }]]);
    assert.deepEqual(b.calls, [[{ dmg: 5 }]]);
    assert.equal(other.calls.length, 0);
  });

  it("does nothing when emitting a name with no subscribers", () => {
    const bus = createEvents();
    assert.doesNotThrow(() => bus.emit("nobody", 1));
  });

  it("returns an unsubscribe function that stops further deliveries", () => {
    const bus = createEvents();
    const fn = spy();
    const off = bus.on("tick", fn);
    bus.emit("tick", 1);
    assert.equal(off(), true);
    bus.emit("tick", 2);
    assert.deepEqual(fn.calls, [[1]]);
  });

  it("unsubscribing one listener leaves the others subscribed", () => {
    const bus = createEvents();
    const keep = spy(), drop = spy();
    bus.on("tick", keep);
    const off = bus.on("tick", drop);
    off();
    bus.emit("tick", "x");
    assert.equal(keep.calls.length, 1);
    assert.equal(drop.calls.length, 0);
  });

  it("subscribing the same function twice still delivers only once", () => {
    const bus = createEvents();
    const fn = spy();
    bus.on("tick", fn);
    bus.on("tick", fn);
    bus.emit("tick", 3);
    assert.equal(fn.calls.length, 1);
  });

  it("keeps delivering to other listeners when one listener throws, and logs the error", (t) => {
    const log = t.mock.method(console, "error", () => {});
    const bus = createEvents();
    const boom = new Error("boom");
    const after = spy();
    bus.on("hit", () => { throw boom; });
    bus.on("hit", after);
    bus.emit("hit", 7);
    assert.equal(after.calls.length, 1);
    assert.equal(log.mock.calls.length, 1);
    assert.equal(log.mock.calls[0].arguments[0], "event hit");
    assert.equal(log.mock.calls[0].arguments[1], boom);
  });

  it("delivers the current emission to a listener that unsubscribes itself during the emit", () => {
    const bus = createEvents();
    const calls = [];
    let off;
    off = bus.on("once", (v) => { calls.push(v); off(); });
    bus.emit("once", "first");
    bus.emit("once", "second");
    assert.deepEqual(calls, ["first"]);
  });

  it("an unsubscribe function from before clear() is safe to call, and does not affect new subscriptions", () => {
    const bus = createEvents();
    const fn = spy();
    const off = bus.on("tick", fn);
    bus.clear();
    assert.doesNotThrow(() => off());
    bus.on("tick", fn);
    bus.emit("tick", 5);
    assert.deepEqual(fn.calls, [[5]]);
    // Calling the stale unsubscribe again still leaves the new subscription in place.
    off();
    bus.emit("tick", 6);
    assert.deepEqual(fn.calls, [[5], [6]]);
  });

  it("clear() removes every subscription, and later emits reach nobody", () => {
    const bus = createEvents();
    const fn = spy();
    bus.on("tick", fn);
    bus.clear();
    bus.emit("tick", 1);
    assert.equal(fn.calls.length, 0);
    // The bus is still usable after clear.
    bus.on("tick", fn);
    bus.emit("tick", 2);
    assert.deepEqual(fn.calls, [[2]]);
  });
});
