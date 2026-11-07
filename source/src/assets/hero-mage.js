export const meta = {
  id: "hero-mage",
  name: "Hero mage",
  category: "hero",
  footprint: [0.8, 0.8],
  height: 1.1,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const robeMat = new THREE.MeshStandardMaterial({ color: 0x3e5c9a, flatShading: true, roughness: 0.8, metalness: 0 });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0x3b3a40, flatShading: true, roughness: 0.8, metalness: 0 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe0b04a, flatShading: true, roughness: 0.8, metalness: 0 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a27e, flatShading: true, roughness: 0.8, metalness: 0 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5236, flatShading: true, roughness: 0.8, metalness: 0 });
  const orbMat = new THREE.MeshStandardMaterial({ color: 0x8c5be0, emissive: 0x8c5be0, emissiveIntensity: 1.0, flatShading: true, roughness: 0.8, metalness: 0 });
  const shadowMat = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, flatShading: true, roughness: 0.8, metalness: 0 });

  // Blob shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.36, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  // Robe: bell-shaped lathe, bottom flares out
  const robeProfile = [
    new THREE.Vector2(0.30, 0.0),
    new THREE.Vector2(0.28, 0.3),
    new THREE.Vector2(0.20, 0.5),
    new THREE.Vector2(0.14, 0.62)
  ];
  const robe = new THREE.Mesh(new THREE.LatheGeometry(robeProfile, 8), robeMat);
  robe.name = "body"; g.add(robe);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), skinMat);
  head.position.y = 0.74; head.name = "head"; g.add(head);

  // Oversized hat: brim, gold band, tall cone
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 8), hatMat);
  brim.position.y = 0.84; brim.name = "hat"; g.add(brim);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.18, 0.24, 8), hatMat);
  cone.position.y = 0.975; cone.name = "hat"; g.add(cone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.035, 8), goldMat);
  band.position.y = 0.87; band.name = "hatBand"; g.add(band);

  // Hand on the staff
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), skinMat);
  hand.position.set(0.22, 0.45, 0.05); hand.name = "hand"; g.add(hand);

  // Staff: chunky wooden shaft with a glowing magic-violet orb
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), woodMat);
  staff.position.set(0.26, 0.5, 0.05); staff.name = "staff"; g.add(staff);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), orbMat);
  orb.position.set(0.26, 1.04, 0.05); orb.name = "orb"; g.add(orb);

  g.userData.orb = orb;
  g.userData.orbMat = orbMat;
  return g;
}

export function update(group, t) {
  const orb = group.userData.orb;
  const mat = group.userData.orbMat;
  if (!orb || !mat) return;
  const p = 0.5 + 0.5 * Math.sin(t * 2.5);   // 0..1, gentle pulse
  orb.scale.setScalar(1 + 0.08 * p);
  mat.emissiveIntensity = 0.8 + 0.4 * p;
}
