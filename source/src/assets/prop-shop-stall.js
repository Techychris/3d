export const meta = {
  id: "prop-shop-stall",
  name: "Shop stall",
  category: "prop",
  footprint: [1, 0.8],
  height: 1.4,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const wood = mat(0x7a5236), woodDark = mat(0x4e3423);
  const clothRed = mat(0xa8423a), bone = mat(0xe8dcc0);
  const heal = mat(0x5fd38a, { emissive: 0x5fd38a, emissiveIntensity: 0.9 });
  const gold = mat(0xe0b04a, { metalness: 0.3 }), metal = mat(0x9aa3ad, { metalness: 0.3 });

  const add = (geo, m, name, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.name = name; g.add(mesh); return mesh;
  };

  // Counter: body, dark top slab.
  add(new THREE.BoxGeometry(0.92, 0.44, 0.48), wood, "counter", 0, 0.22, 0.05);
  add(new THREE.BoxGeometry(0.96, 0.04, 0.52), woodDark, "counterTop", 0, 0.46, 0.05);

  // Two posts behind the counter, carrying the canopy.
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.04, 0.04, 1.27, 8), wood, "post", s * 0.44, 0.635, -0.24);

  // Striped canopy: six strips alternating red and bone, tilted so the front dips.
  const canopy = new THREE.Group(); canopy.name = "canopy";
  canopy.position.set(0, 1.25, 0.05); canopy.rotation.x = 0.15; g.add(canopy);
  for (let i = 0; i < 6; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(1 / 6, 0.03, 0.7), i % 2 === 0 ? clothRed : bone);
    strip.position.set(-0.5 + (i + 0.5) / 6, 0, 0); strip.name = "stripe"; canopy.add(strip);
  }

  // Two green potion flasks with glow.
  for (const x of [-0.2, 0.0]) {
    add(new THREE.SphereGeometry(0.07, 8, 6), heal, "flask", x, 0.55, 0.1);
    add(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8), heal, "flaskNeck", x, 0.65, 0.1);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), bone, "flaskCork", x, 0.695, 0.1);
  }

  // Coin stack of four gold coins.
  for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10), gold, "coin", 0.3, 0.49 + i * 0.02, 0.1);

  // Small metal sword lying flat on the counter along x.
  add(new THREE.BoxGeometry(0.32, 0.012, 0.035), metal, "blade", 0.0, 0.49, -0.08);
  add(new THREE.BoxGeometry(0.025, 0.02, 0.12), gold, "guard", -0.175, 0.49, -0.08);
  add(new THREE.BoxGeometry(0.07, 0.02, 0.03), woodDark, "grip", -0.2, 0.49, -0.08);

  return g;
}

export function update(group, t) {}
