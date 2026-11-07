export const meta = {
  id: "prop-chest",
  name: "Treasure chest",
  category: "prop",
  footprint: [0.8, 0.6],
  height: 0.6,
  flying: false
};

// Lid pivot sits on the back hinge (z = -0.3, y = 0.3). Resting angle is slightly open.
const REST_OPEN = 0.12;
const LIFT = 0.12;

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: 0.8, metalness: 0, ...extra
  });
  const woodDark = mat(0x4e3423);
  const wood = mat(0x7a5236);
  const gold = mat(0xe0b04a, { metalness: 0.3 });
  const glow = mat(0xe0b04a, { emissive: 0xe0b04a, emissiveIntensity: 1.0 });

  // Body: 0.8 wide, 0.3 tall, 0.6 deep.
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.6), woodDark);
  body.position.y = 0.15; body.name = "body"; g.add(body);

  // Gold corner trims on the four vertical edges.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), gold);
    trim.position.set(sx * 0.4, 0.15, sz * 0.3); trim.name = "trim"; g.add(trim);
  }

  // Gold lock plate on the front face (+z).
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.02), gold);
  plate.position.set(0, 0.16, 0.31); plate.name = "lockPlate"; g.add(plate);

  // Gold glow inside the body top, visible through the gap under the lid.
  const inner = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.5), glow);
  inner.position.set(0, 0.29, 0); inner.name = "glow"; g.add(inner);

  // Lid: half cylinder (radius 0.3, length 0.8 along x), rounded side up.
  const lidGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 10, 1, false, 0, Math.PI);
  lidGeo.rotateZ(Math.PI / 2);          // axis along x, arc above y = 0
  lidGeo.translate(0, 0, 0.3);          // shift so the hinge at the back edge is the pivot
  const lidShell = new THREE.Mesh(lidGeo, wood);
  lidShell.name = "lidShell";

  const lid = new THREE.Group();
  lid.name = "lid";
  lid.position.set(0, 0.3, -0.3);       // back hinge
  lid.rotation.x = -REST_OPEN;          // negative x rotation lifts the front edge
  lid.add(lidShell);
  g.add(lid);

  // Blob shadow: flattened circle under the chest.
  const shadowGeo = new THREE.CircleGeometry(0.4, 14);
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1, 0.75, 1);         // ellipse: 0.8 wide, 0.6 deep
  shadow.position.y = 0.01;
  shadow.name = "shadow";
  g.add(shadow);

  return g;
}

export function update(group, t) {
  const lid = group.getObjectByName("lid");
  if (!lid) return;
  // Repeating 3 s cycle: the lid lifts and settles back to the resting angle.
  const p = (t % 3) / 3;
  const angle = REST_OPEN + LIFT * Math.sin(Math.PI * p);
  lid.rotation.x = -angle;
}
