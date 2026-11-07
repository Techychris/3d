// Unit tests for src/engine/audio.js (WebAudio synth, unlock, music scheduler, volumes).
import { describe, it, before, after, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { installDom, spy } from "./helpers.mjs";
import { createAudio, SOUND_NAMES } from "../../src/engine/audio.js";

let dom, doc, win, registered;

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `expected ${a} to be near ${b}`);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// AudioParam-like object with spies on every scheduling method.
class Param {
  constructor(value = 0) {
    this.value = value;
    this.setValueAtTime = spy();
    this.linearRampToValueAtTime = spy();
    this.exponentialRampToValueAtTime = spy();
    this.setTargetAtTime = spy();
  }
}

// Fake AudioContext. Every node it creates is kept in `made` with a `kind` tag.
class FakeAudioContext {
  static instances = [];
  static rejectResume = false;
  static rejectSuspend = false;
  static failBuild = false;

  constructor() {
    FakeAudioContext.instances.push(this);
    this.state = "suspended";
    this.currentTime = 0;
    this.sampleRate = 1000;
    this.destination = { name: "destination" };
    this.made = [];
    this.resume = spy(() => {
      if (FakeAudioContext.rejectResume) return Promise.reject(new Error("blocked"));
      this.state = "running";
      return Promise.resolve();
    });
    this.suspend = spy(() => {
      if (FakeAudioContext.rejectSuspend) return Promise.reject(new Error("cannot suspend"));
      this.state = "suspended";
      return Promise.resolve();
    });
  }
  node(kind, props) {
    const n = { kind, connect: spy(), ...props };
    this.made.push(n);
    return n;
  }
  createOscillator() { return this.node("osc", { type: "sine", frequency: new Param(), detune: new Param(), start: spy(), stop: spy() }); }
  createGain() { return this.node("gain", { gain: new Param(1) }); }
  createBiquadFilter() { return this.node("filter", { type: "", frequency: new Param(), Q: new Param(1) }); }
  createBufferSource() { return this.node("src", { buffer: null, start: spy(), stop: spy() }); }
  createDynamicsCompressor() {
    if (FakeAudioContext.failBuild) throw new TypeError("compressor unavailable");
    return this.node("comp", { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() });
  }
  createBuffer(channels, length, rate) {
    const data = new Float32Array(length);
    return this.node("buffer", { length, sampleRate: rate, getChannelData: () => data, data });
  }
}

const ctx = () => FakeAudioContext.instances.at(-1);
const kinds = (c, kind) => c.made.filter((n) => n.kind === kind);
const count = (c, kind) => kinds(c, kind).length;
const lastTarget = (param) => param.setTargetAtTime.calls.at(-1);

// Unlock and return the context plus its gain buses: [master, sfx, music].
function unlocked() {
  const audio = createAudio();
  audio.unlock();
  const c = ctx();
  const [master, sfx, music] = kinds(c, "gain");
  return { audio, c, master, sfx, music };
}

before(async () => {
  dom = await installDom();
  doc = dom.window.document;
  win = dom.window;
});
after(() => dom.cleanup());

beforeEach(() => {
  FakeAudioContext.instances = [];
  FakeAudioContext.rejectResume = false;
  FakeAudioContext.rejectSuspend = false;
  FakeAudioContext.failBuild = false;
  win.AudioContext = FakeAudioContext;
  globalThis.AudioContext = FakeAudioContext;
  // The module calls bare addEventListener/removeEventListener, which only exist on window in a browser.
  registered = [];
  globalThis.addEventListener = spy((type, fn, opts) => { registered.push([type, fn, opts]); win.addEventListener(type, fn, opts); });
  globalThis.removeEventListener = spy((type, fn, opts) => win.removeEventListener(type, fn, opts));
  mock.method(Math, "random", () => 0.75);
  mock.timers.enable({ apis: ["setInterval"] });
});

afterEach(() => {
  for (const [type, fn, opts] of registered) win.removeEventListener(type, fn, opts);
  mock.timers.reset();
  mock.restoreAll();
  delete globalThis.addEventListener;
  delete globalThis.removeEventListener;
  delete globalThis.AudioContext;
  delete win.AudioContext;
  delete win.webkitAudioContext;
  delete doc.hidden;
});

