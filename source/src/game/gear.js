// Gear and consumables. Pure logic, no three.js. A piece of gear is stored as "<base id>:<rarity>" (for example
// "iron-sword:rare"), so a save only holds strings.
import { effectText } from "./items.js";

export const SLOTS = ["weapon", "armour", "trinket"];
export const SLOT_NAMES = { weapon: "Weapon", armour: "Armour", trinket: "Trinket" };
export const RARITIES = { common: { name: "Common", mul: 1 }, rare: { name: "Rare", mul: 1.6 }, epic: { name: "Epic", mul: 2.4 } };
export const BAG_SIZE = 8, MAX_CONSUMABLE = 3, SCRAP_EMBERS = 10;

// Base pieces: mods are the common values; rarer copies multiply them.
export const GEAR = {
  "iron-sword": { name: "Iron Sword", slot: "weapon", mods: { damage: 3 } },
  "duelist-blade": { name: "Duelist's Blade", slot: "weapon", mods: { attackRate: 0.3, critChance: 0.03 } },
  "war-hammer": { name: "War Hammer", slot: "weapon", mods: { damage: 5, attackRate: -0.2 } },
  "hunting-knife": { name: "Hunting Knife", slot: "weapon", mods: { damage: 1, critChance: 0.06 } },
  "leather-jerkin": { name: "Leather Jerkin", slot: "armour", mods: { maxHp: 15 } },
  "chain-mail": { name: "Chain Mail", slot: "armour", mods: { maxHp: 28, moveSpeed: -0.2 } },
  "scout-cloak": { name: "Scout's Cloak", slot: "armour", mods: { maxHp: 8, moveSpeed: 0.3 } },
  "dusk-mantle": { name: "Dusk Mantle", slot: "armour", mods: { maxHp: 10, dodgeCooldown: -0.08 } },
  "ember-ring": { name: "Ember Ring", slot: "trinket", mods: { damage: 2 } },
  "hawk-charm": { name: "Hawk Charm", slot: "trinket", mods: { critChance: 0.05 } },
  "wind-anklet": { name: "Wind Anklet", slot: "trinket", mods: { moveSpeed: 0.35 } },
  "heart-locket": { name: "Heart Locket", slot: "trinket", mods: { maxHp: 12 } },
};
export const CONSUMABLES = {
  potions: { name: "Health potion", desc: "Restores 40% of your max health.", icon: "potion", key: "Q" },
  bombs: { name: "Fire bomb", desc: "Blasts every foe within 3 tiles.", icon: "bomb", key: "E" },
};
export const POTION_HEAL = 0.4, BOMB_RADIUS = 3, BOMB_DAMAGE = 40;

const round = (k, v) => (k === "maxHp" || k === "damage" ? Math.round(v) : Math.round(v * 100) / 100);

// Everything known about a stored piece, or null if the string is not a real piece.
export function gearInfo(str) {
  const [id, rarity] = String(str).split(":"), base = GEAR[id], R = RARITIES[rarity];
  if (!base || !R) return null;
  const mods = {};
  for (const [k, v] of Object.entries(base.mods)) mods[k] = round(k, v < 0 ? v : v * R.mul); // drawbacks do not grow with rarity
  return { key: `${id}:${rarity}`, id, rarity, rarityName: R.name, slot: base.slot, name: rarity === "common" ? base.name : `${R.name} ${base.name}`, mods, effect: effectText(mods) };
}

// A random piece. Deeper floors and better sources (bonus 0..1: chests, bosses) roll rarer gear.
export function rollGear(rng, floor = 1, bonus = 0) {
  const ids = Object.keys(GEAR), id = ids[rng.int(0, ids.length - 1)];
  const r = rng() - bonus - (floor - 1) * 0.1;
  return `${id}:${r < 0.12 ? "epic" : r < 0.45 ? "rare" : "common"}`;
}

// The inventory part of a run. `inv` is { equip: { weapon, armour, trinket }, bag: [], potions, bombs }.
export function newInventory() { return { equip: { weapon: null, armour: null, trinket: null }, bag: [], potions: 1, bombs: 0 }; }
export function normalizeInventory(v) {
  const d = newInventory();
  if (!v || typeof v !== "object") return d;
  const e = v.equip && typeof v.equip === "object" ? v.equip : {};
  for (const s of SLOTS) { const g = gearInfo(e[s]); d.equip[s] = g && g.slot === s ? g.key : null; }
  d.bag = (Array.isArray(v.bag) ? v.bag : []).map(gearInfo).filter(Boolean).map((g) => g.key).slice(0, BAG_SIZE);
  for (const c of ["potions", "bombs"]) d[c] = Math.max(0, Math.min(MAX_CONSUMABLE, Math.floor(Number(v[c]) || 0)));
  return d;
}

// Puts a piece in the bag. Returns false (and changes nothing) when the bag is full.
export function addGear(inv, key) {
  if (inv.bag.length >= BAG_SIZE) return false;
  inv.bag.push(key);
  return true;
}
// Equips bag item i; whatever was in that slot goes back to the same bag position.
export function equip(inv, i) {
  const g = gearInfo(inv.bag[i]);
  if (!g) return false;
  const old = inv.equip[g.slot];
  inv.equip[g.slot] = g.key;
  if (old) inv.bag[i] = old; else inv.bag.splice(i, 1);
  return true;
}
// Moves an equipped piece back to the bag, if there is room.
export function unequip(inv, slot) {
  if (!inv.equip[slot] || inv.bag.length >= BAG_SIZE) return false;
  inv.bag.push(inv.equip[slot]);
  inv.equip[slot] = null;
  return true;
}
export function dropGear(inv, i) {
  if (i < 0 || i >= inv.bag.length) return false;
  inv.bag.splice(i, 1);
  return true;
}
// Adds one consumable, up to the cap. Returns whether it fitted.
export function addConsumable(inv, kind) {
  if (inv[kind] >= MAX_CONSUMABLE) return false;
  inv[kind] += 1;
  return true;
}
// The stat changes of everything equipped, for computeStats.
export function gearMods(inv) {
  return SLOTS.map((s) => gearInfo(inv.equip[s])).filter(Boolean).map((g) => g.mods);
}
