export const meta = {
  id: "prop-rune-stone",
  name: "Rune stone",
  category: "prop",
  footprint: [0.7, 0.7],
  height: 1.3,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const stone = mat(0x5a5862), dark = mat(0x3b3a40), rune = mat(0x8c5be0, { emissive: 0x8c5be0, emissiveIntensity: 1.1 });
  add(g, new THREE.CylinderGeometry(0.34, 0.4, 0.1, 8), dark, 0, 0.05, 0, "base");
  const slab = add(g, new THREE.BoxGeometry(0.42, 0.95, 0.2), stone, 0, 0.56, 0, "slab");
  slab.rotation.z = 0.05;
  add(g, new THREE.BoxGeometry(0.3, 0.14, 0.18), stone, 0.02, 1.08, 0, "cap").rotation.z = 0.2;
  // Carved runes on both faces: thin glowing bars.
  const marks = [[0, 0.82, 0.2, 0.035, 0], [-0.06, 0.66, 0.035, 0.2, 0.3], [0.07, 0.62, 0.035, 0.24, -0.25], [0, 0.42, 0.16, 0.035, 0.5], [0, 0.28, 0.035, 0.14, 0]];
  for (const side of [-1, 1]) marks.forEach(([x, y, w, h, rz], i) => {
    add(g, new THREE.BoxGeometry(w, h, 0.02), rune, x * side, y, side * 0.105, "rune" + i).rotation.z = rz * side + 0.05;
  });
  // A slow ring of four motes circles the stone.
  const ring = new THREE.Group(); ring.name = "ring"; ring.position.y = 0.75;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    add(ring, new THREE.OctahedronGeometry(0.04, 0), rune, 0.42 * Math.cos(a), 0, 0.42 * Math.sin(a), "mote" + i);
  }
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

export function update(group, t) {
  const ring = group.userData.ring;
  if (!ring) return;
  ring.rotation.y = t * 0.8;
  ring.position.y = 0.75 + 0.06 * Math.sin(t * 1.4);
}