describe("unlock", () => {
  it("reports no state and does not build anything before the first unlock", () => {
    const audio = createAudio();
    assert.equal(audio.state, "none");
    assert.equal(audio.mode, "off");
    assert.equal(audio.muted, false);
    audio.play("hit");
    assert.equal(FakeAudioContext.instances.length, 0);
  });

  it("builds the compressor and bus graph, starts the context and sets the initial volumes", () => {
    const { audio, c, master, sfx, music } = unlocked();
    assert.equal(FakeAudioContext.instances.length, 1);
    assert.equal(audio.state, "running");
    assert.equal(c.resume.calls.length, 1);

    const comp = kinds(c, "comp")[0];
    assert.equal(comp.threshold.value, -16);
    assert.equal(comp.knee.value, 20);
    assert.equal(comp.ratio.value, 6);
    assert.equal(comp.attack.value, 0.004);
    assert.equal(comp.release.value, 0.2);

    assert.equal(master.gain.value, 0.9);
    assert.deepEqual(sfx.connect.calls, [[comp]]);
    assert.deepEqual(music.connect.calls, [[comp]]);
    assert.deepEqual(comp.connect.calls, [[master]]);
    assert.deepEqual(master.connect.calls, [[c.destination]]);

    near(lastTarget(sfx.gain)[0], 0.8 * 0.9);
    assert.equal(lastTarget(sfx.gain)[2], 0.02);
    assert.equal(lastTarget(music.gain)[0], 0);
    assert.equal(lastTarget(music.gain)[2], 0.4);
  });

  it("fills the noise buffer with random samples mapped to -1..1", () => {
    const { c } = unlocked();
    const buf = kinds(c, "buffer")[0];
    assert.equal(buf.length, c.sampleRate);
    assert.equal(buf.sampleRate, c.sampleRate);
    assert.equal(buf.data[0], 0.75 * 2 - 1);
    assert.equal(buf.data[999], 0.5);
  });

  it("is a no-op when the browser provides no AudioContext, and keeps listening", () => {
    delete win.AudioContext;
    const audio = createAudio();
    audio.unlock();
    assert.equal(audio.state, "none");
    assert.equal(FakeAudioContext.instances.length, 0);
    assert.equal(globalThis.removeEventListener.calls.length, 0);
  });

  it("falls back to the webkit-prefixed AudioContext", () => {
    delete win.AudioContext;
    win.webkitAudioContext = FakeAudioContext;
    const audio = createAudio();
    audio.unlock();
    assert.equal(FakeAudioContext.instances.length, 1);
    assert.equal(audio.state, "running");
  });

  it("does nothing without a window object", () => {
    const saved = globalThis.window;
    delete globalThis.window;
    try {
      const audio = createAudio();
      audio.unlock();
      assert.equal(audio.state, "none");
      assert.equal(FakeAudioContext.instances.length, 0);
    } finally {
      globalThis.window = saved;
    }
  });

  it("creates the context only once and resumes it only when it has been suspended", () => {
    const { audio, c } = unlocked();
    audio.unlock();
    assert.equal(FakeAudioContext.instances.length, 1);
    assert.equal(c.resume.calls.length, 1);
    c.state = "suspended";
    audio.unlock();
    assert.equal(c.resume.calls.length, 2);
    assert.equal(audio.state, "running");
  });

  it("stays suspended while the page is hidden, and resumes on the next unlock once visible", () => {
    Object.defineProperty(doc, "hidden", { value: true, configurable: true });
    const audio = createAudio();
    audio.unlock();
    const c = ctx();
    assert.equal(c.resume.calls.length, 0);
    assert.equal(audio.state, "suspended");
    audio.unlock();
    assert.equal(c.resume.calls.length, 0);
    Object.defineProperty(doc, "hidden", { value: false, configurable: true });
    c.state = "suspended";
    audio.unlock();
    assert.equal(c.resume.calls.length, 1);
    assert.equal(audio.state, "running");
  });

  it("ignores a rejected resume and leaves the context suspended", () => {
    FakeAudioContext.rejectResume = true;
    const audio = createAudio();
    audio.unlock();
    assert.equal(audio.state, "suspended");
    audio.unlock(); // already unlocked: retries the resume, and the rejection is swallowed again
    assert.equal(ctx().resume.calls.length, 2);
    assert.equal(audio.state, "suspended");
  });

  it("auto-unlocks on the first pointer press and stops listening afterwards", () => {
    const audio = createAudio();
    doc.dispatchEvent(new win.Event("pointerdown", { bubbles: true }));
    assert.equal(FakeAudioContext.instances.length, 1);
    assert.equal(audio.state, "running");
    const removed = globalThis.removeEventListener.calls.map((c) => c[0]);
    assert.deepEqual(removed.sort(), ["keydown", "pointerdown"]);
    doc.dispatchEvent(new win.Event("pointerdown", { bubbles: true }));
    assert.equal(FakeAudioContext.instances.length, 1);
  });

  it("auto-unlocks on the first key press", () => {
    const audio = createAudio();
    doc.dispatchEvent(new win.Event("keydown", { bubbles: true }));
    assert.equal(FakeAudioContext.instances.length, 1);
    assert.equal(audio.state, "running");
  });

  it("keeps listening for a gesture when the context could not be created yet", () => {
    delete win.AudioContext;
    const audio = createAudio();
    doc.dispatchEvent(new win.Event("pointerdown", { bubbles: true }));
    assert.equal(globalThis.removeEventListener.calls.length, 0);
    win.AudioContext = FakeAudioContext;
    doc.dispatchEvent(new win.Event("pointerdown", { bubbles: true }));
    assert.equal(FakeAudioContext.instances.length, 1);
    assert.equal(audio.state, "running");
    assert.equal(globalThis.removeEventListener.calls.length, 2);
  });

  it("registers no global listeners when there is no document", () => {
    const savedDoc = globalThis.document;
    delete globalThis.document;
    try {
      createAudio();
      assert.equal(globalThis.addEventListener.calls.length, 0);
    } finally {
      globalThis.document = savedDoc;
    }
  });
});

