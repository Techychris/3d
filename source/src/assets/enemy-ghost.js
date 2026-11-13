import { accents } from "../engine/rig.js";

export const meta = {
  id: "enemy-ghost",
  name: "Ghost",
  category: "enemy",
  footprint: [0.7, 0.7],
  height: 1.2,
  flying: true
};

const GROUND_Y = 0.01;      // shadow sits just above the floor
const BODY_BOTTOM = 0.41;   // rest height of the lowest point of the wavy hem
const BOB_AMP = 0.04;       // float bob amplitude (tiles)
const BOB_SPEED = 2.1;      // rad/s, about one bob every 3 s
const SWAY_AMP = 0.06;      // sway angle (rad)
const SWAY_SPEED = 1.3;     // rad/s

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const bone = new THREE.MeshStandardMaterial({
    color: 0xe8dcc0, flatShading: true, roughness: 0.8, metalness: 0,
    transparent: true, opacity: 0.6, depthWrite: false
  });
  const eye = new THREE.MeshStandardMaterial({
    color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 0.9,
    flatShading: true, roughness: 0.8, metalness: 0
  });
  const black = new THREE.MeshStandardMaterial({
    color: 0x000000, flatShading: true, roughness: 0.8, metalness: 0,
    transparent: true, opacity: 0.35, depthWrite: false
  });

  // Blob shadow on the ground. It never moves.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), black);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = GROUND_Y;
  shadow.name = "shadow"; g.add(shadow);

  // Drop line from the shadow up to the hem. update() keeps it attached.
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), black);
  drop.name = "dropLine"; g.add(drop);

  // Body group: pivots about the hem and carries everything that floats.
  const body = new THREE.Group(); body.name = "body";

  // Sheet: rounded head, tapering sides, three-scallop hem. Extruded thin.
  const s = new THREE.Shape();
  s.moveTo(-0.24, 0.95);
  s.absarc(0, 0.95, 0.24, Math.PI, 0, true);   // over the head, left to right
  s.lineTo(0.2, 0.6);                          // right side tapers in
  s.quadraticCurveTo(0.1335, 0.22, 0.067, 0.6); // hem, right to left
  s.quadraticCurveTo(0.0, 0.22, -0.067, 0.6);
  s.quadraticCurveTo(-0.1335, 0.22, -0.2, 0.6);
  s.closePath();                               // left side back to the head
  const sheetGeo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false, curveSegments: 8 });
  sheetGeo.translate(0, 0, -0.03);
  const sheet = new THREE.Mesh(sheetGeo, bone); sheet.name = "sheet"; body.add(sheet);

  // Two arm stubs, angled out and down.
  const armGeo = new THREE.CapsuleGeometry(0.045, 0.1, 3, 6);
  const armL = new THREE.Mesh(armGeo, bone);
  armL.position.set(-0.26, 0.8, 0); armL.rotation.z = 0.6;
  armL.name = "armL"; body.add(armL);
  const armR = new THREE.Mesh(armGeo, bone);
  armR.position.set(0.26, 0.8, 0); armR.rotation.z = -0.6;
  armR.name = "armR"; body.add(armR);

  // Danger-red eyes on the front face.
  const eyeGeo = new THREE.SphereGeometry(0.045, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eye);
  eyeL.position.set(-0.09, 0.93, 0.04); eyeL.name = "eyeL"; body.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eye);
  eyeR.position.set(0.09, 0.93, 0.04); eyeR.name = "eyeR"; body.add(eyeR);

  g.add(body);
  g.userData.body = body;
  g.userData.drop = drop;

  // Drop line at rest: from the ground to the hem.
  drop.position.y = (GROUND_Y + BODY_BOTTOM) / 2;
  drop.scale.y = BODY_BOTTOM - GROUND_Y;

  return g;
}

// pose: it stretches tall as it gathers itself to vanish
export function update(group, t, pose) {
  const { wind, hit } = accents(pose);
  const bob = BOB_AMP * Math.sin(t * BOB_SPEED);
  const sway = SWAY_AMP * Math.sin(t * SWAY_SPEED);
  const body = group.userData.body;
  const drop = group.userData.drop;

  // Rotate about the hem point so the drop line stays attached to it.
  const c = Math.cos(sway), sn = Math.sin(sway);
  body.rotation.z = sway;
  body.scale.set(1 - 0.2 * wind + 0.15 * hit, 1 + 0.3 * wind - 0.15 * hit, 1 - 0.2 * wind + 0.15 * hit);
  body.position.set(BODY_BOTTOM * sn, bob + BODY_BOTTOM * (1 - c), 0);

  // Stretch the drop line from the ground to the bobbing hem.
  const bottom = BODY_BOTTOM + bob;
  drop.position.y = (GROUND_Y + bottom) / 2;
  drop.scale.y = bottom - GROUND_Y;
}
