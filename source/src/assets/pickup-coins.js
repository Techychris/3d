export const meta = {
  id: "pickup-coins",
  name: "Coin pile",
  category: "pickup",
  footprint: [0.5, 0.5],
  height: 0.25,
  flying: false
};

// Fixed layout: [x, y, z, rotX, rotZ] for each coin (cylinder radius 0.09, thickness 0.03).
const COINS = [
  // flat on the ground
  [-0.12, 0.015, -0.06, 0, 0],
  [0.06, 0.015, -0.12, 0, 0],
  [0.14, 0.015, 0.04, 0, 0],
  [-0.04, 0.015, 0.12, 0, 0],
  [0.02, 0.015, 0.1, 0, 0],
  // three-high stack at the centre
  [0.0, 0.045, 0.0, 0, 0],
  [0.0, 0.075, 0.0, 0, 0],
  [0.0, 0.105, 0.0, 0, 0],
  // tilted coins leaning on the pile
  [-0.07, 0.07, -0.01, 0, 0.6],
  [0.1, 0.07, -0.05, 0.4, 0]
];

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.25, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.name = "shadow"; g.add(shadow);

  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b04a, flatShading: true, roughness: 0.8, metalness: 0.3 });
  const coinGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12);
  for (let i = 0; i < COINS.length; i++) {
    const [x, y, z, rx, rz] = COINS[i];
    const coin = new THREE.Mesh(coinGeo, gold);
    coin.position.set(x, y, z);
    coin.rotation.x = rx; coin.rotation.z = rz;
    coin.name = "coin" + i; g.add(coin);
  }

  const gemMat = new THREE.MeshStandardMaterial({
    color: 0x8c5be0, emissive: 0x8c5be0, emissiveIntensity: 1.0,
    flatShading: true, roughness: 0.8, metalness: 0
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), gemMat);
  gem.position.set(0, 0.16, 0); gem.scale.set(1, 1.3, 1);
  gem.name = "gem"; g.add(gem);
  g.userData.gemMat = gemMat;

  return g;
}

export function update(group, t) {
  const mat = group.userData.gemMat;
  if (mat) mat.emissiveIntensity = 1.0 + 0.4 * Math.sin(t * 4);
}
