export const meta = {
  id: "prop-gravestones",
  name: "Gravestones",
  category: "prop",
  footprint: [1, 1],
  height: 0.8,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const stone = new THREE.MeshStandardMaterial({ color: 0x5a5862, flatShading: true, roughness: 0.8, metalness: 0 });
  const stoneLight = new THREE.MeshStandardMaterial({ color: 0x8a8794, flatShading: true, roughness: 0.8, metalness: 0 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4e3423, flatShading: true, roughness: 0.8, metalness: 0 });
  const green = new THREE.MeshStandardMaterial({ color: 0x4f7a3f, flatShading: true, roughness: 0.8, metalness: 0 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, flatShading: true, roughness: 0.8, metalness: 0 });

  const add = (geo, mat, name, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.name = name; g.add(m); return m;
  };

  // Rounded-top gravestone, back left
  add(new THREE.BoxGeometry(0.2, 0.26, 0.07), stone, "gravestone", -0.22, 0.13, -0.12);
  const arch = add(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 8), stone, "gravestoneTop", -0.22, 0.26, -0.12);
  arch.rotation.x = Math.PI / 2;

  // Cross gravestone, back centre
  add(new THREE.BoxGeometry(0.08, 0.8, 0.07), stoneLight, "crossUpright", 0.0, 0.4, -0.2);
  add(new THREE.BoxGeometry(0.24, 0.07, 0.07), stoneLight, "crossArm", 0.0, 0.6, -0.2);

  // Slab gravestone, back right, tilted
  const slab = add(new THREE.BoxGeometry(0.18, 0.22, 0.06), stone, "slab", 0.24, 0.14, -0.08);
  slab.rotation.z = 0.2;

  // Low grave mounds in front
  // Upper hemispheres, so the flat base sits on the ground
  const domeTheta = [0, Math.PI / 2];
  const mound1 = add(new THREE.SphereGeometry(0.15, 8, 5, 0, Math.PI * 2, ...domeTheta), woodDark, "mound", -0.2, 0.0, 0.2);
  mound1.scale.set(1, 0.45, 1);
  const mound2 = add(new THREE.SphereGeometry(0.11, 8, 5, 0, Math.PI * 2, ...domeTheta), woodDark, "mound", 0.18, 0.0, 0.26);
  mound2.scale.set(1, 0.45, 1);

  // Weed tuft by the slab
  const tuft = [[0.38, 0.1, 0.0], [0.41, 0.12, 0.2], [0.36, 0.13, -0.15]];
  tuft.forEach(([x, z, tilt], i) => {
    const c = add(new THREE.ConeGeometry(0.025, 0.12, 5), green, "weed" + i, x, 0.07, z);
    c.rotation.z = tilt;
  });

  // Half-buried skull with jaw, front centre
  add(new THREE.SphereGeometry(0.06, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), bone, "skull", 0.0, 0.0, 0.3);
  const jaw = add(new THREE.BoxGeometry(0.07, 0.025, 0.05), bone, "jaw", 0.0, 0.03, 0.345);
  jaw.rotation.x = -0.3;

  return g;
}

export function update(group, t) {}
