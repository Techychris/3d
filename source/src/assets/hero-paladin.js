export const meta = {
  id: "hero-paladin",
  name: "Paladin",
  category: "hero",
  footprint: [0.8, 0.8],
  height: 1.05,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const mat = (color, isMetal) => new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: 0.8, metalness: isMetal ? 0.3 : 0
  });
  const metal = mat(0x9aa3ad, true);
  const metalDark = mat(0x5b636d, true);
  const gold = mat(0xe0b04a, true);
  const bone = mat(0xe8dcc0, false);
  const wood = mat(0x7a5236, false);
  const woodDark = mat(0x4e3423, false);
  const slit = mat(0x3b3a40, false);

  const add = (geo, m, name, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.name = name; g.add(mesh);
    return mesh;
  };

  // Blob shadow
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, roughness: 0.8, metalness: 0
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  // Legs and boots
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.18, 0.36, 0.2), metal, "leg", s * 0.11, 0.18, 0);
    add(new THREE.BoxGeometry(0.2, 0.1, 0.24), metalDark, "boot", s * 0.11, 0.05, 0.02);
  }

  // Belt
  add(new THREE.BoxGeometry(0.46, 0.05, 0.32), woodDark, "belt", 0, 0.38, 0);

  // Cuirass (torso, breathes in update)
  const torso = add(new THREE.BoxGeometry(0.44, 0.36, 0.3), metal, "torso", 0, 0.54, 0);
  add(new THREE.BoxGeometry(0.3, 0.03, 0.02), gold, "chestTrim", 0, 0.66, 0.155);

  // Bone tabard with gold cross
  add(new THREE.BoxGeometry(0.2, 0.34, 0.02), bone, "tabard", 0, 0.42, 0.165);
  add(new THREE.BoxGeometry(0.04, 0.22, 0.01), gold, "crossV", 0, 0.46, 0.18);
  add(new THREE.BoxGeometry(0.14, 0.04, 0.01), gold, "crossH", 0, 0.5, 0.18);

  // Pauldrons, arms, gorget
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.12, 8, 6), metal, "pauldron", s * 0.27, 0.7, 0);
    add(new THREE.BoxGeometry(0.1, 0.3, 0.1), metalDark, "arm", s * 0.27, 0.5, 0);
  }
  add(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 8), metalDark, "gorget", 0, 0.74, 0);

  // Great helm with visor slit and gold band
  add(new THREE.BoxGeometry(0.34, 0.28, 0.32), metal, "helm", 0, 0.9, 0);
  add(new THREE.BoxGeometry(0.36, 0.03, 0.34), gold, "helmBand", 0, 0.98, 0);
  add(new THREE.BoxGeometry(0.22, 0.035, 0.01), slit, "visor", 0, 0.9, 0.165);

  // Kite shield on the left arm (+x side), metal with gold cross
  const sh = new THREE.Shape();
  sh.moveTo(-0.12, 0.26); sh.lineTo(0.12, 0.26); sh.lineTo(0.12, 0.02);
  sh.lineTo(0, -0.26); sh.lineTo(-0.12, 0.02); sh.lineTo(-0.12, 0.26);
  const shieldGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false });
  add(shieldGeo, metal, "shield", 0.3, 0.5, 0.1);
  add(new THREE.BoxGeometry(0.035, 0.28, 0.01), gold, "shieldCrossV", 0.3, 0.56, 0.146);
  add(new THREE.BoxGeometry(0.18, 0.035, 0.01), gold, "shieldCrossH", 0.3, 0.6, 0.146);

  // Warhammer in the right hand (-x side)
  add(new THREE.SphereGeometry(0.06, 8, 6), metal, "hand", -0.33, 0.4, 0.08);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 6), wood, "hammerHaft", -0.33, 0.5, 0.08);
  add(new THREE.BoxGeometry(0.12, 0.16, 0.12), metal, "hammerHead", -0.33, 0.84, 0.08);
  add(new THREE.BoxGeometry(0.13, 0.02, 0.13), gold, "hammerBand", -0.33, 0.84, 0.08);

  g.userData.torso = torso;
  return g;
}

export function update(group, t) {
  const torso = group.userData.torso;
  if (torso) torso.scale.y = 1 + 0.015 * Math.sin(t * 2);
}
