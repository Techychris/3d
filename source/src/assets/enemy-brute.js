import { biped, fill, poseBiped, STYLES } from "../engine/rig.js";

export const meta = {
  id: "enemy-brute",
  name: "Armoured brute",
  category: "enemy",
  footprint: [1.0, 1.0],
  height: 1.4,
  flying: false
};

export function build(THREE) {
  const std = (color, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness, ...extra });
  const stone = std(0x5a5862), stoneDark = std(0x3b3a40), metalDark = std(0x5b636d, 0.3), metal = std(0x9aa3ad, 0.3), skin = std(0xd9a27e), wood = std(0x7a5236), woodDark = std(0x4e3423);
  const danger = std(0xff4d3d, 0, { emissive: 0xff4d3d, emissiveIntensity: 1.0 });

  const { group, rig, mesh } = biped(THREE, meta.id, {
    leg: 0.42, torso: 0.56, arm: 0.66, shoulders: 0.42, hips: 0.2, limb: 0.1, depth: 0.72, shadow: 0.5,
    mats: { ...fill(skin), torso: stone, hips: woodDark, thigh: stoneDark, shin: stoneDark, foot: metalDark, shoulder: metalDark },
  });

  // Hunched back, riveted belly plate, wide belt, slab shoulder plates.
  mesh(rig.chest, new THREE.IcosahedronGeometry(0.36, 0), stone, "hump", 0, 0.5, -0.14);
  mesh(rig.chest, new THREE.BoxGeometry(0.5, 0.34, 0.06), metalDark, "bellyPlate", 0, 0.2, 0.29);
  for (const [x, y] of [[-0.2, 0.33], [0.2, 0.33], [-0.2, 0.07], [0.2, 0.07]]) mesh(rig.chest, new THREE.SphereGeometry(0.03, 6, 4), metal, "rivet", x, y, 0.32);
  mesh(rig.hips, new THREE.CylinderGeometry(0.36, 0.34, 0.1, 8).scale(1, 1, 0.75), woodDark, "belt", 0, 0.08, 0);
  for (const arm of [rig.armL, rig.armR]) mesh(arm, new THREE.BoxGeometry(0.3, 0.16, 0.4), metalDark, "shoulderPlate", 0, 0.08, 0);
  for (const fore of [rig.foreL, rig.foreR]) mesh(fore, new THREE.CylinderGeometry(0.11, 0.1, 0.18, 8), metalDark, "bracer", 0, -0.18, 0);

  // Bucket helm sunk between the shoulders, with a glowing eye slit and two horns.
  mesh(rig.head, new THREE.CylinderGeometry(0.2, 0.24, 0.36, 8), metalDark, "helmet", 0, 0.1, 0.06);
  mesh(rig.head, new THREE.BoxGeometry(0.3, 0.05, 0.03), danger, "eye", 0, 0.13, 0.275);
  for (const s of [-1, 1]) mesh(rig.head, new THREE.ConeGeometry(0.05, 0.22, 5).rotateZ(-s * 0.9), metal, "horn", s * 0.27, 0.24, 0.04);

  // Long hammer in the right fist; the left hand comes up to it for the slam.
  mesh(rig.handR, new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6).rotateX(Math.PI / 2), wood, "handle", 0, 0, 0.3);
  mesh(rig.handR, new THREE.BoxGeometry(0.3, 0.26, 0.24), metal, "hammerHead", 0, 0, 0.78);
  mesh(rig.handR, new THREE.BoxGeometry(0.34, 0.1, 0.1), metalDark, "hammerBand", 0, 0, 0.78);
  return group;
}

export function update(group, t, pose) {
  poseBiped(group, t, pose, STYLES.slam);
}
