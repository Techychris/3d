import { biped, fill, poseBiped, STYLES } from "../engine/rig.js";

export const meta = {
  id: "boss-golem",
  name: "Stone golem",
  category: "boss",
  footprint: [2, 2],
  height: 2.6,
  flying: false
};

export function build(THREE) {
  const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...opts });
  const stoneDark = std(0x3b3a40), stone = std(0x5a5862), stoneLight = std(0x8a8794), moss = std(0x4f7a3f);
  const ember = std(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.0 });
  const coreMat = std(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.0 });
  const danger = std(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 1.0 });

  const { group, rig, mesh } = biped(THREE, meta.id, {
    leg: 0.95, torso: 0.95, arm: 1.3, shoulders: 0.72, hips: 0.38, limb: 0.2, depth: 0.85, shadow: 0.95,
    mats: { ...fill(stone), thigh: stoneDark, shin: stoneDark, foot: stoneDark, hips: stoneDark, shoulder: stoneLight, hand: stoneLight },
  });

  // Boulder body: a faceted chest with loose chunks, glowing cracks, moss on the shoulders and an ember core.
  mesh(rig.chest, new THREE.DodecahedronGeometry(0.72, 0).scale(1.12, 0.95, 0.9), stone, "body", 0, 0.5, 0);
  for (const [x, y, z, r, m] of [[-0.45, 0.85, 0.5, 0.22, stoneDark], [0.5, 0.2, 0.5, 0.2, stoneLight], [0.2, -0.05, 0.6, 0.2, stoneDark], [-0.6, -0.05, 0.2, 0.22, stoneLight], [0.1, 1.0, -0.4, 0.3, stoneDark]]) {
    mesh(rig.chest, new THREE.IcosahedronGeometry(r, 0), m, "chunk", x, y, z);
  }
  for (const [w, h, x, y, z, rz] of [[0.05, 0.45, -0.25, 0.55, 0.66, 0.3], [0.04, 0.35, 0.3, 0.2, 0.64, -0.4], [0.35, 0.04, 0.35, 0.75, 0.6, 0.2], [0.04, 0.3, -0.4, 0.0, 0.58, 0.5]]) {
    mesh(rig.chest, new THREE.BoxGeometry(w, h, 0.03).rotateZ(rz), ember, "crack", x, y, z);
  }
  const core = mesh(rig.chest, new THREE.SphereGeometry(0.26, 10, 8), coreMat, "core", 0, 0.5, 0.46);
  for (const arm of [rig.armL, rig.armR]) {
    mesh(arm, new THREE.IcosahedronGeometry(0.42, 0), stoneLight, "shoulderRock", 0, 0.05, 0);
    mesh(arm, new THREE.SphereGeometry(0.3, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1), moss, "moss", 0, 0.3, 0);
  }
  for (const hand of [rig.handL, rig.handR]) mesh(hand, new THREE.IcosahedronGeometry(0.38, 0), stoneLight, "fistRock", 0, -0.1, 0.04);
  for (const shin of [rig.shinL, rig.shinR]) mesh(shin, new THREE.BoxGeometry(0.62, 0.2, 0.74), stoneDark, "footSlab", 0, -0.4, 0.08);

  // Blocky head with a heavy brow and two red eyes.
  mesh(rig.head, new THREE.BoxGeometry(0.5, 0.42, 0.5), stone, "skullBlock", 0, 0.12, 0.12);
  mesh(rig.head, new THREE.BoxGeometry(0.56, 0.1, 0.2), stoneDark, "brow", 0, 0.26, 0.32);
  for (const s of [-1, 1]) mesh(rig.head, new THREE.SphereGeometry(0.055, 8, 6), danger, "eye", s * 0.12, 0.16, 0.38);

  group.userData.chest = rig.chest; group.userData.core = core;
  return group;
}

const GOLEM = { ...STYLES.slam, stride: 3.2 };

// pose.act: the core burns hotter as a slam winds up.
export function update(group, t, pose) {
  poseBiped(group, t, pose, GOLEM);
  const { chest, core } = group.userData;
  if (!core) return;
  const charge = pose && pose.act === "windup" ? pose.k : 0;
  chest.scale.y = 1 + 0.02 * Math.sin(t * 1.6);              // slow heavy breathing
  const p = 0.5 + 0.5 * Math.sin(t * (2.2 + 8 * charge));    // ember core pulse
  core.material.emissiveIntensity = 0.7 + 0.8 * p + 1.6 * charge;
  core.scale.setScalar(0.92 + 0.12 * p + 0.3 * charge);
}
