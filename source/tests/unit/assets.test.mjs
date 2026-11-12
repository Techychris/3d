// Unit tests for src/engine/assets.js and every module in src/assets/*.js (74 assets).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import { ASSETS, DUSK, COLORS, makeAsset, restyle, setEmissiveFlash } from "../../src/engine/assets.js";
import { spy } from "./helpers.mjs";

const ASSET_DIR = new URL("../../src/assets/", import.meta.url);
const ALL_IDS = Object.keys(ASSETS).sort();
// Sample times: a few spread-out values plus a sweep that covers every phase of the longest loop (2.4 s spike cycle).
const TIMES = [0, 0.37, 1.1, 2.9, 7.3, 61.25, ...Array.from({ length: 48 }, (_, i) => 0.05 + i * 0.13)];

// Assets whose update(group, t) is empty in the source: they are static and must not move.
const STATIC = new Set([
  "prop-anvil", "prop-barrels", "prop-bone-pile", "prop-bookshelf", "prop-crates", "prop-gravestones", "prop-sarcophagus",
  "prop-shop-stall", "prop-signpost", "prop-statue", "prop-urns", "prop-weapon-rack",
  "tile-bridge", "tile-floor-moss", "tile-floor-stone", "tile-pillar", "tile-wall", "tile-wall-corner",
]);

// Assets whose update() drives a material that build() saved in userData. restyle() replaces every material with a
// clone, so the saved material is never the one drawn. Source bug (reported, not fixed): these pulses do not show.
const STALE_MATERIALS = {
  "pickup-coins": (g) => g.userData.gemMat,
  "tile-floor-cracked": (g) => g.userData.glow,
  "tile-stairs-down": (g) => g.userData.embers[0],
  "tile-spike-trap": (g) => g.userData.warnMat,
  "tile-water": (g) => g.userData.ripples[0].mat,
  "hero-mage": (g) => g.userData.orbMat,
  "enemy-cultist": (g) => g.userData.orbMat,
  "enemy-imp": (g) => g.userData.parts.fireMat,
  "boss-necromancer": (g) => g.userData.gemMat,
  "pickup-scroll": (g) => g.userData.glowMat,
};

// Assets whose update(group, t) returns early when a part is missing (called on a bare group, they must do nothing).
const GUARDED = [
  "hero-mage", "hero-paladin", "hero-ranger", "hero-rogue",
  "boss-dragon-whelp", "boss-golem", "boss-necromancer",
  "enemy-bat", "enemy-brute", "enemy-cultist", "enemy-goblin-archer", "enemy-imp", "enemy-mimic",
  "enemy-mushroom", "enemy-scorpion", "enemy-skeleton-knight", "enemy-slime", "enemy-spider", "enemy-totem",
  "pickup-coins", "pickup-item-pedestal",
  "prop-banner", "prop-brazier", "prop-campfire", "prop-cauldron", "prop-chest", "prop-crystal-cluster", "prop-dusk-tree",
  "prop-lantern-post", "prop-mushroom-patch", "prop-rune-stone", "prop-telescope", "prop-well",
  "tile-doorway-exit", "tile-floor-cracked", "tile-floor-grate", "tile-spike-trap", "tile-stairs-down",
  "tile-wall-torch", "tile-water",
  "vfx-fireball", "vfx-telegraph-circle", "vfx-telegraph-cone",
];

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const hexOf = (c) => (c ? c.getHex() : -1);

// Everything visible about a pose: transforms plus material colour, emissive, opacity. Used to detect motion.
function snapshot(group) {
  const rows = [];
  group.traverse((o) => {
    const row = [o.type, o.name, o.visible, ...o.position.toArray().map(r6), ...o.rotation.toArray().slice(0, 3).map(r6), ...o.scale.toArray().map(r6)];
    for (const m of [].concat(o.material ?? [])) {
      row.push(m.type, hexOf(m.color), hexOf(m.emissive), r6(m.emissiveIntensity ?? 0), r6(m.opacity ?? 1), m.transparent ?? false);
    }
    rows.push(row.join("|"));
  });
  return rows.join("\n");
}

function meshesOf(group) {
  const out = [];
  group.traverse((o) => { if (o.isMesh) out.push(o); });
  return out;
}

// --- Registry ---------------------------------------------------------------

test("ASSETS registers exactly the 74 modules in src/assets, each keyed by its meta id", () => {
  const files = fs.readdirSync(ASSET_DIR).filter((f) => f.endsWith(".js")).map((f) => f.slice(0, -3)).sort();
  assert.equal(files.length, 74);
  assert.deepEqual(ALL_IDS, files);
  for (const id of ALL_IDS) assert.equal(ASSETS[id].meta.id, id, `${id} meta.id matches its key`);
});