describe("sound effects", () => {
  it("exposes the thirteen sound names", () => {
    assert.deepEqual(SOUND_NAMES, ["hit", "crit", "hurt", "windup", "slam", "dodge", "swing", "pickup", "coin", "door", "death", "boss", "ui"]);
  });

  it("plays every named sound, creating synth nodes for each", () => {
    const { audio, c } = unlocked();
    for (const name of SOUND_NAMES) {
      const before = c.made.length;
      audio.play(name);
      assert.ok(c.made.length > before, `${name} should create nodes`);
    }
  });

  it("does nothing for an unknown sound name", () => {
    const { audio, c } = unlocked();
    const before = c.made.length;
    audio.play("nope");
    assert.equal(c.made.length, before);
  });

  it("hit is a square-wave thump with a noise burst", () => {
    const { audio, c, sfx } = unlocked();
    audio.play("hit");
    const [osc] = kinds(c, "osc");
    assert.equal(osc.type, "square");
    assert.deepEqual(osc.frequency.setValueAtTime.calls[0], [220, 0]);
    assert.deepEqual(osc.frequency.exponentialRampToValueAtTime.calls[0], [90, 0.09]);
    assert.deepEqual(kinds(c, "gain").at(-1).connect.calls, [[sfx]]);
    assert.equal(count(c, "src"), 1);
    assert.equal(kinds(c, "filter")[0].type, "bandpass");
  });

  it("crit adds a delayed triangle chime on top of the thump", () => {
    const { audio, c } = unlocked();
    audio.play("crit");
    const oscs = kinds(c, "osc");
    assert.equal(oscs.length, 2);
    const chime = oscs.find((o) => o.type === "triangle");
    assert.deepEqual(chime.frequency.setValueAtTime.calls[0], [1320, 0.02]);
    assert.equal(chime.start.calls[0][0], 0.02);
    assert.equal(count(c, "src"), 1);
  });

  it("hurt uses a falling sawtooth and a lowpass noise", () => {
    const { audio, c } = unlocked();
    audio.play("hurt");
    assert.equal(kinds(c, "osc")[0].type, "sawtooth");
    assert.equal(kinds(c, "filter")[0].type, "lowpass");
  });

  it("windup sweeps two oscillators upward for the danger tone", () => {
    const { audio, c } = unlocked();
    audio.play("windup");
    const oscs = kinds(c, "osc");
    assert.deepEqual(oscs.map((o) => o.type), ["sawtooth", "square"]);
    assert.deepEqual(oscs[0].frequency.exponentialRampToValueAtTime.calls[0], [880, 0.32]);
  });

  it("pickup plays three rising triangle notes", () => {
    const { audio, c } = unlocked();
    audio.play("pickup");
    const oscs = kinds(c, "osc");
    assert.deepEqual(oscs.map((o) => o.type), ["triangle", "triangle", "triangle"]);
    assert.deepEqual(oscs.map((o) => o.frequency.setValueAtTime.calls[0][0]), [523, 659, 784]);
    assert.deepEqual(oscs.map((o) => o.start.calls[0][0]), [0, 0.07, 0.14]);
  });

  it("coin plays two square blips a fifth apart", () => {
    const { audio, c } = unlocked();
    audio.play("coin");
    const oscs = kinds(c, "osc");
    assert.deepEqual(oscs.map((o) => o.frequency.setValueAtTime.calls[0][0]), [988, 1319]);
    assert.equal(oscs[1].start.calls[0][0], 0.06);
  });

  it("slam, door, death and boss each layer tones with a noise or a low sweep", () => {
    const { audio, c } = unlocked();
    audio.play("slam");
    assert.equal(kinds(c, "osc")[0].frequency.exponentialRampToValueAtTime.calls[0][0], 35);
    assert.equal(kinds(c, "filter").at(-1).type, "lowpass");
    audio.play("door");
    assert.equal(count(c, "src"), 2);
    audio.play("death");
    audio.play("boss");
    const boss = kinds(c, "osc").slice(-3);
    assert.equal(boss[0].type, "sawtooth");
    assert.equal(boss[0].frequency.setValueAtTime.calls[0][0], 55);
  });

  it("dodge and swing are noise-only swooshes", () => {
    const { audio, c } = unlocked();
    audio.play("dodge");
    assert.equal(count(c, "osc"), 0);
    assert.deepEqual(kinds(c, "filter")[0].frequency.setValueAtTime.calls[0], [500, 0]);
    audio.play("swing");
    assert.equal(count(c, "osc"), 0);
    assert.equal(count(c, "src"), 2);
  });

  it("the ui blip is a short triangle glide", () => {
    const { audio, c } = unlocked();
    audio.play("ui");
    const [osc] = kinds(c, "osc");
    assert.equal(osc.type, "triangle");
    assert.deepEqual(osc.frequency.exponentialRampToValueAtTime.calls[0], [880, 0.07]);
  });

  it("starts noise at a random offset", () => {
    const { audio, c } = unlocked();
    audio.play("dodge");
    assert.deepEqual(kinds(c, "src")[0].start.calls[0], [0, 0.375]);
  });

  it("suppresses the same sound within 30 ms and plays it again after", () => {
    const { audio, c } = unlocked();
    c.currentTime = 1; // a last-play time of exactly 0 is treated as "never played" by the source
    audio.play("hit");
    const first = c.made.length;
    audio.play("hit");
    assert.equal(c.made.length, first);
    c.currentTime = 1.02;
    audio.play("hit");
    assert.equal(c.made.length, first);
    c.currentTime = 1.05;
    audio.play("hit");
    assert.ok(c.made.length > first);
  });

  it("does not debounce different sounds against each other", () => {
    const { audio, c } = unlocked();
    audio.play("hit");
    const afterHit = c.made.length;
    audio.play("swing");
    assert.ok(c.made.length > afterHit);
  });

  it("stays silent before unlock, while the context is not running, and while muted", () => {
    const audio = createAudio();
    audio.play("hit");
    assert.equal(FakeAudioContext.instances.length, 0);

    audio.unlock();
    const c = ctx();
    c.state = "suspended";
    const quiet = c.made.length;
    audio.play("hit");
    assert.equal(c.made.length, quiet);

    c.state = "running";
    audio.muted = true;
    audio.play("hit");
    assert.equal(c.made.length, quiet);

    audio.muted = false;
    audio.play("hit");
    assert.ok(c.made.length > quiet);
  });
});

