import { biped, fill, poseBiped, STYLES } from "../engine/rig.js";

export const meta = {
  id: "hero-mage",
  name: "Hero mage",
  category: "hero",
  footprint: [0.8, 0.8],
  height: 1.1,
  flying: false
};

export function build(THREE) {
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const blue = std(0x3e5c9a), dark = std(0x3b3a40), skin = std(0xd9a27e), wood = std(0x4e3423), gold = std(0xe0b04a, { metalness: 0.3 }), beard = std(0xe8dcc0);
  const orbMat = std(0x8c5be0, { emissive: 0x8c5be0, emissiveIntensity: 1.0 });

  const { group, rig, mesh } = biped(THREE, meta.id, { leg: 0.3, torso: 0.27, arm: 0.3, shoulders: 0.17, hips: 0.08, limb: 0.046, depth: 0.7, shadow: 0.36,
    mats: { ...fill(blue), hand: skin, foot: dark, shin: dark },
  });

  // Robe skirt with a gold hem, wide cuffs, a star clasp.
  mesh(rig.hips, new THREE.CylinderGeometry(0.14, 0.25, 0.3, 8, 1, true).translate(0, -0.13, 0), blue, "skirt", 0, 0.04, 0);
  mesh(rig.hips, new THREE.TorusGeometry(0.25, 0.018, 4, 12).rotateX(Math.PI / 2), gold, "hem", 0, -0.24, 0);
  for (const fore of [rig.foreL, rig.foreR]) mesh(fore, new THREE.CylinderGeometry(0.045, 0.085, 0.12, 7, 1, true), blue, "cuff", 0, -0.1, 0);
  mesh(rig.chest, new THREE.OctahedronGeometry(0.035, 0), gold, "clasp", 0, 0.22, 0.125);

  // Tall bent hat with a wide brim, a face and a short white beard.
  mesh(rig.head, new THREE.SphereGeometry(0.16, 10, 8).scale(1, 0.95, 0.9), skin, "face", 0, 0.15, 0.02);
  mesh(rig.head, new THREE.ConeGeometry(0.12, 0.16, 6).rotateX(Math.PI), beard, "beard", 0, 0.03, 0.11);
  mesh(rig.head, new THREE.CylinderGeometry(0.3, 0.3, 0.025, 12), blue, "brim", 0, 0.25, 0);
  mesh(rig.head, new THREE.ConeGeometry(0.17, 0.3, 8), blue, "hat", 0, 0.4, 0);
  mesh(rig.head, new THREE.ConeGeometry(0.07, 0.2, 6).rotateX(-0.9), blue, "hatTip", 0, 0.55, -0.07);
  mesh(rig.head, new THREE.TorusGeometry(0.165, 0.018, 4, 12).rotateX(Math.PI / 2), gold, "hatBand", 0, 0.275, 0);
  for (const s of [-1, 1]) mesh(rig.head, new THREE.SphereGeometry(0.02, 6, 4), dark, "eye", s * 0.055, 0.17, 0.155);

  // Staff in the right fist with a glowing orb held in a gold claw.
  mesh(rig.handR, new THREE.CylinderGeometry(0.02, 0.024, 0.95, 6).rotateX(Math.PI / 2), wood, "staff", 0, 0, 0.18);
  mesh(rig.handR, new THREE.TorusGeometry(0.06, 0.014, 4, 8, Math.PI * 1.3).rotateZ(Math.PI * 0.85).rotateY(Math.PI / 2).rotateX(Math.PI / 2), gold, "claw", 0, 0, 0.66);
  const orb = mesh(rig.handR, new THREE.IcosahedronGeometry(0.065, 0), orbMat, "orb", 0, 0, 0.7);

  group.userData.orb = orb; group.userData.orbMat = orbMat;
  return group;
}

// pose.act: the orb flares as a spell is cast
export function update(group, t, pose) {
  poseBiped(group, t, pose, STYLES.mage);
  const { orb, orbMat } = group.userData;
  if (!orb) return;
  const casting = pose && pose.act !== "idle" && pose.act !== "dodge" ? 1 : 0, pulse = 0.5 + 0.5 * Math.sin(t * (3 + 9 * casting));
  orb.rotation.z = t * 1.5;
  orb.scale.setScalar(0.92 + 0.16 * pulse + 0.4 * casting);
  orbMat.emissiveIntensity = 0.8 + 0.6 * pulse + 1.2 * casting;
}
