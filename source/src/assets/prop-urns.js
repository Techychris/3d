export const meta = {
  id: "prop-urns",
  name: "Burial urns",
  category: "prop",
  footprint: [0.8, 0.8],
  height: 0.7,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const clay = mat(0xa8423a), pale = mat(0xe8dcc0), dark = mat(0x4e3423), ash = mat(0x8a8794);
  const V = (x, y) => new THREE.Vector2(x, y);
  const urn = (s, x, z, m, n) => {
    const pts = [V(0, 0), V(0.1, 0), V(0.17, 0.14), V(0.18, 0.28), V(0.1, 0.42), V(0.07, 0.5), V(0.11, 0.56), V(0, 0.56)];
    const o = add(g, new THREE.LatheGeometry(pts, 8), m, x, 0, z, "urn" + n);
    o.scale.setScalar(s);
    add(g, new THREE.CylinderGeometry(0.115 * s, 0.115 * s, 0.03 * s, 8), dark, x, 0.3 * s, z, "band" + n);
  };
  urn(1.2, -0.12, -0.1, clay, 0);
  urn(0.85, 0.24, 0.08, pale, 1);
  urn(0.65, -0.02, 0.27, clay, 2);
  // A broken one: tipped body and a spill of ash.
  const broken = add(g, new THREE.CylinderGeometry(0.1, 0.13, 0.26, 7, 1, true), pale, 0.27, 0.1, -0.24, "broken");
  broken.rotation.z = 1.4; broken.material.side = THREE.DoubleSide;
  add(g, new THREE.CylinderGeometry(0.14, 0.17, 0.03, 7), ash, 0.1, 0.015, -0.27, "ash");
  return g;
}

export function update(group, t) {}
