export const meta = {
  id: "pickup-health-potion",
  name: "Health potion",
  category: "pickup",
  footprint: [0.4, 0.4],
  height: 0.5,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  // Bobbing and spinning part of the potion; sits on a 0.08 floor offset.
  const body = new THREE.Group(); body.name = "body";
  body.position.y = 0;
  g.add(body);

  const glass = new THREE.MeshStandardMaterial({
    color: 0x9aa3ad, flatShading: true, roughness: 0.8, metalness: 0.3,
    transparent: true, opacity: 0.4
  });
  const liquid = new THREE.MeshStandardMaterial({
    color: 0x5fd38a, emissive: 0x5fd38a, emissiveIntensity: 0.8,
    flatShading: true, roughness: 0.8, metalness: 0
  });
  const metalDark = new THREE.MeshStandardMaterial({
    color: 0x5b636d, flatShading: true, roughness: 0.8, metalness: 0.3
  });
  const wood = new THREE.MeshStandardMaterial({
    color: 0x7a5236, flatShading: true, roughness: 0.8, metalness: 0
  });

  // Round-bottomed flask: glass sphere, bottom at y = 0.08.
  const flask = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), glass);
  flask.position.y = 0.20; flask.name = "flask"; body.add(flask);

  // Glass neck.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 8), glass);
  neck.position.y = 0.36; neck.name = "neck"; body.add(neck);

  // Glowing heal liquid filling the lower flask.
  const fill = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), liquid);
  fill.position.y = 0.18; fill.name = "liquid"; body.add(fill);

  // Metal collar at the lip.
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.03, 8), metalDark);
  collar.position.y = 0.415; collar.name = "collar"; body.add(collar);

  // Wood cork.
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.06, 8), wood);
  cork.position.y = 0.46; cork.name = "cork"; body.add(cork);

  // Blob shadow, stays on the floor.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 12),
    new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  shadow.name = "shadow";
  g.add(shadow);

  g.userData.body = body;
  return g;
}

export function update(group, t) {
  const body = group.userData.body;
  body.position.y = Math.sin(t * 2.4) * 0.015;
  body.rotation.y = t * 0.6;
}
