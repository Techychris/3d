export const meta = {
  id: "prop-altar",
  name: "Ritual altar",
  category: "prop",
  footprint: [1, 0.6],
  height: 0.9,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const stoneDark = mat(0x3b3a40);
  const stoneLight = mat(0x8a8794);
  const cloth = mat(0xa8423a);
  const bone = mat(0xe8dcc0);
  const woodDark = mat(0x4e3423);
  const ember = mat(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.0 });

  const add = (geo, m, name, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.name = name; mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };

  // stepped stone-dark base and stone-light slab
  add(new THREE.BoxGeometry(0.96, 0.12, 0.56), stoneDark, "base", 0, 0.06, 0);
  add(new THREE.BoxGeometry(0.84, 0.12, 0.46), stoneDark, "baseStep", 0, 0.18, 0);
  add(new THREE.BoxGeometry(0.76, 0.32, 0.4), stoneLight, "slab", 0, 0.40, 0);

  // cloth-red runner over the top, draped down the front
  add(new THREE.BoxGeometry(0.76, 0.02, 0.42), cloth, "runner", 0, 0.57, 0);
  add(new THREE.BoxGeometry(0.76, 0.22, 0.02), cloth, "drape", 0, 0.45, 0.21);

  // open book in the middle of the runner
  add(new THREE.BoxGeometry(0.3, 0.02, 0.24), woodDark, "bookCover", 0, 0.59, 0.04);
  add(new THREE.BoxGeometry(0.13, 0.02, 0.2), bone, "pageL", -0.075, 0.61, 0.04);
  add(new THREE.BoxGeometry(0.13, 0.02, 0.2), bone, "pageR", 0.075, 0.61, 0.04);

  // five bone candles of different heights, each with an ember flame
  const candles = [[-0.3, 0.14], [-0.15, 0.18], [0, 0.22], [0.15, 0.16], [0.3, 0.12]];
  for (let i = 0; i < candles.length; i++) {
    const [x, h] = candles[i];
    add(new THREE.CylinderGeometry(0.025, 0.025, h, 8), bone, "candle" + i, x, 0.58 + h / 2, -0.1);
    add(new THREE.ConeGeometry(0.025, 0.06, 6), ember, "flame", x, 0.58 + h + 0.03, -0.1);
  }

  return g;
}

export function update(group, t) {
  // deterministic flicker; each flame gets its own phase from its child index
  const kids = group.children;
  for (let i = 0; i < kids.length; i++) {
    const c = kids[i];
    if (c.name !== "flame") continue;
    c.scale.y = 1 + 0.15 * Math.sin(t * 9 + i * 1.7);
    c.scale.x = 1 + 0.08 * Math.sin(t * 13 + i * 2.9);
    c.scale.z = c.scale.x;
  }
}
