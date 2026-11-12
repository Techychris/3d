// Asset factory: builds any of the 74 asset modules, restyled to the dusk palette.
// makeAsset(id) -> { group, update(t), meta }. Call update(t) every frame with world.time.
import * as THREE from "three";

import * as A_boss_dragon_whelp from "../assets/boss-dragon-whelp.js";
import * as A_boss_golem from "../assets/boss-golem.js";
import * as A_boss_necromancer from "../assets/boss-necromancer.js";
import * as A_boss_slime_king from "../assets/boss-slime-king.js";
import * as A_enemy_bat from "../assets/enemy-bat.js";
import * as A_enemy_brute from "../assets/enemy-brute.js";
import * as A_enemy_cultist from "../assets/enemy-cultist.js";
import * as A_enemy_ghost from "../assets/enemy-ghost.js";
import * as A_enemy_goblin_archer from "../assets/enemy-goblin-archer.js";
import * as A_enemy_imp from "../assets/enemy-imp.js";
import * as A_enemy_mimic from "../assets/enemy-mimic.js";
import * as A_enemy_mushroom from "../assets/enemy-mushroom.js";
import * as A_enemy_rat_swarm from "../assets/enemy-rat-swarm.js";
import * as A_enemy_scorpion from "../assets/enemy-scorpion.js";
import * as A_enemy_skeleton from "../assets/enemy-skeleton.js";
import * as A_enemy_skeleton_knight from "../assets/enemy-skeleton-knight.js";
import * as A_enemy_slime from "../assets/enemy-slime.js";
import * as A_enemy_spider from "../assets/enemy-spider.js";
import * as A_enemy_totem from "../assets/enemy-totem.js";
import * as A_enemy_wisp from "../assets/enemy-wisp.js";
import * as A_hero_mage from "../assets/hero-mage.js";
import * as A_hero_paladin from "../assets/hero-paladin.js";
import * as A_hero_ranger from "../assets/hero-ranger.js";
import * as A_hero_rogue from "../assets/hero-rogue.js";
import * as A_hero_warrior from "../assets/hero-warrior.js";
import * as A_pickup_coins from "../assets/pickup-coins.js";
import * as A_pickup_health_potion from "../assets/pickup-health-potion.js";
import * as A_pickup_heart_container from "../assets/pickup-heart-container.js";
import * as A_pickup_item_pedestal from "../assets/pickup-item-pedestal.js";
import * as A_pickup_key from "../assets/pickup-key.js";
import * as A_pickup_scroll from "../assets/pickup-scroll.js";
import * as A_prop_altar from "../assets/prop-altar.js";
import * as A_prop_anvil from "../assets/prop-anvil.js";
import * as A_prop_banner from "../assets/prop-banner.js";
import * as A_prop_barrels from "../assets/prop-barrels.js";
import * as A_prop_bone_pile from "../assets/prop-bone-pile.js";
import * as A_prop_bookshelf from "../assets/prop-bookshelf.js";
import * as A_prop_brazier from "../assets/prop-brazier.js";
import * as A_prop_campfire from "../assets/prop-campfire.js";
import * as A_prop_cauldron from "../assets/prop-cauldron.js";
import * as A_prop_chest from "../assets/prop-chest.js";
import * as A_prop_crates from "../assets/prop-crates.js";
import * as A_prop_crystal_cluster from "../assets/prop-crystal-cluster.js";
import * as A_prop_dusk_tree from "../assets/prop-dusk-tree.js";
import * as A_prop_gravestones from "../assets/prop-gravestones.js";
import * as A_prop_lantern_post from "../assets/prop-lantern-post.js";
import * as A_prop_mushroom_patch from "../assets/prop-mushroom-patch.js";
import * as A_prop_rune_stone from "../assets/prop-rune-stone.js";
import * as A_prop_sarcophagus from "../assets/prop-sarcophagus.js";
import * as A_prop_shop_stall from "../assets/prop-shop-stall.js";
import * as A_prop_signpost from "../assets/prop-signpost.js";
import * as A_prop_statue from "../assets/prop-statue.js";
import * as A_prop_telescope from "../assets/prop-telescope.js";
import * as A_prop_urns from "../assets/prop-urns.js";
import * as A_prop_weapon_rack from "../assets/prop-weapon-rack.js";
import * as A_prop_well from "../assets/prop-well.js";
import * as A_tile_bridge from "../assets/tile-bridge.js";
import * as A_tile_doorway_exit from "../assets/tile-doorway-exit.js";
import * as A_tile_floor_cracked from "../assets/tile-floor-cracked.js";
import * as A_tile_floor_grate from "../assets/tile-floor-grate.js";
import * as A_tile_floor_moss from "../assets/tile-floor-moss.js";
import * as A_tile_floor_stone from "../assets/tile-floor-stone.js";
import * as A_tile_pillar from "../assets/tile-pillar.js";
import * as A_tile_spike_trap from "../assets/tile-spike-trap.js";
import * as A_tile_stairs_down from "../assets/tile-stairs-down.js";
import * as A_tile_wall from "../assets/tile-wall.js";
import * as A_tile_wall_corner from "../assets/tile-wall-corner.js";
import * as A_tile_wall_torch from "../assets/tile-wall-torch.js";
import * as A_tile_water from "../assets/tile-water.js";
import * as A_vfx_fireball from "../assets/vfx-fireball.js";
import * as A_vfx_portal from "../assets/vfx-portal.js";
import * as A_vfx_telegraph_circle from "../assets/vfx-telegraph-circle.js";
import * as A_vfx_telegraph_cone from "../assets/vfx-telegraph-cone.js";
import * as A_vfx_telegraph_line from "../assets/vfx-telegraph-line.js";

