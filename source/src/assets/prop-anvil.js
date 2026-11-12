export const meta = {
  id: "prop-anvil",
  name: "Anvil and stump",
  category: "prop",
  footprint: [0.8, 0.6],
  height: 0.8,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const wood = mat(0x7a5236), dark = mat(0x4e3423), iron = mat(0x5b636d, { metalness: 0.3 }), steel = mat(0x9aa3ad, { metalness: 0.3 }), hot = mat(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.0 });
  add(g, new THREE.CylinderGeometry(0.26, 0.3, 0.36, 9), wood, 0, 0.18, 0, "stump");
  add(g, new THREE.CylinderGeometry(0.27, 0.27, 0.03, 9), dark, 0, 0.1, 0, "hoop");
  add(g, new THREE.BoxGeometry(0.26, 0.06, 0.18), iron, 0, 0.39, 0, "foot");
  add(g, new THREE.BoxGeometry(0.14, 0.12, 0.12), iron, 0, 0.47, 0, "waist");
  add(g, new THREE.BoxGeometry(0.42, 0.1, 0.2), steel, 0, 0.58, 0, "face");
  add(g, new THREE.ConeGeometry(0.075, 0.24, 6), steel, 0.32, 0.59, 0, "horn").rotation.z = -Math.PI / 2;
  // A blade blank cooling on the face, and the hammer resting beside it.
  add(g, new THREE.BoxGeometry(0.3, 0.015, 0.05), hot, -0.02, 0.64, 0.03, "blank").rotation.y = 0.3;
  const hammer = new THREE.Group(); hammer.name = "hammer"; hammer.position.set(-0.2, 0.02, 0.26); hammer.rotation.set(-0.3, 0.6, -0.3);
  add(hammer, new THREE.CylinderGeometry(0.018, 0.018, 0.4, 5), dark, 0, 0.2, 0, "handle");
  add(hammer, new THREE.BoxGeometry(0.16, 0.09, 0.09), iron, 0, 0.4, 0, "headBlock");
  g.add(hammer);
  return g;
}

export function update(group, t) {}
