import { biped, fill, poseBiped, STYLES } from "../engine/rig.js";

export const meta = {
  id: "enemy-cultist",
  name: "Cultist",
  category: "enemy",
  footprint: [0.7, 0.7],
  height: 1.05,
  flying: false
};

export function build(THREE) {
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const glow = (color, intensity) => std(color, { emissive: color, emissiveIntensity: intensity });
  const robe = std(0xa8423a), sash = std(0x3b3a40), skin = std(0xd9a27e), black = std(0x000000), gold = std(0xe0b04a, { metalness: 0.3 });
  const orbMat = glow(0x8c5be0, 1.2), eyeMat = glow(0xff4d3d, 1.0);
  const auraMat = std(0x8c5be0, { emissive: 0x8c5be0, emissiveIntensity: 0.8, transparent: true, opacity: 0.25, depthWrite: false });

  const { group, rig, mesh } = biped(THREE, meta.id, {
    leg: 0.42, torso: 0.3, arm: 0.34, shoulders: 0.15, hips: 0.07, limb: 0.045, depth: 0.75, shadow: 0.34,
    mats: { ...fill(robe), hand: skin, foot: sash, shin: sash },
  });

  // Long robe that flares to the ground, a dark sash with a hanging tail, wide sleeve cuffs.
  mesh(rig.hips, new THREE.CylinderGeometry(0.15, 0.3, 0.42, 8, 1, true).translate(0, -0.2, 0), robe, "skirt", 0, 0.04, 0);
  mesh(rig.hips, new THREE.CylinderGeometry(0.17, 0.17, 0.07, 8), sash, "sash", 0, 0.06, 0);
  mesh(rig.hips, new THREE.BoxGeometry(0.07, 0.26, 0.025), sash, "sashTail", 0, -0.08, 0.2);
  for (const fore of [rig.foreL, rig.foreR]) mesh(fore, new THREE.CylinderGeometry(0.045, 0.085, 0.13, 7, 1, true), robe, "cuff", 0, -0.12, 0);
  mesh(rig.chest, new THREE.TorusGeometry(0.035, 0.012, 4, 10), gold, "amulet", 0, 0.17, 0.125);
  mesh(rig.chest, new THREE.OctahedronGeometry(0.02, 0), gold, "amuletGem", 0, 0.17, 0.135);

  // Deep pointed hood with a black void for a face and two red eyes.
  mesh(rig.head, new THREE.SphereGeometry(0.165, 10, 8), robe, "hood", 0, 0.13, 0);
  mesh(rig.head, new THREE.ConeGeometry(0.13, 0.3, 8).rotateX(-0.5), robe, "hoodTip", 0, 0.27, -0.09);
  mesh(rig.head, new THREE.CircleGeometry(0.115, 10).scale(1, 0.9, 1), black, "face", 0, 0.12, 0.15);
  for (const s of [-1, 1]) mesh(rig.head, new THREE.SphereGeometry(0.022, 6, 4), eyeMat, "eye", s * 0.045, 0.14, 0.158);

  // The orb floats between the hands: it rides the chest, so it lifts when the arms go up.
  const orb = mesh(rig.chest, new THREE.IcosahedronGeometry(0.07, 0), orbMat, "orb", 0, 0.12, 0.3);
  const aura = mesh(rig.chest, new THREE.SphereGeometry(0.11, 10, 8), auraMat, "aura", 0, 0.12, 0.3);

  group.userData.orb = orb; group.userData.aura = aura; group.userData.orbMat = orbMat;
  return group;
}

// pose.act: the orb rises and swells through the windup, then flares on the cast.
export function update(group, t, pose) {
  poseBiped(group, t, pose, STYLES.cast);
  const { orb, aura, orbMat } = group.userData;
  if (!orb) return;
  const k = pose ? pose.k : 0, charge = pose && pose.act === "windup" ? k : pose && pose.act === "attack" ? 1 - k : 0;
  const pulse = 0.5 + 0.5 * Math.sin(t * (3 + 9 * charge));
  orb.position.y = aura.position.y = 0.12 + 0.36 * charge + Math.sin(t * 2.5) * 0.012;
  orb.rotation.y = t * 1.5;
  orb.scale.setScalar(0.92 + 0.16 * pulse + 0.7 * charge);
  aura.scale.setScalar(0.95 + 0.15 * pulse + 0.9 * charge);
  orbMat.emissiveIntensity = 0.8 + 0.6 * pulse + 1.2 * charge;
}
