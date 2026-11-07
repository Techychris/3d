export const meta = {
  id: "pickup-key",
  name: "Gold key",
  category: "pickup",
  footprint: [0.4, 0.4],
  height: 0.5,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const gold = new THREE.MeshStandardMaterial({
    color: 0xe0b04a, emissive: 0xe0b04a, emissiveIntensity: 0.6,
    flatShading: true, roughness: 0.8, metalness: 0.3
  });
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, flatShading: true, roughness: 0.8, metalness: 0,
    transparent: true, opacity: 0.35, depthWrite: false
  });

  // Key body: everything here bobs and spins together. Added first so update() can find it at children[0].
  const key = new THREE.Group(); key.name = "keyBody";

  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), gold);
  bow.position.y = 0.47; bow.name = "bow"; key.add(bow);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), gold);
  shaft.position.y = 0.25; shaft.name = "shaft"; key.add(shaft);

  for (const y of [0.13, 0.19]) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.035, 0.05), gold);
    tooth.position.set(0.04, y, 0); tooth.name = "tooth"; key.add(tooth);
  }
  g.add(key);

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
  shadow.name = "shadow"; g.add(shadow);

  return g;
}

export function update(group, t) {
  const key = group.children[0];
  key.rotation.y = t * 0.8;
  key.position.y = 0.02 * Math.sin(t * 2.2);
}