test("the colour constants are the dusk remaps of their authored colours", () => {
  assert.equal(COLORS.danger, DUSK[0xff4d3d]);
  assert.equal(COLORS.ember, DUSK[0xff7a2e]);
  assert.equal(COLORS.magic, DUSK[0x8c5be0]);
  assert.equal(COLORS.heal, DUSK[0x5fd38a]);
  assert.equal(COLORS.gold, DUSK[0xe0b04a]);
  assert.equal(COLORS.shadow, DUSK[0x000000]);
});

// --- Every asset: build, restyle, metadata -----------------------------------

for (const id of ALL_IDS) {
  test(`${id}: builds a restyled group with metadata`, () => {
    const a = makeAsset(id);
    assert.ok(a.group instanceof THREE.Group);
    assert.equal(a.group.name, id);
    assert.equal(a.meta, ASSETS[id].meta);
    assert.equal(typeof a.update, "function");
    assert.equal(a.meta.footprint.length, 2);
    assert.ok(a.meta.height > 0, "positive height");
    assert.ok(["hero", "enemy", "boss", "pickup", "prop", "tile", "vfx"].includes(a.meta.category), "known category");

    const meshes = meshesOf(a.group);
    assert.ok(meshes.length > 0, "has meshes");
    for (const m of meshes) {
      assert.equal(m.receiveShadow, true, `${m.name} receives shadows`);
      if (m.name === "shadow") assert.equal(m.castShadow, false, "blob shadows never cast");
      for (const mat of [].concat(m.material)) {
        if ("roughness" in mat) assert.equal(mat.roughness, 0.95, `${m.name} roughness`);
        if (mat.color) assert.equal(Object.hasOwn(DUSK, String(mat.color.getHex())), false, `${m.name} colour was remapped`);
        if (mat.emissive && mat.emissive.getHex()) {
          assert.equal(Object.hasOwn(DUSK, String(mat.emissive.getHex())), false, `${m.name} emissive was remapped`);
        }
      }
    }
  });

  test(`${id}: update(t) runs for several times, is deterministic and animates unless static`, () => {
    const a = makeAsset(id);
    const seen = TIMES.map((t) => { a.update(t); return snapshot(a.group); });
    a.update(TIMES[2]);
    assert.equal(snapshot(a.group), seen[2], "same time gives the same pose");
    const distinct = new Set(seen).size;
    if (STATIC.has(id)) assert.equal(distinct, 1, "update is empty, so the asset stays put");
    else if (!(id in STALE_MATERIALS)) assert.ok(distinct > 1, `update changes the asset over time (${distinct} distinct poses)`);
  });

  if (id in STALE_MATERIALS) {
    const pick = STALE_MATERIALS[id];
    test(`${id}: update() animates the material it keeps in userData`, () => {
      const a = makeAsset(id);
      const mat = pick(a.group);
      const state = () => [mat.emissiveIntensity, mat.opacity, hexOf(mat.color)].join("|");
      const states = TIMES.map((t) => { a.update(t); return state(); });
      assert.ok(new Set(states).size > 1, "the saved material changes over time");
    });

    test(`${id}: the material update() drives is the one a mesh renders`, () => {
      const a = makeAsset(id);
      const mat = pick(a.group);
      assert.ok(meshesOf(a.group).some((m) => [].concat(m.material).includes(mat)));
    });
  }
}

test("update tolerates a group that does not have the parts it animates", () => {
  for (const id of GUARDED) {
    const bare = new THREE.Group();
    assert.doesNotThrow(() => ASSETS[id].update(bare, 1.5), id);
    assert.equal(bare.children.length, 0, `${id} adds nothing to a bare group`);
  }
});

// --- restyle -----------------------------------------------------------------

test("restyle remaps palette colours and emissive, sets roughness, and clones instead of mutating", () => {
  const g = new THREE.Group();
  const original = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, emissive: 0xff4d3d, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), original);
  g.add(mesh);
  assert.equal(restyle(g), g, "returns the same group");
  const restyled = mesh.material;
  assert.notEqual(restyled, original, "a clone is used");
  assert.equal(restyled.color.getHex(), DUSK[0x9aa3ad]);
  assert.equal(restyled.emissive.getHex(), DUSK[0xff4d3d]);
  assert.equal(restyled.emissiveIntensity, 0.5, "emissive strength is kept");
  assert.equal(restyled.roughness, 0.95);
  assert.equal(restyled.metalness, 0.3, "metalness is kept");
  assert.equal(original.color.getHex(), 0x9aa3ad, "the original colour is untouched");
  assert.equal(original.roughness, 0.2, "the original roughness is untouched");
  assert.equal(mesh.castShadow, true);
  assert.equal(mesh.receiveShadow, true);
});

