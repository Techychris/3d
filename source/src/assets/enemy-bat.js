import { accents } from "../engine/rig.js";

export const meta = {
  id: "enemy-bat",
  name: "Cave bat",
  category: "enemy",
  footprint: [0.9, 0.6],
  height: 1.2,
  flying: true
};

const BODY_Y = 0.9;

function applyPose(p, t, pose) {
  const { wind, hit } = accents(pose);
  const flap = Math.sin(t * 14) * 0.7 * (1 - 0.8 * wind) + 0.9 * wind - 0.5 * hit; // wings lift and hold before the dive
  p.wingL.rotation.z = flap;
  p.wingR.rotation.z = -flap;
  const bob = Math.sin(t * 3) * 0.04;
  p.body.position.y = BODY_Y + bob;
  p.body.rotation.x = -0.5 * wind + 0.7 * hit;                                       // rears back, then noses down
  const h = BODY_Y + bob - 0.01;
  p.drop.scale.y = h;
  p.drop.position.y = 0.01 + h / 2;
}

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x3b3a40, flatShading: true, roughness: 0.8, metalness: 0 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x5a5862, flatShading: true, roughness: 0.8, metalness: 0 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 1.0, flatShading: true, roughness: 0.8, metalness: 0 });
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, flatShading: true, roughness: 0.8, metalness: 0 });

  // Blob shadow on the ground (stays put while the bat bobs).
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow";
  g.add(shadow);

  // Drop line from shadow up to the body; scaled and moved each frame in update().
  const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), shadowMat);
  drop.name = "dropLine";
  g.add(drop);

  const body = new THREE.Group(); body.name = "body"; body.position.y = BODY_Y;
  g.add(body);

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), stoneDark);
  core.name = "core"; body.add(core);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), stoneDark);
    ear.position.set(s * 0.06, 0.13, 0); ear.rotation.z = -s * 0.2; ear.name = "ear";
    body.add(ear);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), eyeMat);
    eye.position.set(s * 0.05, 0.02, 0.11); eye.name = "eye";
    body.add(eye);
  }

  // Wings: each pivots at the shoulder so update() can flap them.
  const wings = {};
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.name = s < 0 ? "wingL" : "wingR";
    pivot.position.set(s * 0.08, 0.02, 0);
    body.add(pivot);

    const membrane = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.2), stone);
    membrane.position.set(s * 0.19, 0, 0); membrane.name = "membrane";
    pivot.add(membrane);

    const bone = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.04), stoneDark);
    bone.position.set(s * 0.18, 0.03, 0.1); bone.name = "bone";
    pivot.add(bone);

    wings[s < 0 ? "wingL" : "wingR"] = pivot;
  }

  g.userData.parts = { body, wingL: wings.wingL, wingR: wings.wingR, drop };
  applyPose(g.userData.parts, 0);
  return g;
}

export function update(group, t, pose) {
  const p = group.userData.parts;
  if (!p) return;
  applyPose(p, t, pose);
}
