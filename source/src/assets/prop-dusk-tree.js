export const meta = {
  id: "prop-dusk-tree",
  name: "Dusk tree",
  category: "prop",
  footprint: [1, 1],
  height: 1.8,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const bark = mat(0x4e3423), leaf = mat(0x4f7a3f), tip = mat(0x7bc86c), glow = mat(0xe0b04a, { emissive: 0xe0b04a, emissiveIntensity: 0.9 });
  add(g, new THREE.CylinderGeometry(0.1, 0.17, 0.8, 6), bark, 0, 0.4, 0, "trunk");
  add(g, new THREE.CylinderGeometry(0.04, 0.07, 0.4, 5), bark, 0.14, 0.78, 0.02, "branch").rotation.z = -0.8;
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    add(g, new THREE.ConeGeometry(0.07, 0.2, 4), bark, 0.17 * Math.cos(a), 0.06, 0.17 * Math.sin(a), "root" + i);
  }
  // Canopy: three low-poly blobs that sway together around the trunk top.
  const canopy = new THREE.Group(); canopy.name = "canopy"; canopy.position.y = 0.8;
  add(canopy, new THREE.IcosahedronGeometry(0.46, 0), leaf, 0, 0.42, 0, "crown");
  add(canopy, new THREE.IcosahedronGeometry(0.32, 0), leaf, 0.3, 0.22, 0.08, "side0");
  add(canopy, new THREE.IcosahedronGeometry(0.28, 0), tip, -0.26, 0.3, -0.1, "side1");
  add(canopy, new THREE.IcosahedronGeometry(0.2, 0), tip, 0.05, 0.74, 0.05, "top");
  // Two hanging lights: warm light means safety.
  add(canopy, new THREE.OctahedronGeometry(0.05, 0), glow, 0.3, -0.06, 0.2, "light0");
  add(canopy, new THREE.OctahedronGeometry(0.045, 0), glow, -0.28, 0.02, 0.12, "light1");
  g.add(canopy);
  g.userData.canopy = canopy;
  return g;
}

export function update(group, t) {
  const canopy = group.userData.canopy;
  if (!canopy) return;
  canopy.rotation.z = 0.025 * Math.sin(t * 0.9);
  canopy.rotation.x = 0.02 * Math.sin(t * 1.3 + 0.7);
}
