export const meta = {
  id: "enemy-mimic",
  name: "Mimic",
  category: "enemy",
  footprint: [0.8, 0.6],
  height: 0.7,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...extra });
  const wood = mat(0x7a5236);
  const gold = mat(0xe0b04a, { metalness: 0.3 });
  const bone = mat(0xe8dcc0);
  const red = mat(0xa8423a);
  const danger = mat(0xff4d3d, { emissive: 0xff4d3d, emissiveIntensity: 1.0 });
  const shadowMat = new THREE.MeshStandardMaterial({
    color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false,
    flatShading: true, roughness: 0.8, metalness: 0
  });

  // blob shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; shadow.scale.y = 0.9;
  shadow.name = "shadow"; g.add(shadow);

  // chest body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.4), wood);
  body.position.set(0, 0.17, 0); body.name = "body"; g.add(body);

  // gold trim bands wrapping the body
  for (const y of [0.05, 0.29]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.71, 0.035, 0.41), gold);
    band.position.set(0, y, 0); band.name = "trim"; g.add(band);
  }
  // front clasp
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), gold);
  clasp.position.set(0, 0.13, 0.21); clasp.name = "clasp"; g.add(clasp);

  // row of teeth along the body's top front edge (tips point up)
  const xs = [-0.27, -0.135, 0, 0.135, 0.27];
  for (const x of xs) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 5), bone);
    t.position.set(x, 0.37, 0.17); t.name = "toothBody"; g.add(t);
  }

  // lid, hinged at the back edge (pivot at z = -0.2)
  const lid = new THREE.Group(); lid.name = "lid";
  lid.position.set(0, 0.34, -0.2); g.add(lid);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.4), wood);
  slab.position.set(0, 0.05, 0.2); slab.name = "lidSlab"; lid.add(slab);
  // row of teeth along the lid's front underside edge (tips point down)
  for (const x of xs) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 5), bone);
    t.position.set(x, -0.03, 0.37); t.rotation.x = Math.PI; t.name = "toothLid"; lid.add(t);
  }
  g.userData.lid = lid;

  // cloth-red tongue lolling out the front (+z)
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.14), red);
  tongue.position.set(0, 0.25, 0.25); tongue.rotation.x = 0.6; tongue.name = "tongue"; g.add(tongue);

  // danger-red eyes inside the mouth
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), danger);
    eye.position.set(s * 0.14, 0.36, 0); eye.name = "eye"; g.add(eye);
  }

  return g;
}

// chomp: the lid snaps open and shut on a deterministic sine of t
export function update(group, t) {
  const lid = group.userData.lid;
  if (lid) lid.rotation.x = -(0.05 + 0.6 * Math.max(0, Math.sin(t * 3)));
}
