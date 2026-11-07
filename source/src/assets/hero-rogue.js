export const meta = {
  id: "hero-rogue",
  name: "Rogue",
  category: "hero",
  footprint: [0.8, 0.8],
  height: 1.0,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const mat = (color, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness });
  const stoneDark = mat(0x3b3a40);
  const stone = mat(0x5a5862);
  const clothRed = mat(0xa8423a);
  const skin = mat(0xd9a27e);
  const woodDark = mat(0x4e3423);
  const metal = mat(0x9aa3ad, 0.3);
  const metalDark = mat(0x5b636d, 0.3);
  const gold = mat(0xe0b04a, 0.3);

  // Blob shadow on the ground (not moved by the idle bob)
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false,
    flatShading: true, roughness: 0.8, metalness: 0
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow";
  g.add(shadow);

  // Figure holds everything above the ground so the idle bob moves the whole body
  const figure = new THREE.Group(); figure.name = "figure";
  g.add(figure);
  g.userData.figure = figure;

  const part = (geo, m, name, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.name = name; figure.add(mesh);
    return mesh;
  };

  // Crouched legs and boots
  for (const s of [-1, 1]) {
    part(new THREE.BoxGeometry(0.14, 0.3, 0.16), stoneDark, "leg", s * 0.12, 0.15, 0.04);
    part(new THREE.BoxGeometry(0.16, 0.08, 0.22), stoneDark, "boot", s * 0.12, 0.04, 0.08);
  }

  // Tunic, short cape behind, gold buckle on the belt
  part(new THREE.BoxGeometry(0.34, 0.3, 0.24), stone, "torso", 0, 0.45, 0);
  part(new THREE.BoxGeometry(0.42, 0.42, 0.05), stoneDark, "cape", 0, 0.5, -0.14);
  part(new THREE.BoxGeometry(0.36, 0.06, 0.26), woodDark, "belt", 0, 0.32, 0);
  part(new THREE.BoxGeometry(0.1, 0.08, 0.03), gold, "buckle", 0, 0.32, 0.14);

  // Oversized hood, brim shadowing the face, skin face inside
  part(new THREE.SphereGeometry(0.22, 10, 8), stoneDark, "hood", 0, 0.8, -0.01);
  part(new THREE.BoxGeometry(0.3, 0.06, 0.24), stoneDark, "hoodBrim", 0, 0.9, 0.06);
  part(new THREE.BoxGeometry(0.14, 0.1, 0.05), skin, "face", 0, 0.78, 0.19);

  // Cloth red scarf wrapped at the neck, with a hanging tail
  part(new THREE.BoxGeometry(0.24, 0.08, 0.22), clothRed, "scarf", 0, 0.62, 0.01);
  part(new THREE.BoxGeometry(0.08, 0.2, 0.04), clothRed, "scarfTail", 0.1, 0.52, 0.14);

  // Arms bent outward, hands low, a metal dagger in each hand
  for (const s of [-1, 1]) {
    const arm = part(new THREE.BoxGeometry(0.1, 0.28, 0.1), stoneDark, "arm", s * 0.2, 0.46, 0.04);
    arm.rotation.z = s * -0.35;
    part(new THREE.SphereGeometry(0.05, 8, 6), skin, "hand", s * 0.26, 0.3, 0.1);

    const dagger = new THREE.Group(); dagger.name = "dagger";
    dagger.position.set(s * 0.26, 0.3, 0.1);
    dagger.rotation.z = s * 0.4;
    dagger.rotation.x = -0.25;
    figure.add(dagger);

    const add = (geo, m, name, y) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.y = y; mesh.name = name; dagger.add(mesh);
    };
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6), woodDark, "grip", 0.04);
    add(new THREE.BoxGeometry(0.12, 0.04, 0.06), metalDark, "guard", 0.0);
    add(new THREE.BoxGeometry(0.06, 0.24, 0.05), metal, "blade", -0.14);
  }

  return g;
}

export function update(group, t) {
  const figure = group.userData.figure;
  if (figure) figure.position.y = Math.sin(t * 2.4) * 0.012;
}
