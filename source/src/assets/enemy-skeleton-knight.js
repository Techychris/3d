export const meta = {
  id: "enemy-skeleton-knight",
  name: "Skeleton knight",
  category: "enemy",
  footprint: [0.8, 0.8],
  height: 1.1,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness });

  const bone = mat(0xe8dcc0);
  const metal = mat(0x5b636d, 0.3);
  const cloth = mat(0x3e5c9a);
  const wood = mat(0x7a5236);
  const gold = mat(0xe0b04a, 0.3);
  const blade = mat(0x9aa3ad, 0.3);
  const eye = new THREE.MeshStandardMaterial({
    color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 1.0, flatShading: true, roughness: 0.8, metalness: 0
  });
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, flatShading: true, roughness: 0.8, metalness: 0
  });

  // Blob shadow, laid flat just above the ground.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  // Upper body sits in its own group so the idle sway moves it without lifting the feet or the shadow.
  const upper = new THREE.Group(); upper.name = "upper"; g.add(upper);

  const part = (parent, geo, m, name, p, r = null, s = null) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.name = name;
    mesh.position.set(p[0], p[1], p[2]);
    if (r) mesh.rotation.set(r[0], r[1], r[2]);
    if (s) mesh.scale.set(s[0], s[1], s[2]);
    parent.add(mesh);
    return mesh;
  };

  // Legs (bone) stay planted.
  part(g, new THREE.BoxGeometry(0.1, 0.38, 0.1), bone, "legL", [-0.09, 0.19, 0]);
  part(g, new THREE.BoxGeometry(0.1, 0.38, 0.1), bone, "legR", [0.09, 0.19, 0]);

  // Pelvis, breastplate, neck.
  part(upper, new THREE.BoxGeometry(0.28, 0.1, 0.18), bone, "pelvis", [0, 0.43, 0]);
  part(upper, new THREE.BoxGeometry(0.34, 0.34, 0.24), metal, "breastplate", [0, 0.66, 0]);
  part(upper, new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), bone, "neck", [0, 0.82, 0]);

  // Tattered blue tabard, front and back, with ragged hem.
  part(upper, new THREE.BoxGeometry(0.2, 0.44, 0.02), cloth, "tabard", [0, 0.5, 0.135]);
  part(upper, new THREE.BoxGeometry(0.2, 0.44, 0.02), cloth, "tabardBack", [0, 0.5, -0.135]);
  part(upper, new THREE.BoxGeometry(0.07, 0.08, 0.02), cloth, "tatterL", [-0.06, 0.24, 0.135]);
  part(upper, new THREE.BoxGeometry(0.07, 0.08, 0.02), cloth, "tatterR", [0.06, 0.21, 0.135], [0, 0, 0.15]);

  // Pauldrons.
  part(upper, new THREE.SphereGeometry(0.1, 10, 8), metal, "pauldronL", [-0.22, 0.8, 0], null, [1, 0.7, 1]);
  part(upper, new THREE.SphereGeometry(0.1, 10, 8), metal, "pauldronR", [0.22, 0.8, 0], null, [1, 0.7, 1]);

  // Shield arm (left, in front) and sword arm (right, raised).
  part(upper, new THREE.BoxGeometry(0.08, 0.26, 0.08), bone, "armShieldUpper", [-0.2, 0.62, 0.12]);
  part(upper, new THREE.BoxGeometry(0.08, 0.08, 0.14), bone, "armShieldFore", [-0.16, 0.6, 0.21]);
  part(upper, new THREE.BoxGeometry(0.08, 0.26, 0.08), bone, "armSwordUpper", [0.22, 0.66, 0]);
  part(upper, new THREE.BoxGeometry(0.08, 0.16, 0.08), bone, "armSwordFore", [0.25, 0.8, 0], [0, 0, -0.45]);

  // Sword: crossguard, hilt-to-tip blade, tilted up and out.
  part(upper, new THREE.BoxGeometry(0.12, 0.03, 0.04), gold, "hilt", [0.27, 0.83, 0], [0, 0, -0.45]);
  part(upper, new THREE.BoxGeometry(0.05, 0.26, 0.02), blade, "blade", [0.335, 0.965, 0], [0, 0, -0.45]);

  // Skull, jaw, open-faced helmet (upper hemisphere, so the bone face shows below the brim), danger-red eyes.
  part(upper, new THREE.SphereGeometry(0.09, 10, 8), bone, "skull", [0, 0.9, 0]);
  part(upper, new THREE.BoxGeometry(0.11, 0.05, 0.09), bone, "jaw", [0, 0.855, 0.02]);
  part(upper, new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), metal, "helmet", [0, 0.92, 0]);
  part(upper, new THREE.SphereGeometry(0.018, 6, 4), eye, "eyeL", [-0.035, 0.9, 0.082]);
  part(upper, new THREE.SphereGeometry(0.018, 6, 4), eye, "eyeR", [0.035, 0.9, 0.082]);

  // Tower shield: wood face, metal-dark rim, boss.
  part(upper, new THREE.BoxGeometry(0.28, 0.54, 0.04), wood, "shieldFace", [-0.1, 0.55, 0.26]);
  part(upper, new THREE.BoxGeometry(0.32, 0.04, 0.06), metal, "rimTop", [-0.1, 0.82, 0.26]);
  part(upper, new THREE.BoxGeometry(0.32, 0.04, 0.06), metal, "rimBottom", [-0.1, 0.28, 0.26]);
  part(upper, new THREE.BoxGeometry(0.04, 0.54, 0.06), metal, "rimLeft", [-0.25, 0.55, 0.26]);
  part(upper, new THREE.BoxGeometry(0.04, 0.54, 0.06), metal, "rimRight", [0.05, 0.55, 0.26]);
  part(upper, new THREE.SphereGeometry(0.05, 8, 6), metal, "shieldBoss", [-0.1, 0.55, 0.29]);

  return g;
}

// Idle: a slight side-to-side sway of the upper body. Feet and shadow stay put.
export function update(group, t) {
  const upper = group.getObjectByName("upper");
  if (upper) upper.position.x = Math.sin(t * 2) * 0.012;
}
