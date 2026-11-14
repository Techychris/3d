// Meta progress, run state and save codes. Pure logic, no three.js.
import { hashString } from "../core/rng.js";
import { CLASS_IDS, classOf } from "./classes.js";

const KEY = "dusk-roguelite-v1";
const SAVE_VERSION = 1;
export const VIGOR_MAX = 2;
export const VIGOR_COSTS = [30, 60];

export const ENDINGS = [
  { id: "spire", name: "Reached the spire's heart", how: "Beat the Necromancer" },
  { id: "untouched", name: "Untouched by dusk", how: "Win a run without taking a hit" },
  { id: "daily", name: "Dawn of a new day", how: "Win the daily seed run" },
];

export function defaultSettings() {
  return { quality: "auto", shake: true, flashes: true, blur: true, music: 0.6, sfx: 0.8, screenRelative: true };
}
export function defaultMeta() {
  return { currency: 0, upgrades: { vigor: 0 }, endings: [], codex: [], cls: "warrior", runsStarted: 0, runsWon: 0, settings: defaultSettings() };
}

// In-memory fallback (also the only store in node or when storage is blocked).
const mem = { meta: null, run: null };
function store() { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; } }
function readBlob() {
  let raw = null;
  try { const s = store(); if (s) raw = s.getItem(KEY); } catch (e) { raw = null; }
  if (raw) { try { const o = JSON.parse(raw); if (o && typeof o === "object") return o; } catch (e) { /* ignore */ } }
  return { meta: mem.meta, run: mem.run };
}
function writeBlob(blob) {
  mem.meta = blob.meta; mem.run = blob.run;
  try { const s = store(); if (s) s.setItem(KEY, JSON.stringify(blob)); } catch (e) { /* storage blocked: memory only */ }
}

const num = (v, d, lo = -Infinity, hi = Infinity) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const bool = (v, d) => (typeof v === "boolean" ? v : d);
const strs = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string") : []);

export function normalizeMeta(m) {
  const d = defaultMeta();
  if (!m || typeof m !== "object") return d;
  const s = m.settings && typeof m.settings === "object" ? m.settings : {};
  return {
    currency: Math.floor(num(m.currency, 0, 0)),
    upgrades: { vigor: Math.floor(num(m.upgrades && m.upgrades.vigor, 0, 0, VIGOR_MAX)) },
    endings: strs(m.endings), codex: strs(m.codex), cls: CLASS_IDS.includes(m.cls) ? m.cls : "warrior",
    runsStarted: Math.floor(num(m.runsStarted, 0, 0)), runsWon: Math.floor(num(m.runsWon, 0, 0)),
    settings: {
      quality: ["auto", "low", "medium", "high"].includes(s.quality) ? s.quality : d.settings.quality,
      shake: bool(s.shake, true), flashes: bool(s.flashes, true), blur: bool(s.blur, true),
      music: num(s.music, 0.6, 0, 1), sfx: num(s.sfx, 0.8, 0, 1), screenRelative: bool(s.screenRelative, true),
    },
  };
}
const ROOM_KINDS = ["combat", "elite", "treasure", "rest"];
function normalizeRun(r) {
  if (!r || typeof r !== "object") return null;
  if (!(typeof r.seed === "string" || typeof r.seed === "number")) return null;
  if (!Array.isArray(r.items)) return null;
  return {
    seed: r.seed, floor: Math.floor(num(r.floor, 1, 1, 3)), room: Math.floor(num(r.room, 0, 0, 99)),
    items: strs(r.items), runCurrency: Math.floor(num(r.runCurrency, 0, 0)),
    hp: r.hp === null || r.hp === undefined ? null : num(r.hp, null, 0),
    hero: typeof r.hero === "string" ? r.hero : "hero-warrior", cls: CLASS_IDS.includes(r.cls) ? r.cls : "warrior",
    startedAt: num(r.startedAt, 0),
    daily: !!r.daily, hitsTaken: Math.floor(num(r.hitsTaken, 0, 0)), embers: Math.floor(num(r.embers, 0, 0)),
    roomType: ROOM_KINDS.includes(r.roomType) ? r.roomType : "combat", path: strs(r.path).filter((t) => ROOM_KINDS.includes(t)).slice(0, 12),
  };
}

export function loadMeta() { return normalizeMeta(readBlob().meta); }
export function saveMeta(meta) { writeBlob({ meta: normalizeMeta(meta), run: readBlob().run || null }); }
export function loadRun() { return normalizeRun(readBlob().run); }
export function saveRun(run) { writeBlob({ meta: readBlob().meta || null, run: normalizeRun(run) }); }
export function clearRun() { writeBlob({ meta: readBlob().meta || null, run: null }); }
// Wipes everything (memory and storage). Used by tests and a possible "reset" button.
export function resetProgress() {
  mem.meta = null; mem.run = null;
  try { const s = store(); if (s) s.removeItem(KEY); } catch (e) { /* ignore */ }
}

export function newRun(seed, cls = "warrior") {
  return { seed, floor: 1, room: 0, items: [], runCurrency: 0, hp: null, hero: classOf(cls).hero, cls: classOf(cls).id, startedAt: Date.now(), daily: false, hitsTaken: 0, embers: 0, roomType: "combat", path: [] };
}

export function upgradeCost(meta, which) {
  if (which !== "vigor") return null;
  const lvl = (meta && meta.upgrades && meta.upgrades.vigor) | 0;
  return lvl >= VIGOR_MAX ? null : VIGOR_COSTS[Math.max(0, lvl)];
}

// Which endings does a finished run earn? ctx: {won, bossId, hitsTaken, daily}
export function endingsEarned(ctx) {
  const out = [];
  if (!ctx || !ctx.won) return out;
  if (ctx.bossId === undefined || ctx.bossId === "necromancer") out.push("spire");
  if (ctx.hitsTaken === 0) out.push("untouched");
  if (ctx.daily) out.push("daily");
  return out;
}

// ---- save codes ----
const BAD = "That code doesn't match a save.";
function checksum(str) { return hashString("dusk|" + str).toString(36); }
function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromB64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function encodeSave(meta, run) {
  const data = JSON.stringify({ meta: normalizeMeta(meta), run: normalizeRun(run) });
  return toB64(JSON.stringify({ v: SAVE_VERSION, d: data, c: checksum(data) }));
}

export function decodeSave(code) {
  try {
    if (typeof code !== "string") throw new Error(BAD);
    const env = JSON.parse(fromB64(code.trim()));
    if (!env || env.v !== SAVE_VERSION || typeof env.d !== "string" || env.c !== checksum(env.d)) throw new Error(BAD);
    const o = JSON.parse(env.d);
    if (!o || typeof o !== "object" || !o.meta || typeof o.meta !== "object") throw new Error(BAD);
    const run = o.run === null || o.run === undefined ? null : normalizeRun(o.run);
    if (o.run && !run) throw new Error(BAD);
    return { meta: normalizeMeta(o.meta), run };
  } catch (e) {
    throw new Error(BAD);
  }
}
