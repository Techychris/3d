export const meta = {
  id: "prop-crystal-cluster",
  name: "Arcane crystal cluster",
  category: "prop",
  footprint: [0.8, 0.8],
  height: 1.2,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const rock = mat(0x3b3a40), crystal = mat(0x8c5be0, { emissive: 0x8c5be0, emissiveIntensity: 0.7 }), core = mat(0xe8dcc0, { emissive: 0x8c5be0, emissiveIntensity: 1.2 });
  add(g, new THREE.CylinderGeometry(0.3, 0.38, 0.14, 7), rock, 0, 0.07, 0, "rock");
  const spikes = [[0, 0, 0.85, 0.14, 0, 0], [0.18, 0.06, 0.55, 0.1, 0, -0.35], [-0.17, 0.02, 0.5, 0.09, 0.1, 0.4], [0.02, 0.19, 0.4, 0.08, 0.45, 0], [-0.04, -0.2, 0.36, 0.08, -0.5, 0.1]];
  spikes.forEach(([x, z, h, r, rx, rz], i) => {
    // A crystal = hexagonal shaft with a pointed tip, tilted out from the middle.
    const c = new THREE.Group(); c.name = "crystal" + i; c.position.set(x, 0.1, z); c.rotation.set(rx, 0, rz);
    add(c, new THREE.CylinderGeometry(r, r * 0.8, h * 0.7, 6), crystal, 0, h * 0.35, 0, "shaft");
    add(c, new THREE.ConeGeometry(r, h * 0.3, 6), crystal, 0, h * 0.85, 0, "tip");
    g.add(c);
  });
  // A loose shard hovers and turns above the tallest crystal.
  const shard = add(g, new THREE.OctahedronGeometry(0.09, 0), core, 0, 1.08, 0, "shard");
  shard.scale.y = 1.6;
  g.userData.shard = shard;
  return g;
}

export function update(group, t) {
  const shard = group.userData.shard;
  if (!shard) return;
  shard.position.y = 1.08 + 0.05 * Math.sin(t * 1.8);
  shard.rotation.y = t * 1.2;
}
