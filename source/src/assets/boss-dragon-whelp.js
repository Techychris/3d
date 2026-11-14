import { accents } from "../engine/rig.js";

export const meta = {
  id: "boss-dragon-whelp",
  name: "Dragon whelp",
  category: "boss",
  footprint: [2, 2],
  height: 1.8,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign(
    { color, flatShading: true, roughness: 0.8, metalness: 0 }, extra));
  const cloth = mat(0xa8423a);
  const bone = mat(0xe8dcc0);
  const woodDark = mat(0x4e3423);
  const ember = mat(0xff7a2e, { emissive: 0xff7a2e, emissiveIntensity: 1.0 });
  const danger = mat(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 0.8 });
  const shade = mat(0x000000, { transparent: true, opacity: 0.35, depthWrite: false });

  const up = new THREE.Vector3(0, 1, 0);
  const put = (parent, geo, material, name, x, y, z) => {
    const m = new THREE.Mesh(geo, material);
    m.name = name; m.position.set(x, y, z); parent.add(m); return m;
  };
  // Cylinder from point a to point b; rA is the radius at a, rB the radius at b.
  const limb = (parent, a, b, rA, rB, material, name) => {
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, len, 6), material);
    m.name = name;
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    m.quaternion.setFromUnitVectors(up, dir.normalize());
    parent.add(m); return m;
  };

  // Blob shadow, sized to the 2x2 footprint.
  const shadow = put(g, new THREE.CircleGeometry(0.95, 16), shade, "shadow", 0, 0.01, 0);
  shadow.rotation.x = -Math.PI / 2;

  // Torso and bone-coloured belly plates.
  put(g, new THREE.BoxGeometry(0.62, 0.6, 0.8), cloth, "body", 0, 0.85, -0.2);
  for (const z of [-0.55, -0.38, -0.21, -0.04]) {
    put(g, new THREE.BoxGeometry(0.4, 0.05, 0.12), bone, "bellyPlate", 0, 0.53, z);
  }
  for (const z of [-0.6, -0.4, -0.2, 0.0]) {
    put(g, new THREE.ConeGeometry(0.05, 0.14, 4), bone, "dorsalSpike", 0, 1.22, z);
  }

  // Four legs with feet.
  for (const s of [-1, 1]) {
    for (const z of [-0.02, -0.45]) {
      limb(g, [s * 0.26, 0.75, z], [s * 0.27, 0.12, z], 0.1, 0.08, cloth, "leg");
      put(g, new THREE.BoxGeometry(0.22, 0.1, 0.3), cloth, "foot", s * 0.27, 0.05, z + 0.05);
    }
  }

  // Long neck and head, facing +z.
  limb(g, [0, 1.0, 0.05], [0, 1.38, 0.3], 0.2, 0.15, cloth, "neck");
  const head = new THREE.Group(); head.name = "head";
  head.position.set(0, 1.45, 0.45); head.rotation.x = 0.25;
  g.add(head);
  put(head, new THREE.BoxGeometry(0.34, 0.3, 0.36), cloth, "skull", 0, 0, 0);
  put(head, new THREE.BoxGeometry(0.24, 0.2, 0.22), cloth, "snout", 0, 0, 0.27);
  const jaw = put(head, new THREE.BoxGeometry(0.22, 0.06, 0.24), cloth, "jaw", 0, -0.14, 0.27);
  jaw.rotation.x = 0.25;
  const mouthGlow = put(head, new THREE.SphereGeometry(0.08, 8, 6), ember, "mouthGlow", 0, -0.1, 0.4);
  for (const s of [-1, 1]) {
    put(head, new THREE.SphereGeometry(0.05, 8, 6), danger, "eye", s * 0.17, 0.06, 0.1);
    const horn = put(head, new THREE.ConeGeometry(0.035, 0.22, 5), bone, "horn", s * 0.12, 0.2, -0.06);
    horn.rotation.x = -0.45;
    horn.rotation.z = -s * 0.2;
  }

  // Tail curling out to one side, tapering, with a bone spike at the tip.
  const P = [[0, 0.95, -0.6], [0.15, 0.72, -0.8], [0.42, 0.4, -0.86], [0.6, 0.22, -0.74], [0.62, 0.16, -0.5]];
  const R = [0.11, 0.1, 0.085, 0.07, 0.05];
  for (let i = 0; i < 4; i++) {
    limb(g, P[i], P[i + 1], R[i], R[i + 1], cloth, "tail");
  }
  const td = new THREE.Vector3(P[4][0] - P[3][0], P[4][1] - P[3][1], P[4][2] - P[3][2]).normalize();
  const spike = put(g, new THREE.ConeGeometry(0.05, 0.16, 5), bone, "tailSpike",
    P[4][0] + td.x * 0.08, P[4][1] + td.y * 0.08, P[4][2] + td.z * 0.08);
  spike.quaternion.setFromUnitVectors(up, td);

  // Folded wings on the back: pivots at the shoulders, so update() can flap them.
  const wings = {};
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.name = s > 0 ? "wingR" : "wingL";
    pivot.position.set(s * 0.28, 1.05, 0);
    pivot.rotation.z = -s * 0.15;
    g.add(pivot);
    put(pivot, new THREE.BoxGeometry(0.04, 0.5, 0.8), woodDark, "membrane", s * 0.06, -0.2, -0.38);
    limb(pivot, [0, 0.02, 0.02], [s * 0.06, 0.02, -0.78], 0.035, 0.03, bone, "wingArm");
    wings[s > 0 ? "wingR" : "wingL"] = pivot;
  }

  g.userData.parts = { mouthGlow, wingR: wings.wingR, wingL: wings.wingL };
  return g;
}

// pose: the mouth blazes and the wings lift through a windup, then snap down on the strike
export function update(group, t, pose) {
  const p = group.userData.parts;
  if (!p) return;
  const { wind, hit, move } = accents(pose);
  p.mouthGlow.material.emissiveIntensity = 1.0 + 0.35 * Math.sin(t * 5.0) + 2.5 * wind;
  p.mouthGlow.scale.setScalar(1 + 0.8 * wind);
  const flap = (0.06 + 0.2 * move) * Math.sin(t * (2.0 + 6 * move)) + 0.5 * wind - 0.35 * hit;
  p.wingR.rotation.z = -0.15 + flap;
  p.wingL.rotation.z = 0.15 - flap;
}
