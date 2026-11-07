import { createUI } from "../src/ui/ui.js";
const ui = createUI(document.getElementById("app"));
const s = new URLSearchParams(location.search).get("s") || "hub";
const noop = () => {};
// options whose on* callbacks announce themselves (so a keyboard press visibly does something)
const live = (o = {}) => new Proxy(o, { get: (t, k) => (k in t ? t[k] : typeof k === "string" && k.startsWith("on") ? () => ui.toast(k) : undefined), has: () => true });
const cards = [
  { id: "a", name: "Ember Blade", tags: [{ id: "fire", name: "Fire", owned: true }, { id: "crit", name: "Crit", owned: false }], desc: "+3 damage. Your hits leave a lingering burn.", pairsWith: "Cinder Ring", bonusNote: "Fire x2: hits burn", combo: true },
  { id: "b", name: "Frostbound Greaves", tags: [{ id: "frost", name: "Frost", owned: false }, { id: "speed", name: "Speed", owned: false }], desc: "+8% move speed. Chilled enemies move slower for a short while.", pairsWith: null, bonusNote: null },
  { id: "c", name: "Bulwark of Long Nights", tags: [{ id: "shield", name: "Shield", owned: true }], desc: "Start each room with a small shield. Dodging at the last moment refills it.", pairsWith: "Warden's Charm", bonusNote: "Shield x2: room shield 15%" },
];
const hudData = { hp: 62, maxHp: 110, shield: 20, tags: { fire: 2, crit: 1, shield: 3 }, currency: 134, floor: 2, room: 3, rooms: 6, saved: true, boss: s === "hud" ? { name: "Stone Golem", hp: 310, maxHp: 450 } : null, skillCd: 3.2, skillMax: 7, dodgeCd: 0, dodgeMax: 0.8 };
const entries = Array.from({ length: 9 }, (_, i) => ({ name: "Relic " + (i + 1), tags: ["fire", "crit"].slice(0, 1 + (i % 2)), desc: "A short description of what this relic does.", seen: i % 3 !== 2 }));
const settings = { quality: "auto", shake: true, flashes: true, blur: false, music: 0.6, sfx: 0.8, screenRelative: true };
({
  hub: () => ui.showHub({ currency: 134, endings: ["spire"], upgrades: { vigor: 1 } }, live({ upgradeCost: 100 })),
  hud: () => { document.body.style.background = "linear-gradient(#1a1030,#3a2455 60%,#0c0818)"; ui.hud.show(true); ui.hud.onPause(() => ui.toast("Paused")); ui.hud.update(hudData); ui.toast("Run saved"); },
  shrine: () => ui.showShrine(cards, live({ rerollCost: 25, canReroll: true })),
  recap: () => ui.showRecap({ won: false, killer: "Skeleton grunt", tip: "Skeletons swing in an arc: step out of the red arc, then strike.", floor: 2, room: 3, itemsLost: ["Ember Blade", "Cinder Ring"], currencyKept: 42, endingsNew: [] }, live({})),
  settings: () => ui.showSettings(settings, live({ onCopyCode: () => "abc", onLoadCode: () => ({ ok: true, message: "Loaded." }) })),
  codex: () => ui.showCodex(entries, live({})),
  pause: () => ui.showPause(live({})),
  rotate: () => ui.showRotate(true),
})[s]();