test("restyle leaves colours outside the palette and black emissive unchanged", () => {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x123456, emissive: 0x000000 }));
  const glow = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x654321 }));
  g.add(mesh, glow);
  restyle(g);
  assert.equal(mesh.material.color.getHex(), 0x123456, "unknown colour kept");
  assert.equal(mesh.material.emissive.getHex(), 0x000000, "black emissive kept");
  assert.equal(glow.material.color.getHex(), 0x0a0a0a);
  assert.equal(glow.material.emissive.getHex(), 0x654321, "unknown emissive kept");
});

test("restyle keeps the array shape of multi-material meshes and remaps each entry", () => {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [
    new THREE.MeshStandardMaterial({ color: 0x5b636d }),
    new THREE.MeshStandardMaterial({ color: 0x777777 }),
  ]);
  g.add(mesh);
  restyle(g);
  assert.ok(Array.isArray(mesh.material));
  assert.equal(mesh.material.length, 2);
  assert.equal(mesh.material[0].color.getHex(), DUSK[0x5b636d]);
  assert.equal(mesh.material[1].color.getHex(), 0x777777);
  assert.ok(mesh.material.every((m) => m.roughness === 0.95));
});

test("restyle handles materials without colour, emissive or roughness", () => {
  const g = new THREE.Group();
  const shader = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial());
  const basic = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ color: 0x3e5c9a }));
  g.add(shader, basic);
  assert.doesNotThrow(() => restyle(g));
  assert.equal(shader.material.type, "ShaderMaterial");
  assert.equal("roughness" in shader.material, false, "no roughness added to a shader material");
  assert.equal(basic.material.color.getHex(), DUSK[0x3e5c9a], "basic material colour is still remapped");
  assert.equal("roughness" in basic.material, false, "no roughness added to a basic material");
});

test("restyle keeps shadows and faint layers from casting, but solid and bright layers do cast", () => {
  const g = new THREE.Group();
  const make = (name, opts) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(opts));
    m.name = name; g.add(m); return m;
  };
  const shadow = make("shadow", { color: 0x000000 });
  const drop = make("dropLine", { color: 0x111111 });
  const faint = make("haze", { color: 0x222222, transparent: true, opacity: 0.35 });
  const bright = make("slime", { color: 0x333333, transparent: true, opacity: 0.75 });
  const solid = make("stone", { color: 0x444444 });
  restyle(g);
  assert.equal(shadow.castShadow, false);
  assert.equal(drop.castShadow, false);
  assert.equal(faint.castShadow, false);
  assert.equal(bright.castShadow, true);
  assert.equal(solid.castShadow, true);
  for (const m of [shadow, drop, faint, bright, solid]) assert.equal(m.receiveShadow, true);
});

// --- makeAsset ---------------------------------------------------------------

test("makeAsset throws for an unknown id", () => {
  assert.throws(() => makeAsset("not-a-real-asset"), /unknown asset not-a-real-asset/);
});

test("the update wrapper passes the built group and the time to the module's update", (t) => {
  const id = "test-spy-asset";
  const update = spy();
  ASSETS[id] = {
    meta: { id, name: "Spy", category: "prop", footprint: [1, 1], height: 1, flying: false },
    build: (three) => { const g = new three.Group(); g.name = id; return g; },
    update,
  };
  t.after(() => { delete ASSETS[id]; });
  const a = makeAsset(id);
  a.update(2.5);
  assert.equal(update.calls.length, 1);
  assert.equal(update.calls[0][0], a.group);
  assert.equal(update.calls[0][1], 2.5);
});

test("an asset module without an update function still builds and can be updated safely", (t) => {
  const id = "test-static-asset";
  ASSETS[id] = {
    meta: { id, name: "Static", category: "prop", footprint: [1, 1], height: 1, flying: false },
    build: (three) => {
      const g = new three.Group(); g.name = id;
      g.add(new three.Mesh(new three.BoxGeometry(), new three.MeshStandardMaterial({ color: 0x5a5862 })));
      return g;
    },
  };
  t.after(() => { delete ASSETS[id]; });
  const a = makeAsset(id);
  const before = snapshot(a.group);
  assert.doesNotThrow(() => a.update(3));
  assert.equal(snapshot(a.group), before, "nothing moves");
  assert.equal(meshesOf(a.group)[0].material.roughness, 0.95, "still restyled");
});

