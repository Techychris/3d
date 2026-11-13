import { accents } from "../engine/rig.js";

export const meta = {
  id: "enemy-wisp",
  name: "Wisp",
  category: "enemy",
  footprint: [0.5, 0.5],
  height: 1.1,
  flying: true
};

const BODY_Y = 0.85;   // resting centre height of the wisp body
const BOB_AMP = 0.05;  // how far the body rises and falls
const ORBIT_R = 0.17;  // spark orbit radius (footprint half-width is 0.25)
const SPARKS = 3;

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const magic = new THREE.MeshStandardMaterial({ color: 0x8c5be0, emissive: 0x8c5be0, emissiveIntensity: 1.0, flatShading: true, roughness: 0.8, metalness: 0 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x8c5be0, emissive: 0x8c5be0, emissiveIntensity: 0.6, flatShading: true, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.4 });
  const sparkMat = new THREE.MeshStandardMaterial({ color: 0x8c5be0, emissive: 0x8c5be0, emissiveIntensity: 1.2, flatShading: true, roughness: 0.8, metalness: 0 });
  const black = new THREE.MeshStandardMaterial({ color: 0x000000, flatShading: true, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.35, depthWrite: false });

  // blob shadow on the ground (does not bob)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), black);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  // drop line from shadow up to the body; unit-height cylinder, stretched in update
  const dropLine = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), black);
  dropLine.position.y = (BODY_Y + 0.01) / 2;
  dropLine.scale.y = BODY_Y - 0.01;            // rest pose; update() keeps it in step
  dropLine.name = "dropLine"; g.add(dropLine);

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), magic);
  core.position.y = BODY_Y; core.name = "core"; g.add(core);

  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 1), shellMat);
  shell.position.y = BODY_Y; shell.name = "shell"; g.add(shell);

  const sparks = [];
  for (let k = 0; k < SPARKS; k++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), sparkMat);
    s.position.set(ORBIT_R, BODY_Y, 0); s.name = "spark" + k; g.add(s); sparks.push(s);
  }

  g.userData.core = core;
  g.userData.shell = shell;
  g.userData.sparks = sparks;
  g.userData.dropLine = dropLine;
  return g;
}

// pose: sparks pull in and the core flares while it charges, then burst outward as it fires
export function update(group, t, pose) {
  const r = group.userData;
  const { wind, hit } = accents(pose), orbit = ORBIT_R * (1 - 0.6 * wind + 0.9 * hit);
  const y = BODY_Y + Math.sin(t * 2.2) * BOB_AMP;

  r.core.position.y = y;
  r.core.material.emissiveIntensity = 0.9 + 0.4 * Math.sin(t * 3.0) + 1.6 * wind;   // pulse
  r.core.scale.setScalar(1 + 0.45 * wind - 0.2 * hit);

  r.shell.position.y = y;
  r.shell.rotation.y = t * 0.5;

  for (let k = 0; k < SPARKS; k++) {
    const a = t * 1.6 + (k * Math.PI * 2) / SPARKS;
    const s = r.sparks[k];
    s.position.x = Math.cos(a) * orbit;
    s.position.z = Math.sin(a) * orbit;
    s.position.y = y + Math.sin(t * 2.0 + k) * 0.04;
  }

  // stretch the drop line so it always runs from the ground shadow to the body
  r.dropLine.position.y = (y + 0.01) / 2;
  r.dropLine.scale.y = y - 0.01;
}
