export const meta = {
  id: "prop-bookshelf",
  name: "Bookshelf",
  category: "prop",
  footprint: [1, 0.5],
  height: 1.6,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0 });
  const wood = mat(0x7a5236);
  const woodDark = mat(0x4e3423);
  const bone = mat(0xe8dcc0);
  const stoneDark = mat(0x3b3a40);
  const cloth = { R: mat(0xa8423a), B: mat(0x3e5c9a), G: mat(0x4f7a3f), W: bone };

  const add = (geo, m, name, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.name = name; g.add(mesh); return mesh;
  };

  // Frame: two sides, top cap, back panel
  add(new THREE.BoxGeometry(0.06, 1.6, 0.5), wood, "side", -0.47, 0.8, 0);
  add(new THREE.BoxGeometry(0.06, 1.6, 0.5), wood, "side", 0.47, 0.8, 0);
  add(new THREE.BoxGeometry(1.0, 0.05, 0.5), wood, "top", 0, 1.575, 0);
  add(new THREE.BoxGeometry(0.88, 1.52, 0.02), woodDark, "back", 0, 0.79, -0.24);

  // Four shelf boards (bottom board doubles as the base)
  const shelfYs = [0.015, 0.455, 0.895, 1.335];
  for (const y of shelfYs) add(new THREE.BoxGeometry(0.88, 0.03, 0.46), wood, "shelf", 0, y, 0);

  // Lay out one row of books, centred on x = ox, standing on y = base.
  // A book with a nonzero tilt is lifted so its lowest corner rests on the shelf.
  const layRow = (base, books, ox, leanIdx, lean) => {
    const total = books.reduce((s, b) => s + b[0], 0);
    let x = ox - total / 2;
    books.forEach(([w, h, c], i) => {
      const tilt = i === leanIdx ? lean : 0;
      const cy = base + (w / 2) * Math.abs(Math.sin(tilt)) + (h / 2) * Math.cos(tilt);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.4), cloth[c]);
      m.position.set(x + w / 2, cy, 0); m.rotation.z = tilt; m.name = "book"; g.add(m);
      x += w;
    });
  };

  layRow(0.03, [
    [0.08, 0.36, "R"], [0.06, 0.33, "B"], [0.09, 0.38, "G"], [0.06, 0.30, "W"], [0.08, 0.37, "R"],
    [0.06, 0.34, "B"], [0.09, 0.37, "G"], [0.07, 0.31, "W"], [0.06, 0.35, "R"], [0.08, 0.28, "B"]
  ], 0, 3, 0.2);

  layRow(0.47, [
    [0.07, 0.36, "B"], [0.09, 0.33, "R"], [0.06, 0.38, "W"], [0.08, 0.31, "G"], [0.07, 0.37, "R"],
    [0.06, 0.34, "G"], [0.09, 0.29, "B"], [0.08, 0.36, "W"], [0.06, 0.33, "R"], [0.09, 0.37, "G"]
  ], 0, 5, -0.2);

  layRow(0.91, [
    [0.08, 0.35, "R"], [0.06, 0.37, "B"], [0.09, 0.30, "W"], [0.07, 0.38, "G"], [0.06, 0.33, "R"],
    [0.08, 0.36, "B"], [0.07, 0.31, "W"], [0.09, 0.37, "G"], [0.06, 0.34, "R"], [0.08, 0.28, "B"]
  ], 0, 9, 0.2);

  // Top compartment: short books on the left, skull on the right
  layRow(1.35, [
    [0.07, 0.18, "B"], [0.06, 0.20, "G"], [0.08, 0.17, "R"], [0.06, 0.19, "W"]
  ], -0.16, -1, 0);

  // Skull on the top shelf, facing +z
  const skullX = 0.2;
  add(new THREE.SphereGeometry(0.085, 10, 8), bone, "skull", skullX, 1.44, 0);
  add(new THREE.BoxGeometry(0.09, 0.04, 0.07), bone, "skull", skullX, 1.37, 0.02);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.022, 6, 4), stoneDark, "skullEye", skullX + s * 0.03, 1.46, 0.07);
  }

  return g;
}

export function update(group, t) {}
