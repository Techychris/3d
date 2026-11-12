export const meta = {
  id: "prop-lantern-post",
  name: "Lantern post",
  category: "prop",
  footprint: [0.5, 0.5],
  height: 1.5,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const wood = mat(0x4e3423), iron = mat(0x5b636d, { metalness: 0.3 }), stone = mat(0x5a5862);
  const glass = mat(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.3 });
  add(g, new THREE.CylinderGeometry(0.16, 0.2, 0.12, 8), stone, 0, 0.06, 0, "base");
  add(g, new THREE.CylinderGeometry(0.05, 0.07, 1.3, 6), wood, 0, 0.77, 0, "post");
  add(g, new THREE.BoxGeometry(0.4, 0.05, 0.05), wood, 0.16, 1.38, 0, "arm");
  add(g, new THREE.BoxGeometry(0.04, 0.2, 0.04), wood, 0.07, 1.27, 0, "brace").rotation.z = -0.7;
  // Lantern hangs from the arm tip; the pivot is at the hook so it swings like a pendulum.
  const lantern = new THREE.Group(); lantern.name = "lantern"; lantern.position.set(0.32, 1.36, 0);
  add(lantern, new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), iron, 0, -0.05, 0, "chain");
  add(lantern, new THREE.ConeGeometry(0.1, 0.07, 6), iron, 0, -0.13, 0, "cap");
  add(lantern, new THREE.CylinderGeometry(0.065, 0.05, 0.14, 6), glass, 0, -0.235, 0, "glass");
  add(lantern, new THREE.CylinderGeometry(0.07, 0.07, 0.025, 6), iron, 0, -0.315, 0, "foot");
  g.add(lantern);
  g.userData.lantern = lantern;
  return g;
}

export function update(group, t) {
  const lantern = group.userData.lantern;
  if (!lantern) return;
  lantern.rotation.z = 0.12 * Math.sin(t * 1.7);
  lantern.rotation.x = 0.05 * Math.sin(t * 2.3 + 1);
}