describe("volume and mute", () => {
  it("setVolume scales the sfx and music buses and clamps to 0..1", () => {
    const { audio, sfx, music } = unlocked();
    audio.startMusic("hub");
    audio.setVolume("sfx", 0.5);
    near(lastTarget(sfx.gain)[0], 0.45);
    audio.setVolume("music", 1);
    near(lastTarget(music.gain)[0], 0.22);
    assert.equal(lastTarget(music.gain)[2], 0.1);
    audio.setVolume("sfx", 5);
    near(lastTarget(sfx.gain)[0], 0.9);
    audio.setVolume("sfx", -2);
    assert.equal(lastTarget(sfx.gain)[0], 0);
    audio.setVolume("sfx", "abc");
    assert.equal(lastTarget(sfx.gain)[0], 0);
    audio.setVolume("music", "0.5");
    near(lastTarget(music.gain)[0], 0.11);
  });

  it("volumes set before unlock apply when the graph is built", () => {
    const audio = createAudio();
    audio.setVolume("sfx", 0.5);
    audio.unlock();
    const [, sfx] = kinds(ctx(), "gain");
    near(sfx.gain.setTargetAtTime.calls[0][0], 0.45);
  });

  it("muting silences both buses and unmuting restores them", () => {
    const { audio, sfx, music } = unlocked();
    audio.startMusic("hub");
    audio.muted = true;
    assert.equal(audio.muted, true);
    assert.equal(lastTarget(sfx.gain)[0], 0);
    assert.equal(lastTarget(music.gain)[0], 0);
    audio.muted = 1;
    assert.equal(audio.muted, true);
    audio.muted = false;
    assert.equal(audio.muted, false);
    near(lastTarget(sfx.gain)[0], 0.72);
    near(lastTarget(music.gain)[0], 0.6 * 0.22);
  });

  it("mute and volume changes before unlock do not throw and apply at build", () => {
    const audio = createAudio();
    audio.muted = true;
    audio.setVolume("music", 0.2);
    audio.unlock();
    const [, sfx, music] = kinds(ctx(), "gain");
    assert.equal(lastTarget(sfx.gain)[0], 0);
    assert.equal(lastTarget(music.gain)[0], 0);
  });
});

