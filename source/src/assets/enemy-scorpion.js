import { accents } from "../engine/rig.js";

export const meta = {
  id: "enemy-scorpion",
  name: "Giant scorpion",
  category: "enemy",
  footprint: [1, 1],
  height: 0.6,
  flying: false
};

// Mesh spanning from point a to point b. The geometry's Y axis runs a -> b.
function along(THREE, a, b, geomFor, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(geomFor(len), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const wood = mat(0x7a5236);
  const dark = mat(0x4e3423);
  const danger = mat(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 0.6 });
  const tipMat = mat(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 1.0 });

  // Blob shadow
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x000000, flatShading: true, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.35, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  // Abdomen (flattened sphere)
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), wood);
  abdomen.scale.set(1, 0.55, 1.2);
  abdomen.position.set(0, 0.16, -0.15); abdomen.name = "abdomen"; g.add(abdomen);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.2), wood);
  head.position.set(0, 0.14, 0.1); head.name = "head"; g.add(head);

  // Eyes
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), danger);
    eye.position.set(s * 0.07, 0.22, 0.18); eye.name = "eye"; g.add(eye);
  }

  // Pincers: arm plus two claw prongs each
  for (const s of [-1, 1]) {
    const arm = along(THREE, new THREE.Vector3(s * 0.1, 0.14, 0.16), new THREE.Vector3(s * 0.22, 0.12, 0.34),
      (len) => new THREE.CylinderGeometry(0.03, 0.03, len, 6), dark);
    arm.name = "pincerArm"; g.add(arm);
    const outer = along(THREE, new THREE.Vector3(s * 0.22, 0.12, 0.34), new THREE.Vector3(s * 0.3, 0.12, 0.48),
      (len) => new THREE.ConeGeometry(0.045, len, 6), wood);
    outer.name = "claw"; g.add(outer);
    const inner = along(THREE, new THREE.Vector3(s * 0.22, 0.12, 0.34), new THREE.Vector3(s * 0.16, 0.12, 0.46),
      (len) => new THREE.ConeGeometry(0.035, len, 6), wood);
    inner.name = "claw"; g.add(inner);
  }

  // Six legs: hip -> knee -> foot, three per side
  const legs = [[-0.2, -0.28], [-0.12, -0.14], [-0.04, 0.0]];
  for (const [hipZ, footZ] of legs) {
    for (const s of [-1, 1]) {
      const hip = new THREE.Vector3(s * 0.12, 0.14, hipZ);
      const knee = new THREE.Vector3(s * 0.3, 0.22, (hipZ + footZ) / 2);
      const foot = new THREE.Vector3(s * 0.42, 0.025, footZ);
      const cyl = (len) => new THREE.CylinderGeometry(0.025, 0.025, len, 6);
      const upper = along(THREE, hip, knee, cyl, dark);
      const lower = along(THREE, knee, foot, cyl, dark);
      upper.name = "leg"; lower.name = "leg";
      g.add(upper); g.add(lower);
    }
  }

  // Segmented tail on a pivot at the back of the abdomen; sways in update()
  const tail = new THREE.Group();
  tail.name = "tail";
  tail.position.set(0, 0.14, -0.3);
  const T0 = new THREE.Vector3(0, 0, 0);
  const T1 = new THREE.Vector3(0, 0.12, -0.12);
  const T2 = new THREE.Vector3(0, 0.28, -0.12);
  const T3 = new THREE.Vector3(0, 0.36, -0.02);
  const tip = new THREE.Vector3(0, 0.3, 0.1);
  tail.add(along(THREE, T0, T1, (len) => new THREE.CylinderGeometry(0.06, 0.055, len, 8), wood));
  tail.add(along(THREE, T1, T2, (len) => new THREE.CylinderGeometry(0.055, 0.05, len, 8), wood));
  tail.add(along(THREE, T2, T3, (len) => new THREE.CylinderGeometry(0.05, 0.045, len, 8), wood));
  for (const [p, m, r] of [[T0, wood, 0.07], [T1, dark, 0.058], [T2, wood, 0.054], [T3, dark, 0.05]]) {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
    joint.position.copy(p); joint.name = "tailSeg"; tail.add(joint);
  }
  const stinger = along(THREE, T3, tip, (len) => new THREE.ConeGeometry(0.035, len, 6), dark);
  stinger.name = "stinger"; tail.add(stinger);
  const tipGlow = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), tipMat);
  tipGlow.position.copy(tip); tipGlow.name = "stingerTip"; tail.add(tipGlow);
  g.add(tail);

  g.userData.parts = { tail, tipMat };
  return g;
}

// pose: the tail cocks back and the sting glows through the windup, then whips forward
export function update(group, t, pose) {
  const p = group.userData.parts;
  if (!p) return;
  const { wind, hit } = accents(pose);
  p.tail.rotation.z = Math.sin(t * 2.0) * 0.12 * (1 - wind);
  p.tail.rotation.x = -0.45 * wind + 0.8 * hit;
  p.tipMat.emissiveIntensity = 1.0 + 0.4 * Math.sin(t * 4.0) + 2 * wind;
}
