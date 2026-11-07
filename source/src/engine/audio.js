// Module F: audio. Pure WebAudio synthesis.
export const SOUND_NAMES = ["hit", "crit", "hurt", "windup", "slam", "dodge", "swing", "pickup", "coin", "door", "death", "boss", "ui"];

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// A minor-ish dusk loop: Am, Fmaj7, Dm, Em (MIDI roots / chord tones)
const PROG = [
  { bass: 45, pad: [57, 60, 64], arp: [69, 72, 76, 72] },
  { bass: 41, pad: [57, 60, 65], arp: [65, 69, 72, 69] },
  { bass: 38, pad: [57, 62, 65], arp: [62, 65, 69, 65] },
  { bass: 40, pad: [55, 59, 64], arp: [64, 67, 71, 67] },
];

export function createAudio() {
  let ctx = null, master = null, sfxGain = null, musicGain = null, noiseBuf = null;
  let sfxVol = 0.8, musicVol = 0.6;
  let muted = false, unlocked = false;
  let mode = "off";
  let timer = null;
  let nextBar = 0, barIdx = 0;
  const BASE_MUSIC = 0.22, BASE_SFX = 0.9;

  function build() {
    const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 6;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9;
    sfxGain = ctx.createGain(); musicGain = ctx.createGain();
    sfxGain.connect(comp); musicGain.connect(comp); comp.connect(master); master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    return true;
  }

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxGain.gain.setTargetAtTime(muted ? 0 : sfxVol * BASE_SFX, t, 0.02);
    musicGain.gain.setTargetAtTime(muted ? 0 : musicVol * BASE_MUSIC * (mode === "off" ? 0 : 1), t, mode === "off" ? 0.4 : 0.1);
  }

  // ---- synth helpers
  function tone(o) {
    const t0 = (o.at ?? ctx.currentTime);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
    const a = o.attack ?? 0.005, v = o.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(o.dest || sfxGain);
    osc.start(t0); osc.stop(t0 + o.dur + 0.03);
  }
  function noise(o) {
    const t0 = (o.at ?? ctx.currentTime);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.ftype || "bandpass";
    f.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + o.dur + 0.03);
  }

  const SOUNDS = {
    hit() { noise({ f0: 1800, f1: 500, dur: 0.09, vol: 0.4, q: 0.8 }); tone({ type: "square", f0: 220, f1: 90, dur: 0.09, vol: 0.2 }); },
    crit() {
      noise({ f0: 3000, f1: 800, dur: 0.14, vol: 0.45, q: 0.8 });
      tone({ type: "square", f0: 330, f1: 110, dur: 0.12, vol: 0.22 });
      tone({ type: "triangle", f0: 1320, f1: 1980, dur: 0.18, vol: 0.2, at: ctx.currentTime + 0.02 });
    },
    hurt() { tone({ type: "sawtooth", f0: 260, f1: 70, dur: 0.28, vol: 0.32 }); noise({ f0: 600, f1: 200, dur: 0.2, vol: 0.3, ftype: "lowpass" }); },
    windup() { // rising danger tone, ~0.3 s
      tone({ type: "sawtooth", f0: 220, f1: 880, dur: 0.32, vol: 0.2, attack: 0.04 });
      tone({ type: "square", f0: 223, f1: 892, dur: 0.32, vol: 0.08, attack: 0.04 });
    },
    slam() { tone({ type: "sine", f0: 120, f1: 35, dur: 0.4, vol: 0.7 }); noise({ f0: 900, f1: 80, dur: 0.35, vol: 0.5, ftype: "lowpass" }); },
    dodge() { noise({ f0: 500, f1: 2600, dur: 0.18, vol: 0.28, q: 1.5 }); },
    swing() { noise({ f0: 1200, f1: 3200, dur: 0.12, vol: 0.2, q: 2 }); },
    pickup() { const t = ctx.currentTime; [523, 659, 784].forEach((f, i) => tone({ type: "triangle", f0: f, dur: 0.22, vol: 0.25, at: t + i * 0.07 })); },
    coin() { const t = ctx.currentTime; tone({ type: "square", f0: 988, dur: 0.06, vol: 0.14 }); tone({ type: "square", f0: 1319, dur: 0.16, vol: 0.14, at: t + 0.06 }); },
    door() { tone({ type: "sine", f0: 70, f1: 140, dur: 0.6, vol: 0.4, attack: 0.1 }); tone({ type: "triangle", f0: 280, f1: 560, dur: 0.5, vol: 0.12, attack: 0.15 }); noise({ f0: 300, f1: 900, dur: 0.5, vol: 0.12, q: 0.6 }); },
    death() { tone({ type: "sawtooth", f0: 330, f1: 40, dur: 1.0, vol: 0.32, attack: 0.02 }); tone({ type: "sine", f0: 165, f1: 30, dur: 1.2, vol: 0.4 }); },
    boss() { const t = ctx.currentTime; tone({ type: "sawtooth", f0: 55, f1: 49, dur: 1.0, vol: 0.35, attack: 0.1 }); tone({ type: "square", f0: 110, f1: 98, dur: 0.9, vol: 0.12, attack: 0.1, at: t + 0.05 }); tone({ type: "sine", f0: 82, dur: 1.1, vol: 0.4, attack: 0.15 }); },
    ui() { tone({ type: "triangle", f0: 660, f1: 880, dur: 0.07, vol: 0.18 }); },
  };

  const lastPlay = {};
  function play(name) {
    if (!ctx || !unlocked || muted || ctx.state !== "running") return;
    const fn = SOUNDS[name];
    if (!fn) return;
    const now = ctx.currentTime;
    if (now - (lastPlay[name] || -1) < 0.03) return; // avoid stacking identical sounds
    lastPlay[name] = now;
    fn();
  }

  // ---- music: one scheduler, notes are short self-stopping oscillators
  function scheduleBar(t0) {
    const ch = PROG[barIdx % PROG.length];
    const combat = mode === "combat";
    const beat = combat ? 0.4 : 0.55; // seconds per eighth
    const barLen = beat * 8;
    for (const m of ch.pad) {
      for (const det of [-6, 6]) {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = "triangle"; osc.frequency.value = mtof(m); osc.detune.value = det;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.05, t0 + barLen * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t0 + barLen + 0.2);
        osc.connect(g); g.connect(musicGain);
        osc.start(t0); osc.stop(t0 + barLen + 0.25);
      }
    }
    tone({ type: "sine", f0: mtof(ch.bass), dur: barLen, vol: 0.14, attack: 0.3, at: t0, dest: musicGain });
    for (let i = 0; i < 8; i++) {
      if (!combat && i % 2 === 1) continue;
      const m = ch.arp[(i >> (combat ? 0 : 1)) % 4] + (combat && i % 4 === 3 ? 12 : 0);
      tone({ type: "sine", f0: mtof(m), dur: beat * 1.8, vol: combat ? 0.07 : 0.06, attack: 0.01, at: t0 + i * beat, dest: musicGain });
    }
    if (combat) for (let i = 0; i < 8; i += 2) tone({ type: "sine", f0: mtof(ch.bass - 12), f1: mtof(ch.bass - 12) * 0.9, dur: beat * 0.9, vol: 0.12, at: t0 + i * beat, dest: musicGain });
    barIdx++;
    return barLen;
  }

  function tick() {
    if (!ctx || ctx.state !== "running" || mode === "off") return;
    const now = ctx.currentTime;
    if (nextBar < now) nextBar = now + 0.05;
    while (nextBar < now + 0.5) nextBar += scheduleBar(nextBar);
  }

  function ensureTimer() {
    if (!timer) timer = setInterval(tick, 150);
  }

  function startMusic(m) {
    if (m !== "hub" && m !== "combat" && m !== "off") m = "off";
    if (m === mode) return;
    mode = m;
    if (ctx) {
      applyVolumes();
      if (m !== "off") { nextBar = ctx.currentTime + 0.1; tick(); }
    }
  }

  function onVisibility() {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (unlocked) ctx.resume().catch(() => {});
  }

  function unlock() {
    if (unlocked) { if (ctx && ctx.state === "suspended" && !document.hidden) ctx.resume().catch(() => {}); return; }
    if (!ctx && !build()) return;
    unlocked = true;
    if (!document.hidden) ctx.resume().catch(() => {});
    ensureTimer();
    if (mode !== "off") { applyVolumes(); nextBar = ctx.currentTime + 0.1; }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
    const once = () => { unlock(); if (unlocked) { removeEventListener("pointerdown", once, true); removeEventListener("keydown", once, true); } };
    addEventListener("pointerdown", once, true);
    addEventListener("keydown", once, true);
  }

  return {
    play,
    unlock,
    startMusic,
    setVolume(kind, v) {
      v = Math.max(0, Math.min(1, +v || 0));
      if (kind === "music") musicVol = v; else sfxVol = v;
      applyVolumes();
    },
    get muted() { return muted; },
    set muted(v) { muted = !!v; applyVolumes(); },
    get state() { return ctx ? ctx.state : "none"; }, // addition (debug)
    get mode() { return mode; },                       // addition
  };
}