describe("music", () => {
  it("startMusic accepts hub, combat and off, and treats anything else as off", () => {
    const audio = createAudio();
    audio.startMusic("hub");
    assert.equal(audio.mode, "hub");
    audio.startMusic("combat");
    assert.equal(audio.mode, "combat");
    audio.startMusic("off");
    assert.equal(audio.mode, "off");
    audio.startMusic("hub");
    audio.startMusic("jazz");
    assert.equal(audio.mode, "off");
  });

  it("a hub bar lays down 6 pad, 1 bass and 4 arpeggio oscillators, tuned to the chord", () => {
    const { audio, c } = unlocked();
    audio.startMusic("hub");
    const oscs = kinds(c, "osc");
    assert.equal(oscs.length, 11);
    assert.deepEqual([oscs[0].detune.value, oscs[1].detune.value], [-6, 6]);
    near(oscs[6].frequency.setValueAtTime.calls[0][0], mtof(45));
    near(oscs[6].frequency.setValueAtTime.calls[0][1], 0.1);
    near(oscs[7].frequency.setValueAtTime.calls[0][0], mtof(69));
    near(oscs[8].frequency.setValueAtTime.calls[0][0], mtof(72));
  });

  it("a combat bar is denser: every eighth note plus a sub-bass pulse", () => {
    const { audio, c } = unlocked();
    audio.startMusic("combat");
    const oscs = kinds(c, "osc");
    assert.equal(oscs.length, 19);
    near(oscs[10].frequency.setValueAtTime.calls[0][0], mtof(84));
    near(oscs[15].frequency.setValueAtTime.calls[0][0], mtof(33));
    near(oscs[15].frequency.exponentialRampToValueAtTime.calls[0][0], mtof(33) * 0.9);
  });

  it("combat bars are shorter, so the scheduler refills while the hub bar is still playing", () => {
    const combat = unlocked();
    combat.audio.startMusic("combat");
    const combatBefore = count(combat.c, "osc");
    combat.c.currentTime = 3.0;
    mock.timers.tick(150);
    assert.equal(count(combat.c, "osc") > combatBefore, true);

    const hub = unlocked();
    hub.audio.startMusic("hub");
    const hubBefore = count(hub.c, "osc");
    hub.c.currentTime = 3.0;
    mock.timers.tick(150);
    assert.equal(count(hub.c, "osc"), hubBefore);
  });

  it("switching music mode reschedules at the new tempo, and off stops scheduling", () => {
    const { audio, c, music } = unlocked();
    audio.startMusic("hub");
    assert.equal(count(c, "osc"), 11);
    audio.startMusic("combat");
    assert.equal(count(c, "osc"), 30);
    audio.startMusic("off");
    near(lastTarget(music.gain)[0], 0);
    assert.equal(lastTarget(music.gain)[2], 0.4);
    c.currentTime = 50;
    mock.timers.tick(150);
    assert.equal(count(c, "osc"), 30);
  });

  it("requesting the mode already playing changes nothing", () => {
    const { audio, c, music } = unlocked();
    audio.startMusic("hub");
    const targets = music.gain.setTargetAtTime.calls.length;
    const oscs = count(c, "osc");
    audio.startMusic("hub");
    assert.equal(music.gain.setTargetAtTime.calls.length, targets);
    assert.equal(count(c, "osc"), oscs);
  });

  it("music requested before unlock starts on the first timer tick after unlock", () => {
    const audio = createAudio();
    audio.startMusic("hub");
    assert.equal(audio.mode, "hub");
    audio.unlock();
    const c = ctx();
    assert.equal(count(c, "osc"), 0);
    mock.timers.tick(150);
    assert.equal(count(c, "osc"), 11);
  });

  it("the scheduler stays idle while the context is not running", () => {
    const { audio, c } = unlocked();
    audio.startMusic("hub");
    const oscs = count(c, "osc");
    c.state = "suspended";
    c.currentTime = 10;
    mock.timers.tick(150);
    assert.equal(count(c, "osc"), oscs);
  });

  it("the scheduler resynchronises after the clock jumps forward", () => {
    const { audio, c } = unlocked();
    audio.startMusic("hub");
    const oscs = count(c, "osc");
    c.currentTime = 100;
    mock.timers.tick(150);
    assert.equal(count(c, "osc"), oscs + 11);
  });

  it("the scheduler keeps about half a second of music queued ahead of the clock", () => {
    const { audio, c } = unlocked();
    audio.startMusic("hub");
    c.currentTime = 4.2;
    mock.timers.tick(150);
    assert.equal(count(c, "osc"), 22);
    c.currentTime = 4.3;
    mock.timers.tick(150);
    assert.equal(count(c, "osc"), 22);
  });
});

