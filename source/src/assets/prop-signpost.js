export const meta = {
  id: "prop-signpost",
  name: "Trail signpost",
  category: "prop",
  footprint: [0.7, 0.4],
  height: 1.3,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, o) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...o });
  const add = (parent, geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; parent.add(o); return o; };
  const wood = mat(0x7a5236), dark = mat(0x4e3423), paint = mat(0xe8dcc0), stone = mat(0x5a5862);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.4;
    add(g, new THREE.IcosahedronGeometry(0.09, 0), stone, 0.13 * Math.cos(a), 0.05, 0.13 * Math.sin(a), "rock" + i);
  }
  add(g, new THREE.CylinderGeometry(0.045, 0.055, 1.25, 6), dark, 0, 0.625, 0, "post").rotation.z = 0.04;
  const board = (y, dir, ry, n) => {
    const b = new THREE.Group(); b.name = "board" + n; b.position.set(0.02, y, 0.05); b.rotation.y = ry;
    add(b, new THREE.BoxGeometry(0.5, 0.15, 0.03), wood, dir * 0.12, 0, 0, "plank");
    const tip = add(b, new THREE.CylinderGeometry(0.087, 0.087, 0.03, 3), wood, dir * 0.41, 0, 0, "tip");
    tip.rotation.set(Math.PI / 2, 0, dir * Math.PI / 2);
    for (let i = 0; i < 3; i++) add(b, new THREE.BoxGeometry(0.07, 0.02, 0.01), paint, dir * (0.02 + i * 0.1), 0, 0.02, "mark");
    g.add(b);
  };
  board(1.08, 1, 0.15, 0);
  board(0.86, -1, -0.2, 1);
  return g;
}

export function update(group, t) {}
