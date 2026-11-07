export const meta = {
  id: "tile-floor-grate",
  name: "Floor grate tile",
  category: "tile",
  footprint: [1, 1],
  height: 0.12,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });

  const stone = mat(0x5a5862);
  const stoneLight = mat(0x8a8794);
  const stoneDark = mat(0x3b3a40);
  const iron = mat(0x5b636d, { metalness: 0.3 });
  const heal = mat(0x5fd38a, { emissive: 0x5fd38a, emissiveIntensity: 0.75 });

  const add = (geo, m, name, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.name = name; g.add(mesh); return mesh;
  };

  // Flagstone border: four strips around a 0.6 x 0.6 pit opening. Top surface at y = 0.12.
  const H = 0.12;
  const side = new THREE.BoxGeometry(0.2, H, 0.5);
  const end = new THREE.BoxGeometry(0.3, H, 0.2);
  add(side, stone, "flag", -0.4, H / 2, -0.25);
  add(side, stoneLight, "flag", -0.4, H / 2, 0.25);
  add(side, stoneLight, "flag", 0.4, H / 2, -0.25);
  add(side, stone, "flag", 0.4, H / 2, 0.25);
  add(end, stone, "flag", -0.15, H / 2, -0.4);
  add(end, stoneLight, "flag", 0.15, H / 2, -0.4);
  add(end, stoneLight, "flag", -0.15, H / 2, 0.4);
  add(end, stone, "flag", 0.15, H / 2, 0.4);

  // Pit floor sits low inside the opening, well below the grate.
  add(new THREE.PlaneGeometry(0.6, 0.6), stoneDark, "pit", 0, 0.003, 0).rotation.x = -Math.PI / 2;

  // Faint heal-green glow deep in the pit: a squashed low-poly sphere.
  const glow = add(new THREE.SphereGeometry(0.09, 8, 6), heal, "glow", 0, 0.045, 0);
  glow.scale.set(1, 0.45, 1);
  g.userData.glow = glow;

  // Grate: 5 bars running along x and 5 along z, forming a grid over the opening.
  const xBar = new THREE.BoxGeometry(0.6, 0.03, 0.05);   // top at y = 0.145
  const zBar = new THREE.BoxGeometry(0.05, 0.025, 0.6);  // top at y = 0.1375
  for (const p of [-0.24, -0.12, 0, 0.12, 0.24]) {
    add(xBar, iron, "bar", 0, 0.13, p);
    add(zBar, iron, "bar", p, 0.125, 0);
  }

  return g;
}

export function update(group, t) {
  const glow = group.userData.glow;
  if (glow) glow.material.emissiveIntensity = 0.75 + 0.12 * Math.sin(t * 1.5);
}
