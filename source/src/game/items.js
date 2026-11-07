// Items, tags and derived stats. Pure logic, no three.js.

export const TAGS = {
  fire:   { name: "Fire",   two: "hits burn",                three: "burning foes spread flames" },
  frost:  { name: "Frost",  two: "hits chill",               three: "every 4th hit freezes" },
  bleed:  { name: "Bleed",  two: "crits make foes bleed",    three: "bleeding foes take more damage" },
  crit:   { name: "Crit",   two: "+10% crit chance",         three: "crits hit much harder" },
  shield: { name: "Shield", two: "start each room shielded", three: "dodging refills your shield" },
  speed:  { name: "Speed",  two: "move faster",              three: "dodge recovers sooner" },
  summon: { name: "Summon", two: "a spirit fights beside you", three: "two spirits fight beside you" },
};

export const ITEMS = [
  // Fire
  { id: "ember-blade", name: "Ember Blade", tags: ["fire"], desc: "A sword that never quite cools after sunset.", mods: { damage: 2 } },
  { id: "candle-stub", name: "Candle Stub", tags: ["fire"], desc: "Its small flame steadies your hand.", mods: { attackRate: 0.2 } },
  { id: "ash-cloak", name: "Ash Cloak", tags: ["fire"], desc: "Warm soot on the shoulders, warmer blood beneath.", mods: { maxHp: 10 } },
  { id: "kindling-charm", name: "Kindling Charm", tags: ["fire"], desc: "A bundle of twigs that hums when you swing.", mods: { damage: 1, attackRate: 0.1 } },
  // Frost
  { id: "rime-ring", name: "Rime Ring", tags: ["frost"], desc: "Frost blooms on it whenever danger is near.", mods: { damage: 2 } },
  { id: "winter-lantern", name: "Winter Lantern", tags: ["frost"], desc: "Pale light that makes breath visible.", mods: { maxHp: 10 } },
  { id: "icicle-pin", name: "Icicle Pin", tags: ["frost"], desc: "Never melts, never dulls.", mods: { critChance: 0.04 } },
  { id: "snowglass-lens", name: "Snowglass Lens", tags: ["frost"], desc: "Everything looks slower through it.", mods: { attackRate: 0.2 } },
  // Bleed
  { id: "thorn-glove", name: "Thorn Glove", tags: ["bleed"], desc: "Gripping it is a small, steady mistake.", mods: { damage: 2 } },
  { id: "red-thread", name: "Red Thread", tags: ["bleed"], desc: "Tied around a finger, it tugs toward wounds.", mods: { attackRate: 0.2 } },
  { id: "hooked-knife", name: "Hooked Knife", tags: ["bleed"], desc: "Made for cutting rope, repurposed.", mods: { critChance: 0.04 } },
  { id: "cranberry-flask", name: "Cranberry Flask", tags: ["bleed"], desc: "Tart, sticky, oddly invigorating.", mods: { maxHp: 10 } },
  // Crit
  { id: "lucky-coin", name: "Lucky Coin", tags: ["crit"], desc: "Always lands on its edge.", mods: { critChance: 0.04 } },
  { id: "keen-whetstone", name: "Keen Whetstone", tags: ["crit"], desc: "Hone it by lantern light and the edge sings.", mods: { damage: 2 } },
  { id: "owl-feather", name: "Owl Feather", tags: ["crit"], desc: "You notice the gap before it opens.", mods: { critChance: 0.03, moveSpeed: 0.1 } },
  { id: "gilded-monocle", name: "Gilded Monocle", tags: ["crit"], desc: "A scholar's eye for weak joints.", mods: { critMult: 0.1 } },
  // Shield
  { id: "oak-buckler", name: "Oak Buckler", tags: ["shield"], desc: "Old wood that remembers being a tree.", mods: { maxHp: 10 } },
  { id: "moss-mantle", name: "Moss Mantle", tags: ["shield"], desc: "Soft, damp and surprisingly sturdy.", mods: { maxHp: 15 } },
  { id: "pewter-boss", name: "Pewter Boss", tags: ["shield"], desc: "A dented shield stud that rings like a bell.", mods: { damage: 1, maxHp: 5 } },
  { id: "hearth-stone", name: "Hearth Stone", tags: ["shield"], desc: "Carried from a kitchen that once felt safe.", mods: { maxHp: 12 } },
  // Speed
  { id: "swift-boots", name: "Swift Boots", tags: ["speed"], desc: "The soles are worn thin from happy miles.", mods: { moveSpeed: 0.3 } },
  { id: "dusk-ribbon", name: "Dusk Ribbon", tags: ["speed"], desc: "Trails behind you like a held breath.", mods: { moveSpeed: 0.3 } },
  { id: "hare-foot", name: "Hare's Foot", tags: ["speed"], desc: "Luck, but mostly legs.", mods: { dodgeCooldown: -0.05 } },
  { id: "quick-quill", name: "Quick Quill", tags: ["speed"], desc: "Your strikes come as fast as handwriting.", mods: { attackRate: 0.2 } },
  // Summon
  { id: "moth-lantern", name: "Moth Lantern", tags: ["summon"], desc: "Something small keeps you company.", mods: { maxHp: 10 } },
  { id: "bone-whistle", name: "Bone Whistle", tags: ["summon"], desc: "It plays a tune only the dead hear.", mods: { damage: 1, attackRate: 0.1 } },
  { id: "hollow-acorn", name: "Hollow Acorn", tags: ["summon"], desc: "Rattles with a tiny, loyal ghost.", mods: { moveSpeed: 0.2 } },
  { id: "thimble-of-echoes", name: "Thimble of Echoes", tags: ["summon"], desc: "Every swing is answered by a whisper.", mods: { damage: 2 } },
  // Two-tag items
  { id: "smoldering-fang", name: "Smoldering Fang", tags: ["fire", "bleed"], desc: "Cauterizes and cuts in the same breath.", mods: { damage: 2 } },
  { id: "glacier-needle", name: "Glacier Needle", tags: ["frost", "crit"], desc: "A single perfect point of cold.", mods: { critChance: 0.04 } },
  { id: "storm-heel", name: "Stormheel Spurs", tags: ["speed", "crit"], desc: "Strike while the thunder is still gathering.", mods: { moveSpeed: 0.3, critChance: 0.02 } },
  { id: "frostbound-ward", name: "Frostbound Ward", tags: ["frost", "shield"], desc: "A shell of ice that hums lullabies.", mods: { maxHp: 10 } },
  { id: "ember-familiar", name: "Ember Familiar", tags: ["summon", "fire"], desc: "A tiny flame with opinions.", mods: { damage: 1, maxHp: 5 } },
  { id: "warden-shade", name: "Warden's Shade", tags: ["summon", "shield"], desc: "A patient shadow stands between you and harm.", mods: { maxHp: 8 } },
  { id: "rose-gambit", name: "Rose Gambit", tags: ["bleed", "speed"], desc: "Pretty, quick, and thorned.", mods: { attackRate: 0.2 } },
];

