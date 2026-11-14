import { biped, fill, poseBiped, STYLES } from "../engine/rig.js";

export const meta = {
  id: "hero-rogue",
  name: "Rogue",
  category: "hero",
  footprint: [0.8, 0.8],
  height: 1.0,
  flying: false
};

export function build(THREE) {
  const std = (color, metalness = 0) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness });
  const dark = std(0x3b3a40), leather = std(0x4e3423), red = std(0xa8423a), skin = std(0xd9a27e), steel = std(0x9aa3ad, 0.3), gold = std(0xe0b04a, 0.3);

  const { group, rig, mesh } = biped(THREE, meta.id, { leg: 0.3, torso: 0.27, arm: 0.3, shoulders: 0.17, hips: 0.08, limb: 0.046, depth: 0.7, shadow: 0.36,
    mats: { ...fill(dark), hips: leather, hand: skin, foot: leather, fore: leather },
  });

  // Leather jerkin straps, a belt of pouches, and a long red scarf trailing behind.
  mesh(rig.chest, new THREE.BoxGeometry(0.05, 0.36, 0.26).rotateZ(0.6), leather, "strap", 0, 0.13, 0);
  mesh(rig.hips, new THREE.BoxGeometry(0.09, 0.08, 0.06), leather, "pouch", 0.11, 0.03, 0.1);
  mesh(rig.chest, new THREE.TorusGeometry(0.12, 0.045, 5, 10).rotateX(Math.PI / 2), red, "scarf", 0, 0.27, 0);
  mesh(rig.chest, new THREE.BoxGeometry(0.09, 0.34, 0.03).rotateX(-0.5), red, "scarfTail", 0.05, 0.13, -0.2);

  // Hood with a shadowed face, a masked mouth and two bright eyes.
  mesh(rig.head, new THREE.SphereGeometry(0.19, 10, 8), dark, "hood", 0, 0.17, -0.01);
  mesh(rig.head, new THREE.ConeGeometry(0.11, 0.2, 6).rotateX(-0.9), dark, "hoodPeak", 0, 0.29, -0.12);
  mesh(rig.head, new THREE.SphereGeometry(0.15, 10, 8).scale(1, 0.9, 0.8), skin, "face", 0, 0.16, 0.07);
  mesh(rig.head, new THREE.BoxGeometry(0.2, 0.08, 0.06), red, "mask", 0, 0.1, 0.17);
  for (const s of [-1, 1]) mesh(rig.head, new THREE.SphereGeometry(0.022, 6, 4), gold, "eye", s * 0.055, 0.18, 0.185);

  // A dagger in each fist.
  for (const hand of [rig.handL, rig.handR]) {
    mesh(hand, new THREE.CylinderGeometry(0.008, 0.045, 0.3, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(0.4, 1, 1), steel, "dagger", 0, 0, 0.21);
    mesh(hand, new THREE.BoxGeometry(0.035, 0.12, 0.035), gold, "daggerGuard", 0, 0, 0.055);
  }
  return group;
}

export function update(group, t, pose) {
  poseBiped(group, t, pose, STYLES.rogue);
}
