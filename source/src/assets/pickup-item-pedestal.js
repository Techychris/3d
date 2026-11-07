export const meta = {
  id: "pickup-item-pedestal",
  name: "Item pedestal",
  category: "pickup",
  footprint: [0.8, 0.8],
  height: 1.2,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign(
    { color, flatShading: true, roughness: 0.8, metalness: 0 }, extra || {}));

  const stoneDark = mat(0x3b3a40);
  const stoneLight = mat(0x8a8794);
  const gold = mat(0xe0b04a, { metalness: 0.3 });
  const magic = mat(0x8c5be0, { emissive: 0x8c5be0, emissiveIntensity: 1.0 });
  const shadowMat = mat(0x000000, { transparent: true, opacity: 0.35, depthWrite: false });

  // Stepped stone-dark base
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), stoneDark);
  step1.position.y = 0.05; step1.name = "base"; g.add(step1);
  const step2 = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.56), stoneDark);
  step2.position.y = 0.15; step2.name = "step"; g.add(step2);

  // Stone-light pedestal shaft and cap
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.6, 8), stoneLight);
  shaft.position.y = 0.5; shaft.name = "shaft"; g.add(shaft);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.44), stoneLight);
  cap.position.y = 0.83; cap.name = "cap"; g.add(cap);

  // Thin magic glow disc on the pedestal top
  const glowMat = mat(0x8c5be0, { emissive: 0x8c5be0, emissiveIntensity: 0.6 });
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 12), glowMat);
  glow.position.y = 0.87; glow.name = "glow"; g.add(glow);

  // Floating relic: gold ring around a magic octahedron, animated as one group
  const relic = new THREE.Group(); relic.name = "relic";
  relic.position.y = 1.04;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), magic);
  gem.name = "gem"; relic.add(gem);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 12), gold);
  ring.rotation.x = Math.PI / 2 - 0.35; ring.name = "ring"; relic.add(ring);
  g.add(relic);
  g.userData.relic = relic;

  // Blob shadow at the base
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 12), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
  shadow.name = "shadow"; g.add(shadow);

  return g;
}

export function update(group, t) {
  const relic = group.userData.relic;
  if (!relic) return;
  relic.position.y = 1.04 + Math.sin(t * 2) * 0.025;
  relic.rotation.y = t * 1.2;
}
