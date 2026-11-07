export const meta = {
  id: "enemy-goblin-archer",
  name: "Goblin archer",
  category: "enemy",
  footprint: [0.7, 0.7],
  height: 0.8,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const slime = mat(0x7bc86c);
  const leather = mat(0x4e3423);
  const wood = mat(0x7a5236);
  const trousers = mat(0x3b3a40);
  const danger = mat(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 0.8 });
  const add = (geo, m, name, x, y, z, parent = g) => {
    const mesh = new THREE.Mesh(geo, m); mesh.name = name; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };

  // Blob shadow
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, flatShading: true, roughness: 0.8, metalness: 0 });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  // Legs and feet stay planted; the upper body bobs in a rig group.
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.08, 0.12, 0.1), trousers, "leg", s * 0.06, 0.1, 0);
    add(new THREE.BoxGeometry(0.09, 0.05, 0.13), leather, "foot", s * 0.07, 0.025, 0.02);
  }

  const rig = new THREE.Group(); rig.name = "rig"; g.add(rig);
  g.userData.rig = rig;

  // Torso, leather vest, arms
  add(new THREE.BoxGeometry(0.22, 0.24, 0.14), slime, "torso", 0, 0.27, 0, rig);
  add(new THREE.BoxGeometry(0.25, 0.19, 0.17), leather, "vest", 0, 0.27, 0, rig);
  add(new THREE.BoxGeometry(0.07, 0.22, 0.07), slime, "armLeft", -0.17, 0.27, 0, rig);
  add(new THREE.BoxGeometry(0.2, 0.07, 0.07), slime, "armRight", 0.24, 0.36, 0, rig);

  // Wooden bow: a short arc bulging outward from the right hand
  const bowGeo = new THREE.TorusGeometry(0.13, 0.02, 4, 12, Math.PI * 0.8);
  bowGeo.rotateZ(-Math.PI * 0.4);
  add(bowGeo, wood, "bow", 0.2, 0.35, 0, rig);

  // Big head with pointed ears, danger-red eyes
  add(new THREE.SphereGeometry(0.2, 12, 8), slime, "head", 0, 0.56, 0, rig);
  for (const s of [-1, 1]) {
    const ear = add(new THREE.ConeGeometry(0.07, 0.2, 6), slime, "ear", s * 0.26, 0.56, 0, rig);
    ear.rotation.z = -s * Math.PI / 2;
    add(new THREE.SphereGeometry(0.04, 8, 6), danger, "eye", s * 0.08, 0.57, 0.18, rig);
  }
  add(new THREE.ConeGeometry(0.03, 0.07, 6), slime, "nose", 0, 0.53, 0.2, rig).rotation.x = Math.PI / 2;

  return g;
}

export function update(group, t) {
  const rig = group.userData.rig;
  if (rig) rig.position.y = 0.015 + 0.015 * Math.sin(t * 4);
}
