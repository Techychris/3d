export const meta = {
  id: "boss-golem",
  name: "Stone golem",
  category: "boss",
  footprint: [2, 2],
  height: 2.6,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const mat = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...opts });
  const stoneDark = mat(0x3b3a40);
  const stone = mat(0x5a5862);
  const stoneLight = mat(0x8a8794);
  const ember = mat(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.0 });
  const danger = mat(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 1.0 });

  const add = (geo, m, name, x, y, z, parent = g) => {
    const o = new THREE.Mesh(geo, m);
    o.name = name; o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  // Blob shadow, sized to the 2x2 footprint.
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false,
    flatShading: true, roughness: 0.8, metalness: 0
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.95, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow";
  g.add(shadow);

  // Legs, arms, fists, shoulders: symmetric pairs.
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.28, 0.32, 1.0, 7), stoneDark, "leg", s * 0.4, 0.5, 0);
    add(new THREE.BoxGeometry(0.7, 0.18, 0.78), stoneDark, "foot", s * 0.4, 0.09, 0.05);
    add(new THREE.CylinderGeometry(0.2, 0.24, 1.3, 6), stone, "arm", s * 0.64, 1.3, 0);
    add(new THREE.IcosahedronGeometry(0.36, 0), stoneLight, "fist", s * 0.66, 0.6, 0.08);
    add(new THREE.IcosahedronGeometry(0.4, 0), stoneLight, "shoulder", s * 0.62, 1.95, 0);
  }

  // Chest group: torso, stone chunks, ember cracks and core. Scaled for breathing.
  const chest = new THREE.Group(); chest.name = "chest"; g.add(chest);
  const torso = add(new THREE.DodecahedronGeometry(0.75, 0), stone, "body", 0, 1.5, 0, chest);
  torso.scale.set(1.1, 1.0, 0.9);

  add(new THREE.IcosahedronGeometry(0.22, 0), stoneDark, "chunk", -0.45, 1.85, 0.6, chest);
  add(new THREE.IcosahedronGeometry(0.2, 0), stoneLight, "chunk", 0.5, 1.2, 0.55, chest);
  add(new THREE.DodecahedronGeometry(0.2, 0), stoneDark, "chunk", 0.2, 0.95, 0.7, chest);
  add(new THREE.DodecahedronGeometry(0.22, 0), stoneLight, "chunk", -0.6, 0.95, 0.2, chest);

  const c1 = add(new THREE.BoxGeometry(0.05, 0.45, 0.03), ember, "crack", -0.25, 1.55, 0.7, chest);
  c1.rotation.z = 0.3;
  const c2 = add(new THREE.BoxGeometry(0.04, 0.35, 0.03), ember, "crack", 0.3, 1.2, 0.68, chest);
  c2.rotation.z = -0.4;
  const c3 = add(new THREE.BoxGeometry(0.35, 0.04, 0.03), ember, "crack", 0.35, 1.75, 0.66, chest);
  c3.rotation.z = 0.2;
  const c4 = add(new THREE.BoxGeometry(0.04, 0.3, 0.03), ember, "crack", -0.4, 1.0, 0.6, chest);
  c4.rotation.z = 0.5;

  const coreMat = mat(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.0 });
  const core = add(new THREE.SphereGeometry(0.26, 10, 8), coreMat, "core", 0, 1.5, 0.5, chest);

  // Small head sunk between the shoulders, with danger-red eyes.
  add(new THREE.BoxGeometry(0.5, 0.45, 0.5), stone, "head", 0, 2.2, 0.1);
  add(new THREE.SphereGeometry(0.055, 8, 6), danger, "eye", -0.12, 2.25, 0.37);
  add(new THREE.SphereGeometry(0.055, 8, 6), danger, "eye", 0.12, 2.25, 0.37);

  g.userData.chest = chest;
  g.userData.core = core;
  return g;
}

export function update(group, t) {
  const chest = group.userData.chest;
  const core = group.userData.core;
  if (chest) chest.scale.y = 1 + 0.02 * Math.sin(t * 1.6);   // slow heavy breathing
  if (core) {
    const p = 0.5 + 0.5 * Math.sin(t * 2.2);                  // ember core pulse
    core.material.emissiveIntensity = 0.7 + 0.8 * p;
    core.scale.setScalar(0.92 + 0.12 * p);
  }
}
