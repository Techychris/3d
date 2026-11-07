export const meta = {
  id: "boss-necromancer",
  name: "Necromancer",
  category: "boss",
  footprint: [2, 2],
  height: 2.4,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: 0.8, metalness: 0, ...extra
  });
  const stoneDark = mat(0x3b3a40);
  const stone = mat(0x5a5862);
  const magic = mat(0x8c5be0);
  const bone = mat(0xe8dcc0);
  const woodDark = mat(0x4e3423);
  const gemMat = mat(0x8c5be0, { emissive: 0x8c5be0, emissiveIntensity: 1.0 });
  const eyeMat = mat(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 1.2 });
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false
  });

  const add = (geo, m, name, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.name = name; mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };

  // Blob shadow, flat on the ground, about half the footprint radius.
  const shadow = add(new THREE.CircleGeometry(0.9, 16), shadowMat, "shadow", 0, 0.01, 0);
  shadow.rotation.x = -Math.PI / 2;

  // Flowing robe: tapered cylinder, magic-violet hem and collar trim.
  add(new THREE.CylinderGeometry(0.3, 0.62, 1.6, 8), stoneDark, "robe", 0, 0.8, 0);
  const hem = add(new THREE.TorusGeometry(0.62, 0.035, 4, 12), magic, "hemTrim", 0, 0.04, 0);
  hem.rotation.x = Math.PI / 2;
  const collar = add(new THREE.TorusGeometry(0.3, 0.03, 4, 10), magic, "collarTrim", 0, 1.6, 0);
  collar.rotation.x = Math.PI / 2;

  // Hood with a bone skull face and danger-red eyes.
  add(new THREE.SphereGeometry(0.24, 8, 6), stone, "hood", 0, 1.85, 0);
  add(new THREE.SphereGeometry(0.15, 8, 6), bone, "skull", 0, 1.8, 0.17)
    .scale.set(1, 1.1, 0.9);
  add(new THREE.SphereGeometry(0.03, 6, 4), eyeMat, "eyeL", -0.06, 1.83, 0.31);
  add(new THREE.SphereGeometry(0.03, 6, 4), eyeMat, "eyeR", 0.06, 1.83, 0.31);

  // Tall bone-topped staff in the right hand, with a glowing magic gem.
  add(new THREE.CylinderGeometry(0.03, 0.035, 2.2, 6), woodDark, "staff", 0.5, 1.1, 0.1);
  const gem = add(new THREE.OctahedronGeometry(0.1), gemMat, "gem", 0.5, 2.28, 0.1);

  // Three orbiting skulls, positioned in update().
  const skulls = [];
  for (let i = 0; i < 3; i++) {
    skulls.push(add(new THREE.SphereGeometry(0.07, 8, 6), bone, "orbitSkull" + i, 0, 1.1, 0));
  }

  g.userData.gem = gem;
  g.userData.gemMat = gemMat;
  g.userData.skulls = skulls;
  return g;
}

export function update(group, t) {
  const gem = group.userData.gem;
  const gemMat = group.userData.gemMat;
  const skulls = group.userData.skulls;
  if (gem) {
    const p = 0.5 + 0.5 * Math.sin(t * 3);
    const s = 1 + 0.12 * p;
    gem.scale.set(s, s, s);
    gemMat.emissiveIntensity = 0.8 + 0.6 * p;
  }
  // Skulls orbit at radius 0.65 so they stay inside the 2x2 footprint.
  if (!skulls) return;
  for (let i = 0; i < 3; i++) {
    const skull = skulls[i];
    const a = t * 0.9 + (i * Math.PI * 2) / 3;
    skull.position.x = Math.cos(a) * 0.65;
    skull.position.z = Math.sin(a) * 0.65;
    skull.position.y = 1.1 + 0.05 * Math.sin(t * 2 + i);
  }
}
