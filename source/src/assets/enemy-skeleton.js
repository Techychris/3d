import { biped, fill, poseBiped, STYLES } from "../engine/rig.js";

export const meta = {
  id: "enemy-skeleton",
  name: "Skeleton grunt",
  category: "enemy",
  footprint: [0.7, 0.7],
  height: 0.95,
  flying: false
};

export function build(THREE) {
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const bone = std(0xe8dcc0), dark = std(0x3b3a40), rust = std(0x5b636d, { metalness: 0.3 }), rag = std(0x4e3423);
  const eye = std(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 1.2 });

  const { group, rig, mesh } = biped(THREE, meta.id, {
    leg: 0.36, torso: 0.24, arm: 0.32, shoulders: 0.15, hips: 0.075, limb: 0.032, depth: 0.6, shadow: 0.3, mats: { ...fill(bone), torso: dark },
  });

  // Ribcage: a dark core with four bone rings and a spine behind; a torn rag at the waist.
  for (let i = 0; i < 4; i++) mesh(rig.chest, new THREE.TorusGeometry(0.115 + i * 0.012, 0.02, 4, 10).rotateX(Math.PI / 2).scale(1, 1, 0.66), bone, "rib", 0, 0.04 + i * 0.06, 0);
  mesh(rig.chest, new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), bone, "spine", 0, 0.12, -0.085);
  mesh(rig.hips, new THREE.ConeGeometry(0.13, 0.16, 6, 1, true).scale(1, 1, 0.7), rag, "rag", 0, -0.04, 0);

  // Big skull with a hinged jaw, hollow sockets and glowing eyes.
  mesh(rig.head, new THREE.SphereGeometry(0.14, 10, 8).scale(1, 0.95, 1.05), bone, "skull", 0, 0.15, 0.01);
  mesh(rig.head, new THREE.CylinderGeometry(0.04, 0.045, 0.07, 6), bone, "neck", 0, 0.02, -0.01);
  const jaw = mesh(rig.head, new THREE.BoxGeometry(0.15, 0.045, 0.12).translate(0, 0, 0.06), bone, "jaw", 0, 0.045, -0.01);
  for (const s of [-1, 1]) {
    mesh(rig.head, new THREE.SphereGeometry(0.042, 8, 6), dark, "socket", s * 0.055, 0.16, 0.115);
    mesh(rig.head, new THREE.SphereGeometry(0.024, 6, 4), eye, "eye", s * 0.055, 0.16, 0.14);
  }
  rig.jaw = jaw;

  // Notched, rusty sword in the right fist.
  mesh(rig.handR, new THREE.BoxGeometry(0.03, 0.075, 0.42), rust, "blade", 0, 0, 0.27);
  mesh(rig.handR, new THREE.BoxGeometry(0.03, 0.05, 0.08).rotateX(0.5), rust, "bladeTip", 0, -0.008, 0.5);
  mesh(rig.handR, new THREE.BoxGeometry(0.04, 0.16, 0.04), rust, "crossguard", 0, 0, 0.055);
  mesh(rig.handR, new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6).rotateX(Math.PI / 2), rag, "grip", 0, 0, -0.01);
  return group;
}

export function update(group, t, pose) {
  poseBiped(group, t, pose, STYLES.melee);
  const r = group.userData.rig;
  if (!r) return;
  r.jaw.rotation.x = 0.12 + 0.12 * Math.sin(t * 9) * Math.sin(t * 1.3); // chattering teeth
  group.rotation.z = Math.sin(t * 2.2) * 0.03;                          // loose, swaying frame
}
