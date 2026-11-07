export const meta = {
  id: "enemy-skeleton",
  name: "Skeleton grunt",
  category: "enemy",
  footprint: [0.7, 0.7],
  height: 0.95,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const bone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, flatShading: true, roughness: 0.8, metalness: 0 });
  const rust = new THREE.MeshStandardMaterial({ color: 0x5b636d, flatShading: true, roughness: 0.8, metalness: 0.3 });
  const eye = new THREE.MeshStandardMaterial({ color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 1.2, flatShading: true, roughness: 0.8, metalness: 0 });
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, flatShading: true, roughness: 0.8, metalness: 0 });

  const add = (geo, mat, name, x, y, z) => {
    const m = new THREE.Mesh(geo, mat); m.name = name; m.position.set(x, y, z); g.add(m); return m;
  };

  // blob shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  // legs and feet
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), bone, "leg", s * 0.09, 0.2, 0);
    add(new THREE.BoxGeometry(0.13, 0.06, 0.2), bone, "foot", s * 0.09, 0.03, 0.04);
  }

  // pelvis and spine
  add(new THREE.BoxGeometry(0.28, 0.1, 0.16), bone, "pelvis", 0, 0.45, 0);
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 6), bone, "spine", 0, 0.6, -0.06);

  // ribcage: four full rings stacked up the torso
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 4, 10), bone);
    rib.rotation.x = Math.PI / 2; rib.position.set(0, 0.5 + i * 0.075, 0); rib.name = "rib"; g.add(rib);
  }

  // arms: left empty, right hand holds the sword
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.06, 8, 6), bone, "shoulder", s * 0.2, 0.72, 0);
    add(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 6), bone, "arm", s * 0.2, 0.57, 0);
  }
  add(new THREE.SphereGeometry(0.05, 8, 6), bone, "handL", -0.2, 0.4, 0.02);
  add(new THREE.SphereGeometry(0.05, 8, 6), bone, "handR", 0.2, 0.42, 0.06);

  // rusty sword, held upright at the right side
  add(new THREE.BoxGeometry(0.14, 0.04, 0.05), rust, "crossguard", 0.2, 0.48, 0.06);
  add(new THREE.BoxGeometry(0.07, 0.42, 0.04), rust, "blade", 0.2, 0.7, 0.06);

  // neck, big skull, jaw and glowing eyes
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6), bone, "neck", 0, 0.71, 0);
  const head = add(new THREE.SphereGeometry(0.14, 10, 8), bone, "skull", 0, 0.81, 0);
  add(new THREE.BoxGeometry(0.16, 0.05, 0.12), bone, "jaw", 0, 0.685, 0.05);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(0.035, 8, 6), eye, "eye", s * 0.055, 0.83, 0.125);
  }

  g.userData.head = head;
  return g;
}

export function update(group, t) {
  // slow side-to-side sway from the feet up
  group.rotation.z = Math.sin(t * 2.2) * 0.03;
}
