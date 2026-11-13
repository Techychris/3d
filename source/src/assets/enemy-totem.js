import { accents } from "../engine/rig.js";

export const meta = {
  id: "enemy-totem",
  name: "Stone totem",
  category: "enemy",
  footprint: [0.6, 0.6],
  height: 1.2,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign(
    { color, flatShading: true, roughness: 0.8, metalness: 0 }, extra || {}));
  const stoneDark = mat(0x3b3a40);
  const stone = mat(0x5a5862);
  const stoneLight = mat(0x8a8794);
  const magicGlow = mat(0x8c5be0, { emissive: 0x8c5be0, emissiveIntensity: 1.0 });

  // Stacked carved stone blocks: base, body, face block, cap.
  const block = (w, h, d, y, m, name) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.y = y; b.name = name; g.add(b); return b;
  };
  block(0.5, 0.3, 0.5, 0.15, stoneDark, "base");
  block(0.44, 0.35, 0.44, 0.475, stone, "body");
  block(0.38, 0.3, 0.38, 0.8, stoneLight, "face");
  block(0.26, 0.05, 0.26, 0.975, stoneDark, "cap");

  // Carved face on the front (+z) of the face block.
  const browL = block(0.1, 0.03, 0.02, 0.86, stoneDark, "browL");
  const browR = block(0.1, 0.03, 0.02, 0.86, stoneDark, "browR");
  browL.position.x = -0.09; browL.position.z = 0.192; browL.rotation.z = 0.25;
  browR.position.x = 0.09;  browR.position.z = 0.192; browR.rotation.z = -0.25;
  const mouth = block(0.12, 0.035, 0.02, 0.74, stoneDark, "mouth");
  mouth.position.z = 0.192;

  // Glowing magic-violet eyes.
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), magicGlow);
    eye.position.set(s * 0.09, 0.8, 0.2); eye.name = "eye"; g.add(eye);
  }

  // Magic-violet crystal on top, slowly spinning and pulsing.
  const crystalMat = mat(0x8c5be0, { emissive: 0x8c5be0, emissiveIntensity: 1.0 });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), crystalMat);
  crystal.position.y = 1.09; crystal.name = "crystal"; g.add(crystal);
  g.userData.crystal = crystal;

  // Blob shadow.
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow";
  g.add(shadow);

  return g;
}

// pose: the crystal swells and blazes before each pulse, then snaps small as it fires
export function update(group, t, pose) {
  const crystal = group.userData.crystal;
  if (!crystal) return;
  crystal.rotation.y = t * 1.2;
  const pulse = Math.sin(t * 2.5);
  const { wind, hit } = accents(pose);
  const s = 1 + 0.04 * pulse + 0.5 * wind - 0.25 * hit;
  crystal.scale.set(s, s, s);
  crystal.material.emissiveIntensity = 1.0 + 0.3 * pulse + 2.2 * wind;
  crystal.position.y = 1.09 + 0.12 * wind;
}