// --- setEmissiveFlash --------------------------------------------------------

test("setEmissiveFlash sets a flash colour and strength, and restores the base look at zero", () => {
  const a = makeAsset("vfx-fireball");
  const core = a.group.children.find((c) => c.name === "core");
  const baseHex = core.material.emissive.getHex();
  const baseIntensity = core.material.emissiveIntensity;
  setEmissiveFlash(a.group, 0.8, 0xffffff);
  assert.equal(core.material.emissive.getHex(), 0xffffff);
  assert.equal(core.material.emissiveIntensity, 0.8);
  setEmissiveFlash(a.group, 0);
  assert.equal(core.material.emissive.getHex(), baseHex);
  assert.equal(core.material.emissiveIntensity, baseIntensity);
});

test("a second flash keeps the first-remembered base look, and the default flash colour is white", () => {
  const a = makeAsset("vfx-fireball");
  const core = a.group.children.find((c) => c.name === "core");
  const baseHex = core.material.emissive.getHex();
  const baseIntensity = core.material.emissiveIntensity;
  setEmissiveFlash(a.group, 0.4);
  assert.equal(core.material.emissive.getHex(), 0xffffff, "default colour");
  setEmissiveFlash(a.group, 0.9, 0x00ff00);
  assert.equal(core.material.emissive.getHex(), 0x00ff00);
  setEmissiveFlash(a.group, 0);
  assert.equal(core.material.emissive.getHex(), baseHex, "restored to the original, not the first flash");
  assert.equal(core.material.emissiveIntensity, baseIntensity);
});

test("a zero flash on an untouched asset leaves it as it was", () => {
  const a = makeAsset("vfx-fireball");
  const before = snapshot(a.group);
  setEmissiveFlash(a.group, 0);
  assert.equal(snapshot(a.group), before);
});

test("setEmissiveFlash skips shadows, drop lines, meshes without emissive, meshes without material and groups", () => {
  const a = makeAsset("pickup-coins");
  const shadow = a.group.children.find((c) => c.name === "shadow");
  assert.equal(shadow.material.emissive, undefined, "the shadow is a basic material");
  const gem = a.group.children.find((c) => c.name === "gem");
  const gemBase = [gem.material.emissive.getHex(), gem.material.emissiveIntensity];

  const extra = new THREE.Group();
  const dropLine = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff0000, emissiveIntensity: 0.6 }));
  dropLine.name = "dropLine";
  const bare = new THREE.Mesh(new THREE.BoxGeometry(), null);
  extra.add(dropLine, bare);
  a.group.add(extra);

  assert.doesNotThrow(() => setEmissiveFlash(a.group, 1, 0xff00ff));
  assert.equal(shadow.material.emissive, undefined);
  assert.equal(shadow.userData._baseEmissive, undefined, "shadow untouched");
  assert.equal(dropLine.material.emissive.getHex(), 0xff0000, "drop line keeps its colour");
  assert.equal(dropLine.material.emissiveIntensity, 0.6);
  assert.equal(dropLine.userData._baseEmissive, undefined);
  assert.equal(gem.material.emissive.getHex(), 0xff00ff, "a real emissive mesh is flashed");
  assert.equal(gem.material.emissiveIntensity, 1);
  setEmissiveFlash(a.group, 0);
  assert.deepEqual([gem.material.emissive.getHex(), gem.material.emissiveIntensity], gemBase, "and restored");
  assert.equal(dropLine.material.emissive.getHex(), 0xff0000, "drop line still untouched after restore");
});

test("setEmissiveFlash on a whole hero flashes every emissive mesh and restores them", () => {
  const a = makeAsset("hero-mage");
  const emissive = meshesOf(a.group).filter((m) => m.material.emissive && m.name !== "shadow");
  assert.ok(emissive.length > 0);
  const before = emissive.map((m) => [m.material.emissive.getHex(), m.material.emissiveIntensity]);
  setEmissiveFlash(a.group, 2, 0xff8800);
  for (const m of emissive) {
    assert.equal(m.material.emissive.getHex(), 0xff8800);
    assert.equal(m.material.emissiveIntensity, 2);
  }
  setEmissiveFlash(a.group, 0);
  emissive.forEach((m, i) => {
    assert.equal(m.material.emissive.getHex(), before[i][0]);
    assert.equal(m.material.emissiveIntensity, before[i][1]);
  });
});
