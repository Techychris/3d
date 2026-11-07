export const meta = {
  id: "prop-brazier",
  name: "Standing brazier",
  category: "prop",
  footprint: [0.6, 0.6],
  height: 1.0,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const legMat = new THREE.MeshStandardMaterial({ color: 0x5b636d, flatShading: true, roughness: 0.8, metalness: 0.3 });
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, flatShading: true, roughness: 0.8, metalness: 0.3 });
  const emberMat = new THREE.MeshStandardMaterial({ color: 0xff7a2e, emissive: 0xff7a2e, emissiveIntensity: 1.0, flatShading: true, roughness: 0.8, metalness: 0 });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xff7a2e, emissive: 0xff7a2e, emissiveIntensity: 1.2, flatShading: true, roughness: 0.8, metalness: 0, transparent: true, opacity: 0.75 });

  // Three splayed legs: each runs from a foot at radius 0.24 up to radius 0.18 at y 0.58.
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;
    const dx = Math.cos(a), dz = Math.sin(a);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.585, 8), legMat);
    const dir = new THREE.Vector3(-0.06 * dx, 0.58, -0.06 * dz).normalize();
    leg.quaternion.setFromUnitVectors(up, dir);
    leg.position.set(0.21 * dx, 0.29, 0.21 * dz);
    leg.name = "leg" + i; g.add(leg);
  }

  // Bowl: closed lathe profile (outer wall up, inner wall back down) so it reads solid from above.
  const bowlPts = [
    new THREE.Vector2(0.07, 0.55), new THREE.Vector2(0.18, 0.6),
    new THREE.Vector2(0.26, 0.66), new THREE.Vector2(0.28, 0.72),
    new THREE.Vector2(0.24, 0.72), new THREE.Vector2(0.22, 0.66),
    new THREE.Vector2(0.15, 0.61), new THREE.Vector2(0.0, 0.6)
  ];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 12), bowlMat);
  bowl.name = "bowl"; g.add(bowl);

  // Glowing coals resting in the bowl.
  const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.08, 10), emberMat);
  coals.position.y = 0.66; coals.name = "coals"; g.add(coals);

  // Flame: group at the coal line holding three stacked emissive cones. Scaled and tilted in update().
  const flame = new THREE.Group(); flame.name = "flame";
  flame.position.y = 0.7;
  const cones = [
    { r: 0.14, h: 0.18, y: 0.09 },
    { r: 0.1, h: 0.16, y: 0.17 },
    { r: 0.05, h: 0.12, y: 0.24 }
  ];
  cones.forEach((c, i) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(c.r, c.h, 8), flameMat);
    cone.position.y = c.y; cone.name = "ember" + i; flame.add(cone);
  });
  g.add(flame);
  g.userData.flame = flame;

  return g;
}

export function update(group, t) {
  const flame = group.userData.flame;
  if (!flame) return;
  flame.scale.y = 1 + 0.08 * Math.sin(t * 9) + 0.04 * Math.sin(t * 13.7);
  flame.rotation.z = 0.05 * Math.sin(t * 7.3);
}
