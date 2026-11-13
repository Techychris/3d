import { biped, fill, poseBiped, STYLES } from "../engine/rig.js";

export const meta = {
  id: "hero-warrior",
  name: "Warrior",
  category: "hero",
  footprint: [0.8, 0.8],
  height: 1.0,
  flying: false
};

export function build(THREE) {
  const mat = (color, metal = false) => new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: metal ? 0.5 : 0.8, metalness: metal ? 0.3 : 0
  });
  const stoneDark = mat(0x3b3a40), metal = mat(0x9aa3ad, true), metalDark = mat(0x5b636d, true), gold = mat(0xe0b04a, true);
  const clothRed = mat(0xa8423a), skin = mat(0xd9a27e), wood = mat(0x7a5236), woodDark = mat(0x4e3423);

  const { group, rig, mesh } = biped(THREE, meta.id, {
    leg: 0.3, torso: 0.27, arm: 0.3, shoulders: 0.185, hips: 0.085, limb: 0.05, depth: 0.7, shadow: 0.38,
    mats: { ...fill(metalDark), torso: metal, hips: woodDark, thigh: stoneDark, foot: stoneDark, shoulder: metal, hand: skin },
  });

  // Breastplate trim, red tabard front and back, belt buckle.
  mesh(rig.chest, new THREE.BoxGeometry(0.19, 0.36, 0.03), clothRed, "tabard", 0, 0.08, 0.125);
  mesh(rig.chest, new THREE.BoxGeometry(0.21, 0.3, 0.02), clothRed, "cape", 0, 0.1, -0.13);
  mesh(rig.chest, new THREE.BoxGeometry(0.07, 0.06, 0.03), gold, "buckle", 0, -0.02, 0.135);
  mesh(rig.chest, new THREE.TorusGeometry(0.1, 0.022, 5, 10, Math.PI).rotateZ(Math.PI), gold, "collar", 0, 0.27, 0.04);
  for (const arm of [rig.armL, rig.armR]) mesh(arm, new THREE.SphereGeometry(0.095, 8, 5).scale(1, 0.75, 1), metal, "pauldron", 0, 0.03, 0);
  for (const shin of [rig.shinL, rig.shinR]) mesh(shin, new THREE.BoxGeometry(0.1, 0.05, 0.06), metal, "kneeGuard", 0, -0.01, 0.045);

  // Oversized helmet: dome, dark visor slit, cheek guards, gold band and a red crest that sweeps back.
  mesh(rig.head, new THREE.SphereGeometry(0.2, 10, 8), metal, "helmet", 0, 0.18, 0);
  mesh(rig.head, new THREE.BoxGeometry(0.24, 0.045, 0.06), stoneDark, "visor", 0, 0.17, 0.175);
  mesh(rig.head, new THREE.BoxGeometry(0.045, 0.15, 0.05), metalDark, "noseGuard", 0, 0.13, 0.19);
  for (const s of [-1, 1]) mesh(rig.head, new THREE.BoxGeometry(0.03, 0.13, 0.12), metalDark, "cheekGuard", s * 0.185, 0.09, 0.07);
  mesh(rig.head, new THREE.TorusGeometry(0.2, 0.02, 6, 14).rotateX(Math.PI / 2), gold, "band", 0, 0.2, 0);
  mesh(rig.head, new THREE.TorusGeometry(0.2, 0.035, 5, 10, Math.PI * 0.75).rotateY(Math.PI / 2).rotateX(-0.5), clothRed, "crest", 0, 0.2, 0);

  // Round shield strapped to the left forearm, facing out and forward.
  const shield = new THREE.Group(); shield.name = "shieldArm";
  shield.position.set(0.05, -0.09, 0.03); shield.rotation.set(0, 0, 0.25);
  rig.foreL.add(shield);
  mesh(shield, new THREE.CylinderGeometry(0.17, 0.17, 0.035, 12).rotateZ(Math.PI / 2), wood, "shield");
  mesh(shield, new THREE.TorusGeometry(0.17, 0.024, 6, 14).rotateY(Math.PI / 2), metalDark, "shieldRim", 0.012, 0, 0);
  mesh(shield, new THREE.SphereGeometry(0.055, 8, 6).scale(0.6, 1, 1), gold, "shieldBoss", 0.03, 0, 0);

  // Sword in the right fist: tapered blade along the fist's forward axis, gold guard, wrapped grip, pommel.
  mesh(rig.handR, new THREE.CylinderGeometry(0.02, 0.075, 0.56, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(0.38, 1, 1), metal, "blade", 0, 0, 0.36);
  mesh(rig.handR, new THREE.BoxGeometry(0.05, 0.24, 0.05), gold, "guard", 0, 0, 0.07);
  mesh(rig.handR, new THREE.CylinderGeometry(0.026, 0.026, 0.16, 6).rotateX(Math.PI / 2), woodDark, "handle", 0, 0, -0.01);
  mesh(rig.handR, new THREE.IcosahedronGeometry(0.038, 0), gold, "pommel", 0, 0, -0.1);

  return group;
}

// pose: { move, act: "idle" | "attack" | "bash" | "dodge", k }
export function update(group, t, pose) {
  poseBiped(group, t, pose, STYLES.hero);
}
