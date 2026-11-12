export const meta = {
  id: "prop-sarcophagus",
  name: "Stone sarcophagus",
  category: "prop",
  footprint: [0.8, 1.2],
  height: 0.7,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const stone = mat(0x5a5862), dark = mat(0x3b3a40), pale = mat(0x8a8794), gold = mat(0xe0b04a, { metalness: 0.3 });
  add(g, new THREE.BoxGeometry(0.8, 0.1, 1.16), dark, 0, 0.05, 0, "plinth");
  add(g, new THREE.BoxGeometry(0.66, 0.4, 1.04), stone, 0, 0.3, 0, "coffer");
  // Lid sits slightly askew: something got out.
  const lid = new THREE.Group(); lid.name = "lidSlab"; lid.position.set(0.05, 0.5, 0); lid.rotation.y = 0.09;
  add(lid, new THREE.BoxGeometry(0.72, 0.08, 1.1), pale, 0, 0.04, 0, "slab");
  add(lid, new THREE.BoxGeometry(0.4, 0.08, 0.82), stone, 0, 0.12, 0, "ridge");
  add(lid, new THREE.BoxGeometry(0.08, 0.03, 0.42), gold, 0, 0.175, 0.05, "crossLong");
  add(lid, new THREE.BoxGeometry(0.26, 0.03, 0.08), gold, 0, 0.175, 0.16, "crossShort");
  g.add(lid);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(g, new THREE.BoxGeometry(0.1, 0.44, 0.1), dark, sx * 0.33, 0.32, sz * 0.52, "corner");
  }
  return g;
}

export function update(group, t) {}
