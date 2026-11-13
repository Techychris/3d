import { biped, fill, poseBiped, STYLES } from "../engine/rig.js";

export const meta = {
  id: "boss-necromancer",
  name: "Necromancer",
  category: "boss",
  footprint: [2, 2],
  height: 2.4,
  flying: false
};

export function build(THREE) {
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const stoneDark = std(0x3b3a40), stone = std(0x5a5862), magic = std(0x8c5be0), bone = std(0xe8dcc0), woodDark = std(0x4e3423);
  const gemMat = std(0x8c5be0, { emissive: 0x8c5be0, emissiveIntensity: 1.0 });
  const eyeMat = std(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 1.2 });

  const { group, rig, mesh } = biped(THREE, meta.id, {
    leg: 0.95, torso: 0.62, arm: 0.8, shoulders: 0.32, hips: 0.14, limb: 0.075, depth: 0.75, shadow: 0.9,
    mats: { ...fill(stoneDark), hand: bone, fore: bone, shoulder: stone },
  });

  // Floor-length robe with violet trim, a high collar, and a tattered mantle over the shoulders.
  mesh(rig.hips, new THREE.CylinderGeometry(0.33, 0.62, 0.95, 10, 1, true).translate(0, -0.46, 0), stoneDark, "robe", 0, 0.04, 0);
  mesh(rig.hips, new THREE.TorusGeometry(0.62, 0.035, 4, 14).rotateX(Math.PI / 2), magic, "hemTrim", 0, -0.9, 0);
  mesh(rig.hips, new THREE.BoxGeometry(0.16, 0.9, 0.03), magic, "stole", 0, -0.4, 0.42).rotation.x = -0.3;
  mesh(rig.chest, new THREE.CylinderGeometry(0.2, 0.42, 0.26, 8, 1, true), stone, "mantle", 0, 0.52, 0);
  mesh(rig.chest, new THREE.TorusGeometry(0.21, 0.03, 4, 10).rotateX(Math.PI / 2), magic, "collarTrim", 0, 0.65, 0);
  for (const fore of [rig.foreL, rig.foreR]) mesh(fore, new THREE.CylinderGeometry(0.08, 0.17, 0.3, 7, 1, true), stoneDark, "sleeve", 0, -0.2, 0);

  // Hooded skull with a crown of bone spikes.
  mesh(rig.head, new THREE.SphereGeometry(0.26, 8, 6), stone, "hood", 0, 0.22, -0.03);
  mesh(rig.head, new THREE.SphereGeometry(0.16, 8, 6).scale(1, 1.1, 0.9), bone, "skull", 0, 0.18, 0.13);
  mesh(rig.head, new THREE.BoxGeometry(0.16, 0.06, 0.1), bone, "jaw", 0, 0.03, 0.17);
  for (const s of [-1, 1]) mesh(rig.head, new THREE.SphereGeometry(0.032, 6, 4), eyeMat, "eye", s * 0.06, 0.2, 0.275);
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.5;
    mesh(rig.head, new THREE.ConeGeometry(0.035, 0.2 - Math.abs(i - 2) * 0.04, 4), bone, "crownSpike", Math.sin(a) * 0.23, 0.45 - Math.abs(i - 2) * 0.03, Math.cos(a) * 0.12 - 0.02);
  }

  // Staff in the right fist: it stands upright at rest and swings with the casting arm. A gem floats in its fork.
  mesh(rig.handR, new THREE.CylinderGeometry(0.03, 0.035, 2.1, 6).rotateX(Math.PI / 2), woodDark, "staff", 0, 0, 0.35);
  for (const s of [-1, 1]) mesh(rig.handR, new THREE.CylinderGeometry(0.02, 0.028, 0.3, 5).rotateX(Math.PI / 2 + s * 0.45), woodDark, "staffFork", 0, s * 0.07, 1.5);
  const gem = mesh(rig.handR, new THREE.OctahedronGeometry(0.11), gemMat, "gem", 0, 0, 1.56);

  const skulls = [];
  for (let i = 0; i < 3; i++) skulls.push(mesh(group, new THREE.SphereGeometry(0.075, 8, 6).scale(1, 1.1, 1), bone, "orbitSkull" + i, 0, 1.1, 0));

  group.userData.gem = gem; group.userData.gemMat = gemMat; group.userData.skulls = skulls;
  return group;
}

// The staff hand: held upright at rest, raised high on the windup, levelled at the target on the cast.
const keys = Object.fromEntries(Object.entries(STYLES.cast.keys).map(([act, ks]) => [act, ks.map((kf) => ({ ...kf, wR: kf.aRx < -2 ? -1.3 : kf.aRx < -1 ? 0.6 : -1.2, aLz: kf.aLz + 0.15 }))]));
const NECRO = { ...STYLES.cast, keys, stride: 3, swingR: 0, swingL: 0.1 };

// pose.act: the skulls spin faster and tighter as a spell charges, and the gem flares.
export function update(group, t, pose) {
  poseBiped(group, t, pose, NECRO);
  const { gem, gemMat, skulls } = group.userData;
  if (!gem) return;
  const charge = pose && pose.act === "windup" ? pose.k : 0;
  const p = 0.5 + 0.5 * Math.sin(t * (3 + 10 * charge));
  gem.scale.setScalar(1 + 0.12 * p + 0.5 * charge);
  gem.rotation.z = t * 2;
  gemMat.emissiveIntensity = 0.8 + 0.6 * p + 1.5 * charge;
  for (let i = 0; i < 3; i++) {
    const a = t * (0.9 + 2.5 * charge) + (i * Math.PI * 2) / 3, rad = 0.75 - 0.25 * charge;
    skulls[i].position.set(Math.cos(a) * rad, 1.15 + 0.5 * charge + 0.06 * Math.sin(t * 2 + i), Math.sin(a) * rad);
    skulls[i].rotation.y = -a + Math.PI / 2;
  }
}
