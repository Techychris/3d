import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as P from "../../src/game/progress.js";
import { hashString } from "../../src/core/rng.js";

const KEY = "dusk-roguelite-v1";
const BAD = "That code doesn't match a save.";

// Minimal in-memory localStorage. Installed on globalThis for each test.
function installStorage() {
  const data = new Map();
  const stub = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    _data: data,
  };
  Object.defineProperty(globalThis, "localStorage", { value: stub, configurable: true, writable: true });
  return stub;
}
function uninstallStorage() {
  delete globalThis.localStorage;
}

// Build a save code by hand. `c` defaults to a correct checksum for `d`, so the
// envelope passes the checksum and only the checks after it can reject it.
function envelope(d, { v = 1, c } = {}) {
  const env = { v, d, c: c === undefined ? hashString("dusk|" + d).toString(36) : c };
  return Buffer.from(JSON.stringify(env), "utf8").toString("base64");
}
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

beforeEach(() => { installStorage(); P.resetProgress(); });
afterEach(() => { P.resetProgress(); uninstallStorage(); });

describe("constants and defaults", () => {
  it("exposes three endings with ids, names and how-to text", () => {
    assert.equal(P.ENDINGS.length, 3);
    assert.deepEqual(P.ENDINGS.map((e) => e.id), ["spire", "untouched", "daily"]);
    for (const e of P.ENDINGS) assert.ok(e.name && e.how);
  });

  it("sets the vigor cap and the cost of each level", () => {
    assert.equal(P.VIGOR_MAX, 2);
    assert.deepEqual(P.VIGOR_COSTS, [30, 60]);
  });

  it("builds default settings and default meta", () => {
    assert.deepEqual(P.defaultSettings(), { quality: "auto", shake: true, flashes: true, blur: true, music: 0.6, sfx: 0.8, screenRelative: true });
    assert.deepEqual(P.defaultMeta(), {
      currency: 0, upgrades: { vigor: 0 }, endings: [], codex: [], cls: "warrior", runsStarted: 0, runsWon: 0, settings: P.defaultSettings(),
    });
  });
});

describe("loadMeta and saveMeta", () => {
  it("returns defaults when nothing is saved", () => {
    const m = P.loadMeta();
    assert.equal(m.currency, 0);
    assert.equal(m.upgrades.vigor, 0);
    assert.equal(m.settings.quality, "auto");
    assert.equal(P.loadRun(), null);
  });

  it("saves to storage and loads back with fractional currency floored", () => {
    const m = P.loadMeta();
    m.currency = 50.9; m.codex.push("ember-blade"); m.upgrades.vigor = 1;
    P.saveMeta(m);
    assert.equal(P.loadMeta().currency, 50);
    assert.deepEqual(P.loadMeta().codex, ["ember-blade"]);
    assert.equal(P.loadMeta().upgrades.vigor, 1);
    const raw = JSON.parse(globalThis.localStorage._data.get(KEY));
    assert.equal(raw.meta.currency, 50);
  });

  it("keeps an in-progress run when meta is saved", () => {
    const run = P.newRun("abc");
    run.items.push("lucky-coin");
    P.saveRun(run);
    P.saveMeta({ currency: 7 });
    assert.equal(P.loadRun().items[0], "lucky-coin");
    assert.equal(P.loadMeta().currency, 7);
  });

  it("stores a null run when the stored blob has no run entry yet", () => {
    globalThis.localStorage.setItem(KEY, JSON.stringify({ meta: { currency: 3 } }));
    P.saveMeta({ currency: 9 });
    assert.equal(P.loadRun(), null);
    assert.equal(P.loadMeta().currency, 9);
  });

  it("writes a default meta when a run is saved before any meta exists", () => {
    P.saveRun(P.newRun("first"));
    assert.equal(P.loadMeta().currency, 0);
    assert.equal(P.loadMeta().settings.quality, "auto");
    assert.equal(P.loadRun().seed, "first");
  });
});