export const BASE_STATS = { maxHp: 100, damage: 10, attackRate: 2.2, moveSpeed: 4.2, critChance: 0.05, critMult: 1.5, dodgeCooldown: 0.8 };

const BY_ID = new Map(ITEMS.map((it) => [it.id, it]));
export function getItem(id) { return BY_ID.get(id) || null; }
const r4 = (x) => Math.round(x * 1e4) / 1e4;

export function tagCounts(itemIds) {
  const out = {};
  for (const id of itemIds || []) {
    const it = BY_ID.get(id);
    if (!it) continue;
    for (const t of it.tags) out[t] = (out[t] || 0) + 1;
  }
  return out;
}

export function computeStats(itemIds, meta) {
  const s = Object.assign({}, BASE_STATS, {
    burnPct: 0, burnSpread: false, slowPct: 0, freezeEvery: 0, bleedPct: 0, bleedAmp: 0,
    roomShield: 0, shieldOnDodge: false, summons: 0,
  });
  for (const id of itemIds || []) {
    const it = BY_ID.get(id);
    if (!it) continue;
    for (const k of Object.keys(it.mods)) s[k] = (s[k] || 0) + it.mods[k];
  }
  const c = tagCounts(itemIds);
  const n = (t) => c[t] || 0;
  if (n("fire") >= 2) s.burnPct = 0.10;
  if (n("fire") >= 3) s.burnSpread = true;
  if (n("frost") >= 2) s.slowPct = 0.2;
  if (n("frost") >= 3) s.freezeEvery = 4;
  if (n("bleed") >= 2) s.bleedPct = 0.15;
  if (n("bleed") >= 3) s.bleedAmp = 0.15;
  if (n("crit") >= 2) s.critChance += 0.10;
  if (n("crit") >= 3) s.critMult += 0.5;
  if (n("shield") >= 2) s.roomShield = 0.15;
  if (n("shield") >= 3) s.shieldOnDodge = true;
  if (n("speed") >= 2) s.moveSpeed *= 1.1;
  if (n("speed") >= 3) s.dodgeCooldown *= 0.7;
  if (n("summon") >= 2) s.summons = 1;
  if (n("summon") >= 3) s.summons = 2;
  const vigor = Math.max(0, Math.min(2, (meta && meta.upgrades && meta.upgrades.vigor) | 0));
  s.maxHp = Math.round(s.maxHp * (1 + 0.05 * vigor));
  s.dodgeCooldown = Math.max(0.2, s.dodgeCooldown);
  s.critChance = Math.min(1, s.critChance);
  for (const k of Object.keys(s)) if (typeof s[k] === "number") s[k] = r4(s[k]);
  return s;
}

