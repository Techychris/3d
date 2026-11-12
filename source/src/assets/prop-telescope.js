export const meta = {
  id: "prop-telescope",
  name: "Brass telescope",
  category: "prop",
  footprint: [0.8, 0.8],
  height: 1.3,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const wood = mat(0x4e3423), brass = mat(0xe0b04a, { metalness: 0.3 }), iron = mat(0x5b636d, { metalness: 0.3 }), lens = mat(0x3e5c9a, { emissive: 0x3e5c9a, emissiveIntensity: 0.5 });
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
  for (let i = 0; i < 3; i++) {
    const a = i * 2 * Math.PI / 3 + 0.5, dx = Math.cos(a), dz = Math.sin(a);
    const leg = add(g, new THREE.CylinderGeometry(0.025, 0.03, 0.92, 5), wood, 0.16 * dx, 0.43, 0.16 * dz, "leg" + i);
    leg.quaternion.setFromUnitVectors(up, dir.set(-0.32 * dx, 0.86, -0.32 * dz).normalize());
  }
  add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.08, 6), iron, 0, 0.88, 0, "head");
  // Tube pivots on the head, pointed up at the sky, and pans slowly.
  const tube = new THREE.Group(); tube.name = "tube"; tube.position.y = 0.95;
  const barrel = new THREE.Group(); barrel.name = "barrel"; barrel.rotation.z = -0.9;
  add(barrel, new THREE.CylinderGeometry(0.07, 0.055, 0.6, 8), brass, 0, 0.08, 0, "main");
  add(barrel, new THREE.CylinderGeometry(0.085, 0.085, 0.06, 8), iron, 0, 0.38, 0, "hood");
  add(barrel, new THREE.CylinderGeometry(0.07, 0.07, 0.012, 8), lens, 0, 0.412, 0, "lens");
  add(barrel, new THREE.CylinderGeometry(0.035, 0.04, 0.16, 6), brass, 0, -0.3, 0, "eyepiece");
  add(barrel, new THREE.CylinderGeometry(0.076, 0.076, 0.03, 8), iron, 0, -0.1, 0, "band");
  tube.add(barrel); g.add(tube);
  g.userData.tube = tube;
  return g;
}

export function update(group, t) {
  const tube = group.userData.tube;
  if (!tube) return;
  tube.rotation.y = 0.5 * Math.sin(t * 0.35);
}
