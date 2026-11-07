export const meta = {
  id: "prop-barrels",
  name: "Barrel and crate cluster",
  category: "prop",
  footprint: [1, 1],
  height: 0.8,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness });
  const wood = mat(0x7a5236);
  const woodDark = mat(0x4e3423);
  const metalDark = mat(0x5b636d, 0.3);
  const cloth = mat(0xa8423a);

  // Shared barrel profile: radius (x) against height (y), closed at both ends.
  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.13, 0),
    new THREE.Vector2(0.15, 0.05),
    new THREE.Vector2(0.17, 0.2),
    new THREE.Vector2(0.15, 0.35),
    new THREE.Vector2(0.13, 0.4),
    new THREE.Vector2(0, 0.4)
  ];
  const barrelGeo = new THREE.LatheGeometry(profile, 8);
  const hoopGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.02, 8);

  // One barrel: bulged body plus two metal hoops, origin at its base centre.
  const makeBarrel = (name, x, z, sx, sy, sz) => {
    const b = new THREE.Group(); b.name = name;
    b.position.set(x, 0, z); b.scale.set(sx, sy, sz);
    const body = new THREE.Mesh(barrelGeo, wood); body.name = "body"; b.add(body);
    for (const y of [0.08, 0.32]) {
      const hoop = new THREE.Mesh(hoopGeo, metalDark);
      hoop.position.y = y; hoop.name = "hoop"; b.add(hoop);
    }
    g.add(b);
    return b;
  };
  makeBarrel("barrelA", -0.2, -0.1, 1, 2, 1);        // tall barrel, 0.8 high
  makeBarrel("barrelB", 0.18, -0.2, 0.95, 1.7, 0.95); // slightly shorter, 0.68 high

  // Small crate in front-left, with two dark straps.
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), wood);
  crate.position.set(-0.16, 0.14, 0.24); crate.name = "crate"; g.add(crate);
  for (const y of [0.05, 0.23]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.03, 0.29), woodDark);
    strap.position.set(-0.16, y, 0.24); strap.name = "strap"; g.add(strap);
  }

  // Cloth sack in front-right: squashed sphere with a gathered neck.
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), cloth);
  sack.scale.set(1, 0.85, 1);
  sack.position.set(0.2, 0.11, 0.2); sack.name = "sack"; g.add(sack);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.06, 6), cloth);
  neck.position.set(0.2, 0.23, 0.2); neck.name = "sackNeck"; g.add(neck);

  return g;
}

export function update(group, t) {}