describe("normalizeMeta (through saveMeta/loadMeta)", () => {
  const load = (m) => { P.saveMeta(m); return P.loadMeta(); };

  it("replaces a non-object meta with defaults", () => {
    P.saveMeta(null);
    assert.deepEqual(P.loadMeta(), P.defaultMeta());
    assert.deepEqual(load("text"), P.defaultMeta());
    assert.deepEqual(load(42), P.defaultMeta());
  });

  it("clamps currency, run counters and drops negative or non-numeric values", () => {
    const m = load({ currency: -5, runsStarted: -1, runsWon: "3" });
    assert.equal(m.currency, 0);
    assert.equal(m.runsStarted, 0);
    assert.equal(m.runsWon, 0);
    const n = load({ currency: 12.7, runsStarted: 4.2, runsWon: 2 });
    assert.equal(n.currency, 12);
    assert.equal(n.runsStarted, 4);
    assert.equal(n.runsWon, 2);
    assert.equal(load({ currency: Infinity }).currency, 0);
  });

  it("clamps vigor to 0..2 and floors fractional levels", () => {
    assert.equal(load({ upgrades: { vigor: 9 } }).upgrades.vigor, 2);
    assert.equal(load({ upgrades: { vigor: -4 } }).upgrades.vigor, 0);
    assert.equal(load({ upgrades: { vigor: 1.8 } }).upgrades.vigor, 1);
    assert.equal(load({ upgrades: null }).upgrades.vigor, 0);
    assert.equal(load({ upgrades: {} }).upgrades.vigor, 0);
    assert.equal(load({}).upgrades.vigor, 0);
  });

  it("keeps only string entries in endings and codex", () => {
    const m = load({ endings: ["spire", 5, null], codex: "nope" });
    assert.deepEqual(m.endings, ["spire"]);
    assert.deepEqual(m.codex, []);
  });

  it("uses default settings when settings is missing, null or not an object", () => {
    assert.deepEqual(load({ settings: null }).settings, P.defaultSettings());
    assert.deepEqual(load({ settings: 3 }).settings, P.defaultSettings());
    assert.deepEqual(load({}).settings, P.defaultSettings());
  });

  it("accepts known quality levels and rejects unknown ones", () => {
    assert.equal(load({ settings: { quality: "high" } }).settings.quality, "high");
    assert.equal(load({ settings: { quality: "low" } }).settings.quality, "low");
    assert.equal(load({ settings: { quality: "ultra" } }).settings.quality, "auto");
  });

  it("keeps booleans and falls back to defaults for other types", () => {
    const s = load({ settings: { shake: false, flashes: "no", blur: false, screenRelative: 0 } }).settings;
    assert.equal(s.shake, false);
    assert.equal(s.flashes, true);
    assert.equal(s.blur, false);
    assert.equal(s.screenRelative, true);
  });

  it("clamps volumes to 0..1 and falls back for non-numbers", () => {
    const s = load({ settings: { music: 3, sfx: -2 } }).settings;
    assert.equal(s.music, 1);
    assert.equal(s.sfx, 0);
    const t = load({ settings: { music: "loud", sfx: NaN } }).settings;
    assert.equal(t.music, 0.6);
    assert.equal(t.sfx, 0.8);
  });
});

