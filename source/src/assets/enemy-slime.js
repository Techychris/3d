import { accents } from "../engine/rig.js";

export const meta = {
  id: "enemy-slime",
  name: "Slime",
  category: "enemy",
  footprint: [0.7, 0.7],
  height: 0.5,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const slime = new THREE.MeshStandardMaterial({ color: 0x7bc86c, flatShading: true, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.75 });
  const core = new THREE.MeshStandardMaterial({ color: 0x4f7a3f, flatShading: true, roughness: 0.8, metalness: 0 });
  const eye = new THREE.MeshStandardMaterial({ color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 0.9, flatShading: true, roughness: 0.8, metalness: 0 });
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, flatShading: true, roughness: 0.8, metalness: 0 });

  // Body group: origin at bottom centre, so squash and stretch keeps the base on the ground.
  const body = new THREE.Group(); body.name = "body";

  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), slime);
  shell.scale.set(1, 0.8, 1); shell.position.y = 0.24; shell.name = "shell";
  body.add(shell);

  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6), core);
  coreMesh.position.y = 0.2; coreMesh.name = "core";
  body.add(coreMesh);

  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), eye);
    e.position.set(s * 0.09, 0.3, 0.28); e.name = "eye";
    body.add(e);
  }

  g.add(body);
  g.userData.body = body;

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow";
  g.add(shadow);

  return g;
}

// pose: crouches flat through the windup, springs tall on the strike, jiggles harder while moving
export function update(group, t, pose) {
  const body = group.userData.body;
  if (!body) return;
  // Squash and stretch: stretch tall while narrowing, then squash wide. Shadow is not touched.
  const { wind, hit, move } = accents(pose);
  const s = Math.sin(t * 5) * (1 + 0.8 * move), y = 1 + 0.12 * s - 0.15 * wind + 0.15 * hit, xz = 1 - 0.08 * s + 0.1 * wind - 0.06 * hit;
  body.scale.set(xz, y, xz);
}
