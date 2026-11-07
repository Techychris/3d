export const meta = {
  id: "vfx-fireball",
  name: "Fireball",
  category: "vfx",
  footprint: [0.5, 0.5],
  height: 1.0,
  flying: true
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const core = new THREE.MeshStandardMaterial({ color: 0xff7a2e, emissive: 0xff7a2e, emissiveIntensity: 1.2, flatShading: true, roughness: 0.8, metalness: 0 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0xff7a2e, emissive: 0xff7a2e, emissiveIntensity: 0.8, flatShading: true, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.4, depthWrite: false });
  const trailMat = new THREE.MeshStandardMaterial({ color: 0xff7a2e, emissive: 0xff7a2e, emissiveIntensity: 0.6, flatShading: true, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.4, depthWrite: false });
  const trailInner = new THREE.MeshStandardMaterial({ color: 0xff7a2e, emissive: 0xff7a2e, emissiveIntensity: 1.0, flatShading: true, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.7, depthWrite: false });
  const black = new THREE.MeshStandardMaterial({ color: 0x000000, flatShading: true, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.35, depthWrite: false });

  const CY = 0.7;   // body height above the floor
  const CZ = 0.05;  // body sits slightly toward the front of the footprint

  const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), core);
  coreMesh.position.set(0, CY, CZ); coreMesh.name = "core"; g.add(coreMesh);

  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), shellMat);
  shell.position.set(0, CY, CZ); shell.name = "shell"; g.add(shell);

  // Trail: cones whose bases sit behind the core; ConeGeometry tips up +y, so rotation.x = -PI/2 points the tip toward -z.
  const baseZ = CZ - 0.02;
  const trailLong = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 8), trailMat);
  trailLong.rotation.x = -Math.PI / 2;
  trailLong.position.set(0, CY, baseZ - 0.13); trailLong.name = "trail"; g.add(trailLong);

  const trailShort = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), trailInner);
  trailShort.rotation.x = -Math.PI / 2;
  trailShort.position.set(0, CY, baseZ - 0.09); trailShort.name = "trail"; g.add(trailShort);

  // Blob shadow on the floor, directly under the body.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), black);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.01, CZ); shadow.name = "shadow"; g.add(shadow);

  // Drop line from the shadow up to the underside of the core.
  const dropLen = CY - 0.09 - 0.01;
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, dropLen, 6), black);
  drop.position.set(0, 0.01 + dropLen / 2, CZ); drop.name = "dropLine"; g.add(drop);

  g.userData.core = coreMesh;
  g.userData.shell = shell;
  return g;
}

export function update(group, t) {
  const core = group.userData.core;
  const shell = group.userData.shell;
  if (!core || !shell) return;
  core.scale.setScalar(1 + 0.12 * Math.sin(t * 9));
  shell.rotation.y = t * 2.2;
  shell.rotation.x = t * 1.4;
}
