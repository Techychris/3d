import { biped, fill, poseBiped, STYLES } from "../engine/rig.js";

export const meta = {
  id: "enemy-goblin-archer",
  name: "Goblin archer",
  category: "enemy",
  footprint: [0.7, 0.7],
  height: 0.8,
  flying: false
};

export function build(THREE) {
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const skin = std(0x7bc86c), leather = std(0x4e3423), wood = std(0x7a5236), trousers = std(0x3b3a40), cord = std(0xe8dcc0);
  const danger = std(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 0.8 });

  const { group, rig, mesh } = biped(THREE, meta.id, {
    leg: 0.17, torso: 0.2, arm: 0.24, shoulders: 0.125, hips: 0.06, limb: 0.034, depth: 0.7, shadow: 0.3,
    mats: { ...fill(skin), torso: leather, hips: trousers, thigh: trousers, foot: leather },
  });

  // Hood-less big head: long pointed ears, a hooked nose, red eyes, a leather cap.
  mesh(rig.head, new THREE.SphereGeometry(0.19, 12, 8).scale(1.05, 0.92, 1), skin, "head", 0, 0.17, 0);
  mesh(rig.head, new THREE.SphereGeometry(0.195, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.42), leather, "cap", 0, 0.19, -0.01);
  for (const s of [-1, 1]) {
    mesh(rig.head, new THREE.ConeGeometry(0.06, 0.24, 5).rotateZ(-s * (Math.PI / 2 - 0.35)), skin, "ear", s * 0.27, 0.21, -0.02);
    mesh(rig.head, new THREE.SphereGeometry(0.04, 8, 6), danger, "eye", s * 0.08, 0.17, 0.17);
  }
  mesh(rig.head, new THREE.ConeGeometry(0.035, 0.11, 5).rotateX(Math.PI / 2 + 0.3), skin, "nose", 0, 0.13, 0.21);

  // Quiver on the back with three arrows.
  mesh(rig.chest, new THREE.CylinderGeometry(0.045, 0.035, 0.22, 6).rotateZ(0.35), leather, "quiver", 0.03, 0.12, -0.11);
  for (let i = 0; i < 3; i++) mesh(rig.chest, new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4).rotateZ(0.35), cord, "arrow", -0.035 + i * 0.02, 0.27, -0.11 + (i - 1) * 0.015);

  // Bow in the left fist: an arc that stands upright when the arm is held out, with a string.
  mesh(rig.handL, new THREE.TorusGeometry(0.2, 0.022, 4, 12, Math.PI * 0.9).rotateZ(-Math.PI * 0.95).rotateY(Math.PI / 2), wood, "bow", 0, 0.2, 0);
  mesh(rig.handL, new THREE.CylinderGeometry(0.006, 0.006, 0.39, 3).rotateX(Math.PI / 2), cord, "string", 0, 0.169, 0);
  return group;
}

export function update(group, t, pose) {
  poseBiped(group, t, pose, STYLES.bow);
}
