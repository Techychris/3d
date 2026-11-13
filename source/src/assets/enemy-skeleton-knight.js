import { biped, fill, poseBiped, STYLES } from "../engine/rig.js";

export const meta = {
  id: "enemy-skeleton-knight",
  name: "Skeleton knight",
  category: "enemy",
  footprint: [0.8, 0.8],
  height: 1.1,
  flying: false
};

export function build(THREE) {
  const std = (color, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness, ...extra });
  const bone = std(0xe8dcc0), metal = std(0x5b636d, 0.3), cloth = std(0x3e5c9a), wood = std(0x7a5236), gold = std(0xe0b04a, 0.3), blade = std(0x9aa3ad, 0.3);
  const eye = std(0xff4d3d, 0, { emissive: 0xff4d3d, emissiveIntensity: 1.0 });

  const { group, rig, mesh } = biped(THREE, meta.id, {
    leg: 0.4, torso: 0.3, arm: 0.34, shoulders: 0.19, hips: 0.085, limb: 0.04, depth: 0.7, shadow: 0.38,
    mats: { ...fill(bone), torso: metal, shoulder: metal, shin: metal, foot: metal },
  });

  // Tattered blue tabard front and back, heavy pauldrons, a gorget.
  mesh(rig.chest, new THREE.BoxGeometry(0.2, 0.46, 0.02), cloth, "tabard", 0, 0.05, 0.14);
  mesh(rig.chest, new THREE.BoxGeometry(0.2, 0.46, 0.02), cloth, "tabardBack", 0, 0.05, -0.14);
  mesh(rig.chest, new THREE.BoxGeometry(0.07, 0.09, 0.02).rotateZ(0.15), cloth, "tatter", 0.06, -0.21, 0.14);
  mesh(rig.chest, new THREE.CylinderGeometry(0.075, 0.11, 0.06, 8), metal, "gorget", 0, 0.31, 0);
  for (const arm of [rig.armL, rig.armR]) {
    mesh(arm, new THREE.SphereGeometry(0.105, 8, 5).scale(1, 0.7, 1), metal, "pauldron", 0, 0.03, 0);
    mesh(arm, new THREE.ConeGeometry(0.03, 0.09, 5), metal, "spike", 0, 0.12, 0);
  }

  // Skull under an open-faced helm with a tall crest.
  mesh(rig.head, new THREE.SphereGeometry(0.095, 10, 8), bone, "skull", 0, 0.12, 0);
  mesh(rig.head, new THREE.BoxGeometry(0.11, 0.05, 0.09), bone, "jaw", 0, 0.065, 0.025);
  mesh(rig.head, new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), metal, "helmet", 0, 0.14, 0);
  mesh(rig.head, new THREE.BoxGeometry(0.03, 0.12, 0.2), cloth, "crest", 0, 0.28, -0.02);
  for (const s of [-1, 1]) mesh(rig.head, new THREE.SphereGeometry(0.02, 6, 4), eye, "eye", s * 0.036, 0.125, 0.086);

  // Tower shield on the left forearm: wood face, metal rim and boss. It covers the front while the guard is up.
  const shield = new THREE.Group(); shield.name = "shieldArm";
  shield.position.set(0, -0.1, 0.07); shield.rotation.x = 1.2;
  rig.foreL.add(shield);
  mesh(shield, new THREE.BoxGeometry(0.3, 0.56, 0.04), wood, "shieldFace");
  mesh(shield, new THREE.BoxGeometry(0.34, 0.04, 0.06), metal, "rimTop", 0, 0.28, 0);
  mesh(shield, new THREE.BoxGeometry(0.2, 0.04, 0.06), metal, "rimBottom", 0, -0.3, 0);
  for (const s of [-1, 1]) mesh(shield, new THREE.BoxGeometry(0.04, 0.58, 0.06), metal, "rimSide", s * 0.16, 0, 0);
  mesh(shield, new THREE.SphereGeometry(0.06, 8, 6).scale(1, 1, 0.6), gold, "shieldBoss", 0, 0.04, 0.03);

  // Longsword in the right fist.
  mesh(rig.handR, new THREE.CylinderGeometry(0.015, 0.06, 0.5, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(0.38, 1, 1), blade, "blade", 0, 0, 0.32);
  mesh(rig.handR, new THREE.BoxGeometry(0.04, 0.2, 0.04), gold, "hilt", 0, 0, 0.06);
  mesh(rig.handR, new THREE.CylinderGeometry(0.02, 0.02, 0.13, 6).rotateX(Math.PI / 2), wood, "grip", 0, 0, -0.01);
  return group;
}

// Shield arm held across the body in every act; the sword arm follows the melee style.
const KNIGHT = { ...STYLES.melee, keys: Object.fromEntries(Object.entries(STYLES.melee.keys).map(([act, ks]) => [act, ks.map((kf) => ({ ...kf, aLx: -0.75, fLx: -1.1, aLz: -0.1 }))])), swingL: 0.05, stride: 7 };

export function update(group, t, pose) {
  poseBiped(group, t, pose, KNIGHT);
}
