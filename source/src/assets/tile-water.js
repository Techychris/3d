export const meta = {
  id: "tile-water",
  name: "Water tile",
  category: "tile",
  footprint: [1, 1],
  height: 0.12,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const mat = (color, opts = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...opts });

  const stoneDark = mat(0x3b3a40);
  const stone = mat(0x5a5862);
  const stoneLight = mat(0x8a8794);

  // Basin floor, sitting inside a stone rim.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.08, 0.96), stoneDark);
  floor.position.y = 0.04; floor.name = "floor"; g.add(floor);

  const rimSpecs = [
    [1, 0.12, 0.06, 0, 0.06, -0.47],
    [1, 0.12, 0.06, 0, 0.06, 0.47],
    [0.06, 0.12, 1, 0.47, 0.06, 0],
    [0.06, 0.12, 1, -0.47, 0.06, 0]
  ];
  for (const [w, h, d, x, y, z] of rimSpecs) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
    rim.position.set(x, y, z); rim.name = "rim"; g.add(rim);
  }

  // Pebbles on the basin floor, seen through the water.
  const pebbleSpecs = [
    [-0.22, 0.06, -0.18, stoneLight, 0.06],
    [0.16, 0.055, 0.12, stone, 0.05],
    [0.02, 0.06, -0.30, stoneLight, 0.045]
  ];
  for (const [x, y, z, m, r] of pebbleSpecs) {
    const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), m);
    pebble.position.set(x, y, z); pebble.name = "pebble"; g.add(pebble);
  }

  // Semi-transparent water surface.
  const waterMat = mat(0x3e5c9a, { transparent: true, opacity: 0.55, depthWrite: false });
  const water = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.02, 0.88), waterMat);
  water.position.y = 0.09; water.name = "water"; g.add(water);

  // Ripple rings lying flat on the water.
  const ripples = [];
  const ringGeo = new THREE.RingGeometry(0.2, 0.25, 16);
  const ringSpecs = [[-0.12, 0.1], [0.14, -0.05], [-0.02, -0.16]];
  for (const [x, z] of ringSpecs) {
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x9aa3ad, flatShading: true, roughness: 0.8, metalness: 0.3,
      transparent: true, opacity: 0.4, depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.11, z);
    ring.name = "ripple"; g.add(ring);
    ripples.push({ mesh: ring, mat: ringMat });
  }

  g.userData.water = water;
  g.userData.ripples = ripples;
  return g;
}

export function update(group, t) {
  const water = group.userData.water;
  const ripples = group.userData.ripples;
  if (!water || !ripples) return;
  water.position.y = 0.09 + Math.sin(t * 1.6) * 0.004;
  for (let i = 0; i < ripples.length; i++) {
    const r = ripples[i];
    const p = (t / 3 + i / 3) % 1;
    r.mesh.scale.setScalar(0.4 + p * 0.8);
    r.mat.opacity = 0.45 * Math.sin(Math.PI * p);
  }
}
