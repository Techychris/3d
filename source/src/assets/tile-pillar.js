export const meta = {
  id: "tile-pillar",
  name: "Carved stone pillar",
  category: "tile",
  footprint: [0.8, 0.8],
  height: 1.8,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0 });
  const dark = mat(0x3b3a40);   // stone dark
  const stone = mat(0x5a5862);  // stone
  const light = mat(0x8a8794);  // stone light

  // Base group: everything below y 0.35
  const base = new THREE.Group(); base.name = "base"; g.add(base);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.35, 0.74), dark);
  plinth.position.y = 0.175; plinth.name = "plinth"; base.add(plinth);

  // small chipped chunk that broke off and lies at the foot of the plinth
  const chunk = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.12), stone);
  chunk.position.set(0.36, 0.05, 0.3); chunk.rotation.set(0.15, 0.6, 0.1);
  chunk.name = "chunk"; base.add(chunk);

  // Upper group: everything above y 0.35
  const upper = new THREE.Group(); upper.name = "upper"; g.add(upper);

  const step = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.62), dark);
  step.position.y = 0.38; step.name = "step"; upper.add(step);

  // tapered octagonal shaft, 0.41 to 1.51
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 1.1, 8), stone);
  shaft.position.y = 0.96; shaft.name = "shaft"; upper.add(shaft);

  // two chipped bands around the shaft
  for (const [y, r] of [[0.6, 0.28], [1.2, 0.25]]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 8), dark);
    band.position.y = y; band.name = "band"; upper.add(band);
  }

  // hairline crack down the front of the shaft
  const crack = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.02), dark);
  crack.position.set(0.06, 0.85, 0.235); crack.rotation.z = -0.2;
  crack.name = "crack"; upper.add(crack);

  // wider capital: square block, then a tapered cap
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.66), light);
  block.position.y = 1.57; block.name = "capital"; upper.add(block);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.14, 8), light);
  cap.position.y = 1.70; cap.name = "capTop"; upper.add(cap);

  return g;
}

export function update(group, t) {}
