export const meta = {
  id: "prop-statue",
  name: "Weathered knight statue",
  category: "prop",
  footprint: [0.8, 0.8],
  height: 1.8,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const base = new THREE.Group(); base.name = "base";     // y < 0.35
  const upper = new THREE.Group(); upper.name = "upper";  // y >= 0.35
  g.add(base, upper);

  const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0 });
  const dark = mat(0x3b3a40), stone = mat(0x5a5862), light = mat(0x8a8794), moss = mat(0x4f7a3f);

  const add = (parent, geo, m, name, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.name = name; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };

  // ---- base: plinth, ledge, moss on the plinth face ----
  add(base, new THREE.BoxGeometry(0.7, 0.3, 0.7), dark, "plinth", 0, 0.15, 0);
  add(base, new THREE.BoxGeometry(0.62, 0.05, 0.62), stone, "ledge", 0, 0.325, 0);
  const mossA = add(base, new THREE.DodecahedronGeometry(0.07), moss, "moss", -0.18, 0.12, 0.35);
  mossA.scale.set(1.2, 0.5, 0.5);
  const mossB = add(base, new THREE.DodecahedronGeometry(0.06), moss, "moss", 0.22, 0.31, 0.32);
  mossB.scale.set(1.2, 0.4, 0.6);

  // ---- upper: robed figure, sword, broken arm ----
  add(upper, new THREE.CylinderGeometry(0.15, 0.25, 0.85, 8), stone, "robe", 0, 0.775, 0);
  add(upper, new THREE.CylinderGeometry(0.19, 0.19, 0.05, 8), dark, "belt", 0, 0.98, 0);
  add(upper, new THREE.CylinderGeometry(0.12, 0.15, 0.22, 8), stone, "torso", 0, 1.31, 0);
  add(upper, new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6), light, "neck", 0, 1.45, 0);
  add(upper, new THREE.SphereGeometry(0.12, 10, 8), light, "head", 0, 1.56, 0);
  add(upper, new THREE.BoxGeometry(0.27, 0.14, 0.27), stone, "helmet", 0, 1.66, 0);
  add(upper, new THREE.BoxGeometry(0.2, 0.03, 0.02), dark, "visor", 0, 1.6, 0.135);

  // left shoulder with the arm chipped off just below it
  add(upper, new THREE.SphereGeometry(0.06, 8, 6), stone, "shoulderL", -0.16, 1.36, 0);
  add(upper, new THREE.CylinderGeometry(0.03, 0.05, 0.14, 6), stone, "armStump", -0.17, 1.27, 0);
  const fragment = add(upper, new THREE.BoxGeometry(0.07, 0.06, 0.2), light, "armFragment", -0.3, 0.38, 0.22);
  fragment.rotation.set(0, 0.5, 0.15);
  add(upper, new THREE.IcosahedronGeometry(0.03), light, "rubble", 0.3, 0.39, -0.1);

  // right arm holding the sword
  add(upper, new THREE.SphereGeometry(0.06, 8, 6), stone, "shoulderR", 0.16, 1.36, 0.02);
  const armR = add(upper, new THREE.CylinderGeometry(0.04, 0.04, 0.24, 6), stone, "armR", 0.15, 1.3, 0.18);
  armR.rotation.x = Math.PI / 2;
  add(upper, new THREE.SphereGeometry(0.05, 8, 6), light, "handR", 0.14, 1.25, 0.32);

  // point-down sword planted in front of the figure
  add(upper, new THREE.BoxGeometry(0.06, 0.82, 0.04), light, "blade", 0.14, 0.77, 0.32);
  add(upper, new THREE.BoxGeometry(0.2, 0.04, 0.05), stone, "crossguard", 0.14, 1.2, 0.32);
  add(upper, new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), dark, "grip", 0.14, 1.27, 0.32);
  add(upper, new THREE.SphereGeometry(0.04, 6, 4), stone, "pommel", 0.14, 1.36, 0.32);

  // moss patches on the robe hem
  const mossC = add(upper, new THREE.DodecahedronGeometry(0.08), moss, "moss", 0.08, 0.42, 0.23);
  mossC.scale.set(1.2, 0.4, 0.5);
  const mossD = add(upper, new THREE.DodecahedronGeometry(0.06), moss, "moss", -0.16, 0.37, 0.18);
  mossD.scale.set(1.2, 0.4, 0.5);

  return g;
}

export function update(group, t) {}
