export const meta = {
  id: "prop-weapon-rack",
  name: "Weapon rack",
  category: "prop",
  footprint: [1, 0.4],
  height: 1.2,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mk = (color, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness });
  const woodDark = mk(0x4e3423);
  const wood = mk(0x7a5236);
  const metal = mk(0x9aa3ad, 0.3);
  const metalDark = mk(0x5b636d, 0.3);

  const add = (geo, mat, name, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name; m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // Frame: base, two posts and two horizontal bars at the back (z = -0.14)
  add(new THREE.BoxGeometry(1.0, 0.04, 0.36), woodDark, "base", 0, 0.02, 0);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 1.2, 0.06), woodDark, "post", s * 0.47, 0.6, -0.14);
  add(new THREE.BoxGeometry(0.94, 0.05, 0.05), woodDark, "bar", 0, 0.35, -0.14);
  add(new THREE.BoxGeometry(0.94, 0.05, 0.05), woodDark, "bar", 0, 0.9, -0.14);

  // Weapons stand in front of the bars, leaning back against them.
  const weapon = (name, x, z, lean) => {
    const w = new THREE.Group(); w.name = name;
    w.position.set(x, 0, z); w.rotation.x = lean;
    g.add(w);
    return w;
  };

  // Sword
  const sword = weapon("sword", -0.32, -0.04, -0.06);
  add(new THREE.SphereGeometry(0.025, 8, 6), metalDark, "pommel", 0, 0.03, 0, sword);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8), wood, "grip", 0, 0.07, 0, sword);
  add(new THREE.BoxGeometry(0.16, 0.03, 0.04), metal, "guard", 0, 0.15, 0, sword);
  add(new THREE.BoxGeometry(0.045, 0.75, 0.012), metal, "blade", 0, 0.54, 0, sword);

  // Spear: wood shaft, metal tip
  const spear = weapon("spear", -0.1, -0.04, -0.07);
  add(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8), metalDark, "butt", 0, 0.015, 0, spear);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 8), wood, "shaft", 0, 0.505, 0, spear);
  add(new THREE.ConeGeometry(0.035, 0.18, 8), metal, "tip", 0, 1.07, 0, spear);

  // Axe: wood handle, metal head
  const axe = weapon("axe", 0.0, -0.04, -0.04);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 8), wood, "handle", 0, 0.425, 0, axe);
  add(new THREE.BoxGeometry(0.12, 0.12, 0.03), metal, "head", 0.05, 0.76, 0, axe);
  add(new THREE.BoxGeometry(0.04, 0.18, 0.03), metal, "edge", 0.12, 0.76, 0, axe);

  // Mace: wood handle, metal head
  const mace = weapon("mace", 0.21, -0.04, -0.03);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 8), wood, "handle", 0, 0.35, 0, mace);
  add(new THREE.DodecahedronGeometry(0.055, 0), metalDark, "head", 0, 0.8, 0, mace);

  // Round wooden shield with metal rim, hung from a peg on the upper bar
  const shield = new THREE.Group(); shield.name = "shield";
  shield.position.set(0.37, 0.6, -0.1);
  g.add(shield);
  const disc = add(new THREE.CylinderGeometry(0.13, 0.13, 0.025, 12), wood, "disc", 0, 0, 0, shield);
  disc.rotation.x = Math.PI / 2;
  add(new THREE.TorusGeometry(0.13, 0.012, 6, 12), metal, "rim", 0, 0, 0, shield);
  add(new THREE.SphereGeometry(0.04, 8, 6), metal, "boss", 0, 0, 0.02, shield);
  add(new THREE.BoxGeometry(0.035, 0.26, 0.006), woodDark, "plankV", 0, 0, 0.016, shield);
  add(new THREE.BoxGeometry(0.26, 0.035, 0.006), woodDark, "plankH", 0, 0, 0.016, shield);
  add(new THREE.BoxGeometry(0.03, 0.2, 0.03), woodDark, "peg", 0, 0.2, -0.015, shield);

  return g;
}

export function update(group, t) {}
