export const meta = {
  id: "tile-floor-moss",
  name: "Mossy floor tile",
  category: "tile",
  footprint: [1, 1],
  height: 0.14,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0 });
  const stoneDark = mat(0x3b3a40);
  const stone = mat(0x5a5862);
  const stoneLight = mat(0x8a8794);
  const moss = mat(0x4f7a3f);
  const slime = mat(0x7bc86c);

  const add = (geo, m, name, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.name = name; mesh.position.set(x, y, z); g.add(mesh); return mesh;
  };

  // Dark base slab, top at y = 0.06
  add(new THREE.BoxGeometry(0.98, 0.06, 0.98), stoneDark, "base", 0, 0.03, 0);

  // Four flagstones in a 2x2 grid; the gaps show the dark base. Tops at y = 0.12
  const flagGeo = new THREE.BoxGeometry(0.44, 0.06, 0.44);
  add(flagGeo, stone, "flagstone", -0.245, 0.09, -0.245);
  add(flagGeo, stoneLight, "flagstone", 0.245, 0.09, -0.245);
  add(flagGeo, stoneLight, "flagstone", -0.245, 0.09, 0.245);
  add(flagGeo, stone, "flagstone", 0.245, 0.09, 0.245);

  // Flattened moss patches creeping over the stones (sphere radius, scaled to ~0.04 tall)
  const mossSphere = new THREE.SphereGeometry(1, 8, 5);
  const mossPatches = [
    [-0.28, -0.22, 0.11], [0.18, -0.3, 0.09], [0.3, 0.12, 0.12],
    [-0.1, 0.05, 0.08], [-0.32, 0.3, 0.1], [0.05, 0.32, 0.07]
  ];
  for (const [x, z, r] of mossPatches) {
    const m = add(mossSphere, moss, "moss", x, 0.115, z);
    m.scale.set(r, 0.2 * r, r);
  }

  // Smaller flattened dodecahedra of moss
  const mossStone = new THREE.DodecahedronGeometry(1, 0);
  const mossChunks = [
    [0.0, -0.08, 0.07], [-0.2, 0.22, 0.06], [0.36, -0.1, 0.06]
  ];
  for (const [x, z, r] of mossChunks) {
    const m = add(mossStone, moss, "moss", x, 0.115, z);
    m.scale.set(r, 0.3 * r, r);
  }

  // A few slime-green tufts sitting on the moss
  const tuftGeo = new THREE.ConeGeometry(0.02, 0.04, 5);
  for (const [x, z] of [[-0.28, -0.22], [0.3, 0.12], [-0.1, 0.05], [0.05, 0.32]]) {
    add(tuftGeo, slime, "slime", x, 0.12, z);
  }

  return g;
}

export function update(group, t) {}