describe("normalizeRun (through saveRun/loadRun)", () => {
  const run = (over) => Object.assign(P.newRun("seed-1"), over);

  it("drops a run that is null, not an object, or has no usable seed or item list", () => {
    P.saveRun(null);
    assert.equal(P.loadRun(), null);
    P.saveRun("text");
    assert.equal(P.loadRun(), null);
    P.saveRun(run({ seed: true }));
    assert.equal(P.loadRun(), null);
    P.saveRun(run({ seed: undefined }));
    assert.equal(P.loadRun(), null);
    P.saveRun(run({ items: "lucky-coin" }));
    assert.equal(P.loadRun(), null);
  });

  it("accepts a numeric seed as well as a string seed", () => {
    P.saveRun(run({ seed: 99 }));
    assert.equal(P.loadRun().seed, 99);
  });

  it("clamps floor to 1..3 and defaults it when missing", () => {
    P.saveRun(run({ floor: 0 })); assert.equal(P.loadRun().floor, 1);
    P.saveRun(run({ floor: 9 })); assert.equal(P.loadRun().floor, 3);
    P.saveRun(run({ floor: 2.7 })); assert.equal(P.loadRun().floor, 2);
    P.saveRun(run({ floor: undefined })); assert.equal(P.loadRun().floor, 1);
  });

  it("clamps room to 0..99", () => {
    P.saveRun(run({ room: -3 })); assert.equal(P.loadRun().room, 0);
    P.saveRun(run({ room: 150 })); assert.equal(P.loadRun().room, 99);
    P.saveRun(run({ room: undefined })); assert.equal(P.loadRun().room, 0);
  });

  it("keeps only string item ids and clamps runCurrency at zero", () => {
    P.saveRun(run({ items: ["ember-blade", 7, null, "lucky-coin"], runCurrency: -4 }));
    assert.deepEqual(P.loadRun().items, ["ember-blade", "lucky-coin"]);
    assert.equal(P.loadRun().runCurrency, 0);
  });

  it("handles hp: null and missing stay null, numbers are floored at zero, and other types are null", () => {
    P.saveRun(run({ hp: null })); assert.equal(P.loadRun().hp, null);
    P.saveRun(run({ hp: undefined })); assert.equal(P.loadRun().hp, null);
    P.saveRun(run({ hp: 12 })); assert.equal(P.loadRun().hp, 12);
    P.saveRun(run({ hp: -5 })); assert.equal(P.loadRun().hp, 0);
    P.saveRun(run({ hp: "12" })); assert.equal(P.loadRun().hp, null);
  });

  it("defaults the hero when the value is not a string", () => {
    P.saveRun(run({ hero: "hero-rogue" })); assert.equal(P.loadRun().hero, "hero-rogue");
    P.saveRun(run({ hero: 3 })); assert.equal(P.loadRun().hero, "hero-warrior");
  });

  it("defaults startedAt to 0 for non-numbers and keeps numbers", () => {
    P.saveRun(run({ startedAt: "yesterday" })); assert.equal(P.loadRun().startedAt, 0);
    P.saveRun(run({ startedAt: 1700000000000 })); assert.equal(P.loadRun().startedAt, 1700000000000);
  });

  it("coerces daily to a boolean and floors and clamps the counters", () => {
    P.saveRun(run({ daily: "yes", hitsTaken: -2, embers: 4.9 }));
    const r = P.loadRun();
    assert.equal(r.daily, true);
    assert.equal(r.hitsTaken, 0);
    assert.equal(r.embers, 4);
    P.saveRun(run({ daily: 0 }));
    assert.equal(P.loadRun().daily, false);
  });

  it("keeps a valid room type and falls back to combat for anything else", () => {
    P.saveRun(run({ roomType: "rest" })); assert.equal(P.loadRun().roomType, "rest");
    P.saveRun(run({ roomType: "elite" })); assert.equal(P.loadRun().roomType, "elite");
    P.saveRun(run({ roomType: "boss" })); assert.equal(P.loadRun().roomType, "combat");
    P.saveRun(run({ roomType: undefined })); assert.equal(P.loadRun().roomType, "combat");
  });

  it("keeps only known room kinds in path and caps it at twelve entries", () => {
    P.saveRun(run({ path: ["combat", "boss", "rest", 3, "treasure"] }));
    assert.deepEqual(P.loadRun().path, ["combat", "rest", "treasure"]);
    P.saveRun(run({ path: "combat" }));
    assert.deepEqual(P.loadRun().path, []);
    const long = Array(20).fill("elite");
    P.saveRun(run({ path: long }));
    assert.equal(P.loadRun().path.length, 12);
  });
});

describe("clearRun and resetProgress", () => {
  it("clearRun removes the run and keeps meta", () => {
    const run = P.newRun("abc");
    P.saveRun(run);
    P.saveMeta({ currency: 50 });
    P.clearRun();
    assert.equal(P.loadRun(), null);
    assert.equal(P.loadMeta().currency, 50);
  });

  it("clearRun on a fresh store leaves default meta in place", () => {
    P.clearRun();
    assert.equal(P.loadRun(), null);
    assert.equal(P.loadMeta().currency, 0);
  });

  it("resetProgress wipes memory and removes the storage key", () => {
    P.saveMeta({ currency: 20 });
    P.saveRun(P.newRun("x"));
    P.resetProgress();
    assert.equal(P.loadMeta().currency, 0);
    assert.equal(P.loadRun(), null);
    assert.equal(globalThis.localStorage._data.has(KEY), false);
  });

  it("resetProgress does not throw when storage refuses removal, and the stored save remains readable", () => {
    P.saveMeta({ currency: 20 });
    globalThis.localStorage.removeItem = () => { throw new Error("denied"); };
    assert.doesNotThrow(() => P.resetProgress());
    assert.equal(globalThis.localStorage._data.has(KEY), true);
    assert.equal(P.loadMeta().currency, 20);
  });
});