describe("page visibility", () => {
  it("suspends the context when the page is hidden and resumes when it is shown again", () => {
    const { c } = unlocked();
    Object.defineProperty(doc, "hidden", { value: true, configurable: true });
    doc.dispatchEvent(new win.Event("visibilitychange"));
    assert.equal(c.suspend.calls.length, 1);
    assert.equal(c.state, "suspended");
    Object.defineProperty(doc, "hidden", { value: false, configurable: true });
    doc.dispatchEvent(new win.Event("visibilitychange"));
    assert.equal(c.resume.calls.length, 2);
    assert.equal(c.state, "running");
  });

  it("ignores visibility changes before any context exists", () => {
    createAudio();
    Object.defineProperty(doc, "hidden", { value: true, configurable: true });
    doc.dispatchEvent(new win.Event("visibilitychange"));
    assert.equal(FakeAudioContext.instances.length, 0);
  });

  it("swallows a rejected suspend or resume", () => {
    const { c } = unlocked();
    FakeAudioContext.rejectSuspend = true;
    Object.defineProperty(doc, "hidden", { value: true, configurable: true });
    doc.dispatchEvent(new win.Event("visibilitychange"));
    assert.equal(c.suspend.calls.length, 1);
    assert.equal(c.state, "running"); // the rejected suspend changed nothing
    FakeAudioContext.rejectSuspend = false;
    FakeAudioContext.rejectResume = true;
    Object.defineProperty(doc, "hidden", { value: false, configurable: true });
    doc.dispatchEvent(new win.Event("visibilitychange"));
    assert.equal(c.resume.calls.length, 2);
    assert.equal(c.state, "running");
  });

  it("does not resume a context whose graph failed to build", () => {
    FakeAudioContext.failBuild = true;
    const audio = createAudio();
    assert.throws(() => audio.unlock(), TypeError);
    const c = ctx();
    assert.equal(audio.state, "suspended");
    doc.dispatchEvent(new win.Event("visibilitychange"));
    assert.equal(c.resume.calls.length, 0);
  });
});