const LIST = [A_boss_dragon_whelp, A_boss_golem, A_boss_necromancer, A_boss_slime_king, A_enemy_bat, A_enemy_brute, A_enemy_cultist, A_enemy_ghost, A_enemy_goblin_archer, A_enemy_imp, A_enemy_mimic, A_enemy_mushroom, A_enemy_rat_swarm, A_enemy_scorpion, A_enemy_skeleton, A_enemy_skeleton_knight, A_enemy_slime, A_enemy_spider, A_enemy_totem, A_enemy_wisp, A_hero_mage, A_hero_paladin, A_hero_ranger, A_hero_rogue, A_hero_warrior, A_pickup_coins, A_pickup_health_potion, A_pickup_heart_container, A_pickup_item_pedestal, A_pickup_key, A_pickup_scroll, A_prop_altar, A_prop_anvil, A_prop_banner, A_prop_barrels, A_prop_bone_pile, A_prop_bookshelf, A_prop_brazier, A_prop_campfire, A_prop_cauldron, A_prop_chest, A_prop_crates, A_prop_crystal_cluster, A_prop_dusk_tree, A_prop_gravestones, A_prop_lantern_post, A_prop_mushroom_patch, A_prop_rune_stone, A_prop_sarcophagus, A_prop_shop_stall, A_prop_signpost, A_prop_statue, A_prop_telescope, A_prop_urns, A_prop_weapon_rack, A_prop_well, A_tile_bridge, A_tile_doorway_exit, A_tile_floor_cracked, A_tile_floor_grate, A_tile_floor_moss, A_tile_floor_stone, A_tile_pillar, A_tile_spike_trap, A_tile_stairs_down, A_tile_wall, A_tile_wall_corner, A_tile_wall_torch, A_tile_water, A_vfx_fireball, A_vfx_portal, A_vfx_telegraph_circle, A_vfx_telegraph_cone, A_vfx_telegraph_line];
export const ASSETS = Object.fromEntries(LIST.map(m => [m.meta.id, m]));

