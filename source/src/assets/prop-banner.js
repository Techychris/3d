export const meta = {
  id: "prop-banner",
  name: "Camp banner",
  category: "prop",
  footprint: [0.6, 0.4],
  height: 1.9,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const wood = mat(0x4e3423), cloth = mat(0xa8423a), trim = mat(0xe0b04a, { metalness: 0.3 }), stone = mat(0x5a5862);
  add(g, new THREE.CylinderGeometry(0.14, 0.18, 0.1, 7), stone, 0, 0.05, 0, "base");
  add(g, new THREE.CylinderGeometry(0.035, 0.045, 1.8, 6), wood, 0, 0.95, 0, "pole");
  add(g, new THREE.BoxGeometry(0.6, 0.04, 0.04), wood, 0.2, 1.74, 0, "crossbar");
  add(g, new THREE.OctahedronGeometry(0.06, 0), trim, 0, 1.9, 0, "finial");
  // Cloth hangs from the crossbar in three strips, each pivoting at its top edge, so the sway travels down it.
  const cloths = [];
  let parent = g, y = 1.72;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group(); seg.name = "cloth" + i; seg.position.set(i ? 0 : 0.22, y, 0);
    add(seg, new THREE.BoxGeometry(0.44 - i * 0.08, 0.32, 0.02), cloth, 0, -0.16, 0, "strip");
    if (i === 1) add(seg, new THREE.OctahedronGeometry(0.08, 0), trim, 0, -0.14, 0.012, "emblem").scale.z = 0.2;
    if (i === 2) add(seg, new THREE.ConeGeometry(0.1, 0.16, 4), cloth, 0, -0.38, 0, "tail").rotation.x = Math.PI;
    parent.add(seg); cloths.push(seg);
    parent = seg; y = -0.32;
  }
    g.userData.cloths = cloths;
  return g;
}

export function update(group, t) {
  const cloths = group.userData.cloths;
  if (!cloths) return;
  for (let i = 0; i < cloths.length; i++) cloths[i].rotation.x = (0.06 + 0.05 * i) * Math.sin(t * 1.6 - i * 0.8);
}
