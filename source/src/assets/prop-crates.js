export const meta = {
  id: "prop-crates",
  name: "Stacked crates",
  category: "prop",
  footprint: [1, 1],
  height: 0.95,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const wood = mat(0x7a5236), dark = mat(0x4e3423), iron = mat(0x5b636d, { metalness: 0.3 }), cloth = mat(0xe8dcc0);
  const crate = (s, x, y, z, ry, n) => {
    const c = new THREE.Group(); c.name = "crate" + n; c.position.set(x, y, z); c.rotation.y = ry;
    add(c, new THREE.BoxGeometry(s, s, s), wood, 0, s / 2, 0, "box");
    // Edge battens top and bottom, plus one diagonal brace on the front.
    for (const yy of [0.04, s - 0.04]) {
      add(c, new THREE.BoxGeometry(s + 0.03, 0.06, s + 0.03), dark, 0, yy, 0, "batten");
    }
    add(c, new THREE.BoxGeometry(s * 1.2, 0.05, 0.02), dark, 0, s / 2, s / 2 + 0.01, "brace").rotation.z = 0.78;
    g.add(c);
  };
  crate(0.5, -0.18, 0, -0.1, 0.1, 0);
  crate(0.42, 0.3, 0, 0.16, -0.3, 1);
  crate(0.38, -0.14, 0.5, -0.08, 0.5, 2);
  add(g, new THREE.BoxGeometry(0.44, 0.03, 0.3), cloth, 0.3, 0.435, 0.16, "tarp").rotation.y = -0.3;
  add(g, new THREE.BoxGeometry(0.1, 0.06, 0.02), iron, -0.18, 0.3, 0.16, "latch").rotation.y = 0.1;
  return g;
}

export function update(group, t) {}