// Dusk remap: authored palette slot -> dusk colour (see the design spec, Art direction).
export const DUSK = {
  0x3b3a40: 0x3d3350, 0x5a5862: 0x6b5a80, 0x8a8794: 0xa893b8, 0xe8dcc0: 0xefd9d6, 0x7a5236: 0x8a5a4a,
  0x4e3423: 0x553540, 0x9aa3ad: 0xa9a7c4, 0x5b636d: 0x5e5a78, 0xe0b04a: 0xf0b860, 0xa8423a: 0xb8505a,
  0x3e5c9a: 0x5560a8, 0x4f7a3f: 0x3f6b5e, 0x7bc86c: 0x7cc8a0, 0xd9a27e: 0xe0a890, 0xff7a2e: 0xffb060,
  0x8c5be0: 0xa070ff, 0xff4d3d: 0xff3d5a, 0x5fd38a: 0x6fe0c0, 0x000000: 0x1a1030,
};
// Colour meanings used by code-drawn things (telegraphs, UI accents). Dusk values.
export const COLORS = { danger: 0xff3d5a, ember: 0xffb060, magic: 0xa070ff, heal: 0x6fe0c0, gold: 0xf0b860, shadow: 0x1a1030 };

export function restyle(group) {
  // One clone per original material (meshes that shared a material still share it), and every
  // userData reference an asset's update() keeps is pointed at the clone actually drawn.
  const swap = new Map();
  const cloneOf = (m) => {
    let c = swap.get(m);
    if (c) return c;
    c = m.clone();
    if (c.color && DUSK[c.color.getHex()] !== undefined) c.color.setHex(DUSK[c.color.getHex()]);
    if (c.emissive && c.emissive.getHex() && DUSK[c.emissive.getHex()] !== undefined) c.emissive.setHex(DUSK[c.emissive.getHex()]);
    if ("roughness" in c) c.roughness = 0.95;
    swap.set(m, c);
    return c;
  };
  group.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(cloneOf) : cloneOf(o.material);
    const first = Array.isArray(o.material) ? o.material[0] : o.material;
    const flat = o.name === "shadow" || o.name === "dropLine" || (first.transparent && first.opacity < 0.6);
    o.castShadow = !flat; o.receiveShadow = true;
  });
  // userData may hold materials directly, in arrays, or in small plain objects ({ parts: { orb: mat } }).
  const remap = (v, depth) => {
    if (swap.has(v)) return swap.get(v);
    if (depth > 0 && v && typeof v === "object" && !v.isObject3D && !v.isMaterial && !v.isBufferGeometry) {
      if (Array.isArray(v)) return v.map(x => remap(x, depth - 1));
      if (Object.getPrototypeOf(v) === Object.prototype) for (const k of Object.keys(v)) v[k] = remap(v[k], depth - 1);
    }
    return v;
  };
  group.traverse(o => { for (const k of Object.keys(o.userData)) o.userData[k] = remap(o.userData[k], 3); });
  return group;
}

export function makeAsset(id) {
  const mod = ASSETS[id];
  if (!mod) throw new Error(`unknown asset ${id}`);
  const group = restyle(mod.build(THREE));
  return { group, meta: mod.meta, update: (t) => { if (mod.update) mod.update(group, t); } };
}

// Flash every mesh of a group to a colour for a short time (hit flash). Returns a function to call each frame.
export function setEmissiveFlash(group, amount, hex = 0xffffff) {
  group.traverse(o => {
    if (!o.isMesh || !o.material || !o.material.emissive || o.name === "shadow" || o.name === "dropLine") return;
    // base stored on the material: meshes can share one material, so per-mesh storage would record the flash colour
    const m = o.material, u = m.userData;
    if (u._baseEmissive === undefined) { u._baseEmissive = m.emissive.getHex(); u._baseEI = m.emissiveIntensity; }
    if (amount > 0) { m.emissive.setHex(hex); m.emissiveIntensity = amount; }
    else { m.emissive.setHex(u._baseEmissive); m.emissiveIntensity = u._baseEI; }
  });
}