describe("newRun", () => {
  it("builds a fresh run with the given seed and starting values", (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: 1234 });
    try {
      assert.deepEqual(P.newRun("seed-7"), {
        seed: "seed-7", floor: 1, room: 0, items: [], runCurrency: 0, hp: null, hero: "hero-warrior", cls: "warrior", inv: { equip: { weapon: null, armour: null, trinket: null }, bag: [], potions: 1, bombs: 0 },
        startedAt: 1234, daily: false, roomDone: false, hitsTaken: 0, embers: 0, roomType: "combat", path: [],
      });
    } finally {
      t.mock.timers.reset();
    }
  });
});

describe("storage failures", () => {
  it("ignores corrupt JSON in storage and reads defaults", () => {
    globalThis.localStorage.setItem(KEY, "{not json");
    assert.equal(P.loadMeta().currency, 0);
    assert.equal(P.loadRun(), null);
  });

  it("ignores stored JSON that is not an object", () => {
    globalThis.localStorage.setItem(KEY, "42");
    assert.equal(P.loadMeta().currency, 0);
    globalThis.localStorage.setItem(KEY, "null");
    assert.equal(P.loadRun(), null);
  });

  it("ignores an empty stored value", () => {
    globalThis.localStorage.setItem(KEY, "");
    assert.equal(P.loadMeta().currency, 0);
  });

  it("falls back to the in-memory copy when stored data is corrupt", () => {
    P.saveMeta({ currency: 50 });
    globalThis.localStorage.setItem(KEY, "garbage");
    assert.equal(P.loadMeta().currency, 50);
  });

  it("works from memory alone when storage cannot be read", () => {
    globalThis.localStorage.getItem = () => { throw new Error("blocked"); };
    P.saveMeta({ currency: 11 });
    P.saveRun(P.newRun("m"));
    assert.equal(P.loadMeta().currency, 11);
    assert.equal(P.loadRun().seed, "m");
  });

  it("keeps working from memory when storage refuses writes", () => {
    globalThis.localStorage.setItem = () => { throw new Error("quota"); };
    P.saveMeta({ currency: 13 });
    assert.equal(P.loadMeta().currency, 13);
    assert.equal(globalThis.localStorage._data.has(KEY), false);
  });

  it("works from memory alone when localStorage is not present at all", () => {
    uninstallStorage();
    P.saveMeta({ currency: 5 });
    P.saveRun(P.newRun("no-storage"));
    assert.equal(P.loadMeta().currency, 5);
    assert.equal(P.loadRun().seed, "no-storage");
    P.clearRun();
    assert.equal(P.loadRun(), null);
    P.resetProgress();
    assert.equal(P.loadMeta().currency, 0);
  });

  it("works from memory alone when reading localStorage itself throws", () => {
    Object.defineProperty(globalThis, "localStorage", { get() { throw new Error("denied"); }, configurable: true });
    P.saveMeta({ currency: 8 });
    assert.equal(P.loadMeta().currency, 8);
  });
});

describe("upgradeCost", () => {
  it("prices the first two vigor levels and returns null at the cap", () => {
    assert.equal(P.upgradeCost({ upgrades: { vigor: 0 } }, "vigor"), 30);
    assert.equal(P.upgradeCost({ upgrades: { vigor: 1 } }, "vigor"), 60);
    assert.equal(P.upgradeCost({ upgrades: { vigor: 2 } }, "vigor"), null);
  });

  it("treats missing meta or a missing level as level zero", () => {
    assert.equal(P.upgradeCost(null, "vigor"), 30);
    assert.equal(P.upgradeCost({}, "vigor"), 30);
    assert.equal(P.upgradeCost({ upgrades: {} }, "vigor"), 30);
  });

  it("uses the floored level and never reads a negative index", () => {
    assert.equal(P.upgradeCost({ upgrades: { vigor: 1.5 } }, "vigor"), 60);
    assert.equal(P.upgradeCost({ upgrades: { vigor: -1 } }, "vigor"), 30);
  });

  it("returns null for any upgrade other than vigor", () => {
    assert.equal(P.upgradeCost({ upgrades: { vigor: 0 } }, "speed"), null);
  });
});

