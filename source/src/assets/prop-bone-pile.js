export const meta = {
  id: "prop-bone-pile",
  name: "Bone pile",
  category: "prop",
  footprint: [0.9, 0.9],
  height: 0.45,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const bone = mat(0xe8dcc0), dark = mat(0x000000), old = mat(0x8a8794);
  const long = (x, y, z, ry, rz, len, m, n) => {
    const b = new THREE.Group(); b.name = "bone" + n; b.position.set(x, y, z); b.rotation.set(0, ry, rz);
    add(b, new THREE.CylinderGeometry(0.025, 0.025, len, 5), m, 0, 0, 0, "shaft");
    for (const s of [-1, 1]) add(b, new THREE.IcosahedronGeometry(0.045, 0), m, 0, s * len / 2, 0, "knob");
    g.add(b);
  };
  long(-0.15, 0.05, 0.12, 0.4, 1.5, 0.5, bone, 0);
  long(0.12, 0.06, 0.2, -0.9, 1.45, 0.44, old, 1);
  long(0.05, 0.12, -0.05, 1.9, 1.3, 0.48, bone, 2);
  long(-0.2, 0.1, -0.18, 2.6, 1.2, 0.36, old, 3);
  long(0.26, 0.16, -0.08, 0.2, 0.5, 0.34, bone, 4);
  // Ribcage: three half hoops.
  for (let i = 0; i < 3; i++) {
    const rib = add(g, new THREE.TorusGeometry(0.13, 0.02, 4, 7, Math.PI), old, -0.05 + i * 0.09, 0.03, -0.24, "rib" + i);
    rib.rotation.y = Math.PI / 2 + 0.15 * i;
  }
  // Skull on top with dark eye sockets facing the camera side.
  const skull = new THREE.Group(); skull.name = "skull"; skull.position.set(0.02, 0.25, 0.06); skull.rotation.set(-0.2, 0.6, 0.15);
  add(skull, new THREE.IcosahedronGeometry(0.13, 1), bone, 0, 0.03, 0, "cranium");
  add(skull, new THREE.BoxGeometry(0.13, 0.09, 0.1), bone, 0, -0.08, 0.05, "jaw");
  for (const s of [-1, 1]) add(skull, new THREE.BoxGeometry(0.045, 0.045, 0.02), dark, s * 0.05, 0.02, 0.125, "eye");
  g.add(skull);
  return g;
}

export function update(group, t) {}