// Does taking `item` bring any tag to 2 or 3 owned?
function comboTags(item, counts) {
  return item.tags.filter((t) => { const after = (counts[t] || 0) + 1; return after === 2 || after === 3; });
}

export function rollShrine(rng, ownedIds, n = 3) {
  const owned = new Set(ownedIds || []);
  const counts = tagCounts(ownedIds);
  const pool = ITEMS.filter((it) => !owned.has(it.id)).map((it) => ({ id: it.id, w: 1 + (comboTags(it, counts).length ? 0.5 : 0) }));
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((a, p) => a + p.w, 0);
    let x = rng() * total, idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) { x -= pool[i].w; if (x < 0) { idx = i; break; } }
    out.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return out;
}

const pct = (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
const sign = (v) => (v > 0 ? "+" : "") + (Math.round(v * 100) / 100);
// Plain-language effect line built from an item's mods, so cards say what they do.
export function effectText(mods) {
  const out = [];
  for (const [k, v] of Object.entries(mods || {})) {
    if (k === "damage") out.push(`${sign(v)} damage`);
    else if (k === "maxHp") out.push(`${sign(v)} max health`);
    else if (k === "attackRate") out.push(`${pct(v / BASE_STATS.attackRate)} attack speed`);
    else if (k === "moveSpeed") out.push(`${pct(v / BASE_STATS.moveSpeed)} move speed`);
    else if (k === "critChance") out.push(`${pct(v)} crit chance`);
    else if (k === "critMult") out.push(`${pct(v)} crit damage`);
    else if (k === "dodgeCooldown") out.push(`${sign(v)}s dodge cooldown`);
    else out.push(`${k} ${sign(v)}`);
  }
  return out.join(", ");
}

export function describeCard(itemId, ownedIds) {
  const it = BY_ID.get(itemId);
  if (!it) return null;
  const owned = ownedIds || [];
  const counts = tagCounts(owned);
  const combo = comboTags(it, counts);
  let pairsWith = null;
  const pairTags = combo.length ? combo : it.tags;
  for (const oid of owned) {
    const o = BY_ID.get(oid);
    if (o && o.id !== it.id && o.tags.some((t) => pairTags.includes(t))) { pairsWith = o.name; break; }
  }
  let bonusNote = null;
  if (combo.length) {
    const best = combo.reduce((a, b) => ((counts[b] || 0) > (counts[a] || 0) ? b : a));
    const after = (counts[best] || 0) + 1;
    bonusNote = `${TAGS[best].name} ×${after}: ${after >= 3 ? TAGS[best].three : TAGS[best].two}`;
  }
  return {
    id: it.id, name: it.name,
    tags: it.tags.map((t) => ({ id: t, name: TAGS[t].name, owned: (counts[t] || 0) > 0 })),
    desc: it.desc, effect: effectText(it.mods), pairsWith, bonusNote,
  };
}