describe("endingsEarned", () => {
  it("earns nothing without a context or from a lost run", () => {
    assert.deepEqual(P.endingsEarned(null), []);
    assert.deepEqual(P.endingsEarned({ won: false, bossId: "necromancer", hitsTaken: 0, daily: true }), []);
  });

  it("earns the spire ending when the Necromancer is beaten or no boss is named", () => {
    assert.deepEqual(P.endingsEarned({ won: true }), ["spire"]);
    assert.deepEqual(P.endingsEarned({ won: true, bossId: "necromancer" }), ["spire"]);
  });

  it("does not earn the spire ending against another boss", () => {
    assert.deepEqual(P.endingsEarned({ won: true, bossId: "bone-king" }), []);
  });

  it("earns untouched only with zero hits taken, whichever boss was beaten", () => {
    assert.deepEqual(P.endingsEarned({ won: true, bossId: "bone-king", hitsTaken: 0 }), ["untouched"]);
    assert.deepEqual(P.endingsEarned({ won: true, bossId: "bone-king", hitsTaken: 1 }), []);
    assert.deepEqual(P.endingsEarned({ won: true, hitsTaken: 0 }), ["spire", "untouched"]);
  });

  it("earns daily on a won daily run and can stack all three", () => {
    assert.deepEqual(P.endingsEarned({ won: true, bossId: "necromancer", hitsTaken: 0, daily: true }), ["spire", "untouched", "daily"]);
    assert.deepEqual(P.endingsEarned({ won: true, bossId: "necromancer", hitsTaken: 4, daily: false }), ["spire"]);
  });
});

describe("save codes", () => {
  it("round-trips meta and a run, normalizing both", () => {
    const m = P.defaultMeta();
    m.currency = 120; m.codex = ["ember-blade"]; m.upgrades.vigor = 2; m.endings = ["spire"];
    const run = P.newRun("abc");
    run.items = ["lucky-coin", "swift-boots"];
    run.roomType = "elite";
    run.path = ["combat", "rest"];
    run.hp = 40;
    run.floor = 2;
    const code = P.encodeSave(m, run);
    assert.equal(typeof code, "string");
    const back = P.decodeSave(code);
    assert.deepEqual(back.meta, m);
    assert.deepEqual(back.run, run);
  });

  it("returns a null run when the saved run is absent", () => {
    assert.equal(P.decodeSave(P.encodeSave(P.defaultMeta(), null)).run, null);
    assert.equal(P.decodeSave(P.encodeSave(P.defaultMeta(), undefined)).run, null);
  });

  it("normalizes meta on encode, so bad values never leave the device", () => {
    const code = P.encodeSave({ currency: -5, upgrades: { vigor: 9 } }, null);
    const back = P.decodeSave(code);
    assert.equal(back.meta.currency, 0);
    assert.equal(back.meta.upgrades.vigor, 2);
  });

  it("accepts a code with surrounding whitespace", () => {
    const code = P.encodeSave(P.defaultMeta(), null);
    assert.equal(P.decodeSave(`  \n${code}\n `).meta.currency, 0);
  });

  it("rejects a valid-looking envelope whose run is not a usable run", () => {
    const bad = (d) => assert.throws(() => P.decodeSave(envelope(d)), { message: BAD });
    bad(JSON.stringify({ meta: {}, run: 5 }));
    bad(JSON.stringify({ meta: {}, run: {} }));
    bad(JSON.stringify({ meta: {}, run: "x" }));
  });

  it("accepts a run entry that is null, undefined, zero or missing", () => {
    assert.equal(P.decodeSave(envelope(JSON.stringify({ meta: {}, run: null }))).run, null);
    assert.equal(P.decodeSave(envelope(JSON.stringify({ meta: {} }))).run, null);
    assert.equal(P.decodeSave(envelope(JSON.stringify({ meta: {}, run: 0 }))).run, null);
  });

  it("fills in defaults for an empty meta object", () => {
    assert.deepEqual(P.decodeSave(envelope(JSON.stringify({ meta: {} }))).meta, P.defaultMeta());
  });
});

