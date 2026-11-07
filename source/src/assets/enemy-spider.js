export const meta = {
  id: "enemy-spider",
  name: "Giant cave spider",
  category: "enemy",
  footprint: [1.0, 1.0],
  height: 0.5,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x3b3a40, flatShading: true, roughness: 0.8, metalness: 0 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x5a5862, flatShading: true, roughness: 0.8, metalness: 0 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 1.0, flatShading: true, roughness: 0.8, metalness: 0 });
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

  // Round abdomen at the back, smaller head at the front (+z).
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), stoneDark);
  abdomen.position.set(0, 0.2, -0.13); abdomen.name = "body"; g.add(abdomen);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), stoneDark);
  head.position.set(0, 0.19, 0.1); head.name = "head"; g.add(head);

  // Cluster of danger-red eyes on the front of the head.
  const eyePos = [[-0.045, 0.24], [0.045, 0.24], [-0.02, 0.265], [0.02, 0.265]];
  for (const [x, y] of eyePos) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), eyeMat);
    eye.position.set(x, y, 0.2); eye.name = "eye"; g.add(eye);
  }

  // Eight bent legs, two segments each, splayed to fill the footprint.
  // Each leg sits in its own pivot group so update() can twitch it.
  const seg = (a, b, r) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), stone);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return m;
  };
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    const c = Math.cos(a), s = Math.sin(a);
    const P = (r, y) => new THREE.Vector3(c * r, y, s * r);
    const hip = P(0.1, 0.2), knee = P(0.3, 0.3), foot = P(0.46, 0.035);
    const leg = new THREE.Group(); leg.name = "leg";
    leg.add(seg(hip, knee, 0.035), seg(knee, foot, 0.03));
    g.add(leg);
    legs.push({ obj: leg, base: 0, phase: i * 0.8 });
  }
  g.userData.legs = legs;

  // Blob shadow.
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow";
  g.add(shadow);

  return g;
}

export function update(group, t) {
  const legs = group.userData.legs;
  if (!legs) return;
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i];
    L.obj.rotation.y = L.base + Math.sin(t * 7 + L.phase) * 0.04;
  }
}
