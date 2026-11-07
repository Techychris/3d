export const meta = {
  id: "tile-floor-cracked",
  name: "Cracked floor",
  category: "tile",
  footprint: [1, 1],
  height: 0.12,
  flying: false
};

// Flagstone outlines in tile space: [x, z] pairs, z toward the viewer.
// Gaps between them show the ember slab below.
const STONES = [
  { hex: 0x3b3a40, pts: [[-0.46, -0.46], [-0.10, -0.46], [-0.14, -0.20], [-0.46, -0.14]] },
  { hex: 0x5a5862, pts: [[-0.06, -0.46], [0.40, -0.46], [0.46, -0.24], [0.10, -0.18], [-0.02, -0.30]] },
  { hex: 0x3b3a40, pts: [[0.12, -0.08], [0.46, -0.04], [0.44, 0.26], [0.20, 0.20]] },
  { hex: 0x5a5862, pts: [[-0.42, -0.06], [-0.08, -0.10], [-0.10, 0.18], [-0.30, 0.30], [-0.46, 0.12]] },
  { hex: 0x3b3a40, pts: [[0.00, -0.02], [0.07, -0.04], [0.09, 0.10], [0.02, 0.19], [-0.03, 0.10]] },
  { hex: 0x5a5862, pts: [[-0.20, 0.34], [0.08, 0.30], [0.30, 0.40], [0.26, 0.46], [-0.22, 0.46]] }
];

// Thin glowing fissures laid across the stone tops.
const CRACKS = [
  { x: -0.28, z: -0.32, ry: 0.5, len: 0.22 },
  { x: 0.30, z: 0.06, ry: -0.7, len: 0.20 },
  { x: -0.02, z: 0.02, ry: 1.2, len: 0.16 }
];

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const ember = new THREE.MeshStandardMaterial({
    color: 0xff7a2e, emissive: 0xff7a2e, emissiveIntensity: 1.0,
    flatShading: true, roughness: 0.8, metalness: 0
  });
  g.userData.glow = ember;

  // Ember slab underneath, visible through the gaps.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 0.98), ember);
  slab.position.y = 0.03; slab.name = "ember"; g.add(slab);

  // Broken flagstones, extruded up so their tops sit at y = 0.12.
  for (let i = 0; i < STONES.length; i++) {
    const s = STONES[i];
    const shape = new THREE.Shape();
    s.pts.forEach(([x, z], k) => {
      if (k === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z);
    });
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: s.hex, flatShading: true, roughness: 0.8, metalness: 0
    });
    const stone = new THREE.Mesh(geo, mat);
    stone.position.y = 0.03; stone.name = "stone" + i; g.add(stone);
  }

  // Glowing cracks across the stone tops.
  for (let i = 0; i < CRACKS.length; i++) {
    const c = CRACKS[i];
    const crack = new THREE.Mesh(new THREE.BoxGeometry(c.len, 0.01, 0.025), ember);
    crack.position.set(c.x, 0.125, c.z); crack.rotation.y = c.ry;
    crack.name = "crack" + i; g.add(crack);
  }

  return g;
}

export function update(group, t) {
  const m = group.userData.glow;
  if (m) m.emissiveIntensity = 1.05 + 0.35 * Math.sin(t * 1.6);
}
