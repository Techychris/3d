export const meta = {
  id: "hero-ranger",
  name: "Ranger",
  category: "hero",
  footprint: [0.8, 0.8],
  height: 1.0,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign(
    { color, flatShading: true, roughness: 0.8, metalness: 0 }, extra || {}));
  const cloakMat = mat(0x4f7a3f);
  const skinMat = mat(0xd9a27e);
  const woodMat = mat(0x7a5236);
  const woodDarkMat = mat(0x4e3423);
  const stoneDarkMat = mat(0x3b3a40);
  const boneMat = mat(0xe8dcc0);
  const metalMat = mat(0x9aa3ad, { metalness: 0.3 });

  // Blob shadow (stays on the ground, does not bob)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, flatShading: true, roughness: 0.8, metalness: 0 })
  );
  shadow.name = "shadow"; shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
  g.add(shadow);

  // Figure group: everything above the ground, so update() can bob it
  const figure = new THREE.Group(); figure.name = "figure";
  g.add(figure);
  g.userData.figure = figure;

  const part = (name, geo, material, x, y, z) => {
    const m = new THREE.Mesh(geo, material);
    m.name = name; m.position.set(x, y, z); figure.add(m); return m;
  };

  // Cloak: tapered cylinder, wide at the hem
  part("cloak", new THREE.CylinderGeometry(0.16, 0.28, 0.6, 8), cloakMat, 0, 0.3, 0);

  // Oversized hooded head with skin-coloured face opening at the front (+z)
  part("hood", new THREE.SphereGeometry(0.2, 8, 6), cloakMat, 0, 0.8, 0);
  part("face", new THREE.SphereGeometry(0.11, 8, 6), skinMat, 0, 0.78, 0.12);
  part("eyeL", new THREE.SphereGeometry(0.02, 6, 4), stoneDarkMat, -0.04, 0.8, 0.22);
  part("eyeR", new THREE.SphereGeometry(0.02, 6, 4), stoneDarkMat, 0.04, 0.8, 0.22);

  // Large bow in the left hand (+x side). The arc bulges toward +z, away from the body.
  part("bow", new THREE.TorusGeometry(0.34, 0.04, 4, 10, Math.PI), woodMat, 0.3, 0.55, 0)
    .rotation.set(0, Math.PI / 2, Math.PI / 2);
  // Bowstring: chord of the arc, behind the grip
  part("string", new THREE.CylinderGeometry(0.02, 0.02, 0.68, 3), boneMat, 0.3, 0.55, 0);

  // Sleeve from shoulder to the bow grip, plus the hand on the grip
  const shoulder = new THREE.Vector3(0.16, 0.66, 0);
  const grip = new THREE.Vector3(0.3, 0.55, 0.32);
  const armDir = grip.clone().sub(shoulder);
  const armLen = armDir.length();
  const arm = part("arm", new THREE.CylinderGeometry(0.05, 0.05, armLen, 6), cloakMat,
    (shoulder.x + grip.x) / 2, (shoulder.y + grip.y) / 2, (shoulder.z + grip.z) / 2);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), armDir.normalize());
  part("hand", new THREE.SphereGeometry(0.06, 6, 4), skinMat, grip.x, grip.y, grip.z);

  // Quiver on the back (-z) with three arrows standing up out of it
  part("quiver", new THREE.CylinderGeometry(0.07, 0.07, 0.44, 8), woodDarkMat, -0.1, 0.5, -0.27);
  const arrowX = [-0.13, -0.1, -0.07];
  for (let i = 0; i < arrowX.length; i++) {
    part("arrow" + i, new THREE.CylinderGeometry(0.02, 0.02, 0.42, 4), woodMat, arrowX[i], 0.71, -0.27);
    part("arrowTip" + i, new THREE.ConeGeometry(0.035, 0.08, 4), metalMat, arrowX[i], 0.96, -0.27);
  }

  return g;
}

export function update(group, t) {
  // Gentle idle bob: figure rises 0 to 0.02 and never dips below the ground
  const figure = group.userData.figure;
  if (figure) figure.position.y = (1 + Math.sin(t * 4)) * 0.01;
}