describe("decodeSave rejects bad codes", () => {
  const code = P.encodeSave(P.defaultMeta(), P.newRun("abc"));

  it("tampered payloads fail the checksum", () => {
    // Change the currency inside the payload but keep the old checksum.
    const raw = JSON.parse(Buffer.from(code, "base64").toString("utf8"));
    const forged = JSON.parse(raw.d); forged.meta.currency = 99999; raw.d = JSON.stringify(forged);
    const bad = Buffer.from(JSON.stringify(raw)).toString("base64");
    assert.throws(() => P.decodeSave(bad), { message: BAD });
  });

  it("truncated, malformed or non-text input is rejected", () => {
    for (const c of [code.slice(0, -4), "!!!", "", null, 42, undefined, {}, b64("{}"), b64("null")]) {
      assert.throws(() => P.decodeSave(c), { message: BAD });
    }
  });

  it("a single flipped character in the code is rejected", () => {
    const flipped = code.slice(0, 20) + (code[20] === "A" ? "B" : "A") + code.slice(21);
    assert.throws(() => P.decodeSave(flipped), { message: BAD });
  });

  it("bytes that are not valid UTF-8 are rejected", () => {
    assert.throws(() => P.decodeSave(Buffer.from([0xff, 0xfe, 0xfd]).toString("base64")), { message: BAD });
  });

  it("an envelope with another version is rejected even with a good checksum", () => {
    assert.throws(() => P.decodeSave(envelope(JSON.stringify({ meta: {} }), { v: 2 })), { message: BAD });
  });

  it("an envelope with a wrong checksum is rejected", () => {
    assert.throws(() => P.decodeSave(envelope(JSON.stringify({ meta: {} }), { c: "zzz" })), { message: BAD });
  });

  it("an envelope whose payload is not a string is rejected", () => {
    const env = { v: 1, d: { meta: {} }, c: "x" };
    assert.throws(() => P.decodeSave(b64(JSON.stringify(env))), { message: BAD });
  });

  it("a valid checksum over a payload that is not usable JSON or not a save is rejected", () => {
    for (const d of ["{not json", "null", "5", "{}", JSON.stringify({ meta: 5 }), JSON.stringify({ meta: null })]) {
      assert.throws(() => P.decodeSave(envelope(d)), { message: BAD }, d);
    }
  });
});

describe("legacy progress.test.mjs checks", () => {
  it("runs the original save, load, run and tamper checks", () => {
    P.resetProgress();
    const m = P.loadMeta();
    assert.equal(m.currency, 0); assert.equal(m.upgrades.vigor, 0); assert.equal(m.settings.quality, "auto");
    assert.equal(P.loadRun(), null);

    m.currency = 50; m.codex.push("ember-blade"); m.upgrades.vigor = 1;
    P.saveMeta(m);
    assert.equal(P.loadMeta().currency, 50);
    assert.deepEqual(P.loadMeta().codex, ["ember-blade"]);
    const run = P.newRun("abc");
    run.items.push("lucky-coin");
    P.saveRun(run);
    assert.equal(P.loadRun().items[0], "lucky-coin");
    assert.equal(P.loadMeta().currency, 50);
    P.clearRun();
    assert.equal(P.loadRun(), null);
    assert.equal(P.loadMeta().currency, 50);

    assert.equal(P.upgradeCost({ upgrades: { vigor: 0 } }, "vigor"), 30);
    assert.equal(P.upgradeCost({ upgrades: { vigor: 1 } }, "vigor"), 60);
    assert.equal(P.upgradeCost({ upgrades: { vigor: 2 } }, "vigor"), null);
    assert.equal(P.ENDINGS.length, 3);

    const code = P.encodeSave(m, run);
    const back = P.decodeSave(code);
    assert.deepEqual(back.meta, P.loadMeta());
    assert.deepEqual(back.run, run);
    assert.equal(P.decodeSave(P.encodeSave(m, null)).run, null);

    const raw = JSON.parse(Buffer.from(code, "base64").toString("utf8"));
    const forged = JSON.parse(raw.d); forged.meta.currency = 99999; raw.d = JSON.stringify(forged);
    const bad = Buffer.from(JSON.stringify(raw)).toString("base64");
    for (const c of [bad, code.slice(0, -4), "!!!", "", null, 42, Buffer.from("{}").toString("base64"),
      code.slice(0, 20) + (code[20] === "A" ? "B" : "A") + code.slice(21)]) {
      assert.throws(() => P.decodeSave(c), { message: BAD });
    }
  });
});
