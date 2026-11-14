import { biped, fill, poseBiped, STYLES } from "../engine/rig.js";

export const meta = {
  id: "hero-ranger",
  name: "Ranger",
  category: "hero",
  footprint: [0.8, 0.8],
  height: 1.0,
  flying: false
};

export function build(THREE) {
  const std = (color, metalness = 0) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness });
  const green = std(0x4f7a3f), leather = std(0x4e3423), wood = std(0x7a5236), skin = std(0xd9a27e), cord = std(0xe8dcc0), dark = std(0x3b3a40), gold = std(0xe0b04a, 0.3);

  const { group, rig, mesh } = biped(THREE, meta.id, { leg: 0.3, torso: 0.27, arm: 0.3, shoulders: 0.17, hips: 0.08, limb: 0.046, depth: 0.7, shadow: 0.36,
    mats: { ...fill(leather), torso: green, shoulder: green, arm: green, thigh: dark, hand: skin },
  });

  // Short cloak, a quiver of arrows across the back, a gold cloak pin.
  mesh(rig.chest, new THREE.CylinderGeometry(0.13, 0.24, 0.36, 7, 1, true, Math.PI * 0.55, Math.PI * 0.9), green, "cloak", 0, 0.1, -0.02);
  mesh(rig.chest, new THREE.OctahedronGeometry(0.03, 0), gold, "pin", 0, 0.25, 0.125);
  mesh(rig.chest, new THREE.CylinderGeometry(0.05, 0.04, 0.26, 6).rotateZ(0.4), leather, "quiver", 0.04, 0.14, -0.15);
  for (let i = 0; i < 3; i++) mesh(rig.chest, new THREE.CylinderGeometry(0.009, 0.009, 0.14, 4).rotateZ(0.4), cord, "arrow", -0.045 + i * 0.022, 0.31, -0.15 + (i - 1) * 0.016);

  // Hood with a point, a calm face, a feather tucked in the band.
  mesh(rig.head, new THREE.SphereGeometry(0.19, 10, 8), green, "hood", 0, 0.17, -0.01);
  mesh(rig.head, new THREE.ConeGeometry(0.1, 0.22, 6).rotateX(-1.0), green, "hoodPeak", 0, 0.28, -0.13);
  mesh(rig.head, new THREE.SphereGeometry(0.15, 10, 8).scale(1, 0.92, 0.8), skin, "face", 0, 0.15, 0.07);
  for (const s of [-1, 1]) mesh(rig.head, new THREE.SphereGeometry(0.02, 6, 4), dark, "eye", s * 0.055, 0.17, 0.185);
  mesh(rig.head, new THREE.BoxGeometry(0.02, 0.18, 0.05).rotateZ(-0.5), cord, "feather", 0.17, 0.3, 0);

  // Longbow in the left fist: upright when the arm is held out, with its string.
  mesh(rig.handL, new THREE.TorusGeometry(0.27, 0.022, 4, 14, Math.PI * 0.9).rotateZ(-Math.PI * 0.95).rotateY(Math.PI / 2), wood, "bow", 0, 0.27, 0);
  mesh(rig.handL, new THREE.CylinderGeometry(0.006, 0.006, 0.53, 3).rotateX(Math.PI / 2), cord, "string", 0, 0.228, 0);
  return group;
}

export function update(group, t, pose) {
  poseBiped(group, t, pose, STYLES.ranger);
}
