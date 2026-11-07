export const meta = {
  id: "vfx-telegraph-circle",
  name: "Telegraph circle",
  category: "vfx",
  footprint: [2, 2],
  height: 0.05,
  flying: false
};

const DANGER = 0xff4d3d;
const RADIUS = 0.95;
const CYCLE = 1.2;

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const ringMat = new THREE.MeshStandardMaterial({
    color: DANGER, emissive: DANGER, emissiveIntensity: 1.0,
    flatShading: true, roughness: 0.8, metalness: 0
  });
  const fillMat = new THREE.MeshStandardMaterial({
    color: DANGER, emissive: DANGER, emissiveIntensity: 0.8,
    flatShading: true, roughness: 0.8, metalness: 0,
    transparent: true, opacity: 0.35, depthWrite: false
  });

  // Outer warning ring: a thin torus lying flat, tube radius 0.015 so it is ~0.03 tall.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RADIUS, 0.015, 6, 48), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.015; ring.name = "ring"; g.add(ring);

  // Inner fill: a semi-transparent disc that grows from the centre to the ring edge.
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, 0.03, 40), fillMat);
  fill.position.y = 0.015; fill.scale.set(0, 1, 0); fill.name = "fill"; g.add(fill);

  // Four inward-pointing triangles on the ring. The shape is built pointing +Y, then laid flat
  // so its tip points -Z; each mesh is turned so the tip points at the centre.
  const tri = new THREE.Shape();
  tri.moveTo(-0.07, -0.05); tri.lineTo(0.07, -0.05); tri.lineTo(0, 0.07); tri.closePath();
  const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.03, bevelEnabled: false, steps: 1 });
  triGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const m = new THREE.Mesh(triGeo, ringMat);
    m.position.set(Math.cos(a) * 0.84, 0.02, Math.sin(a) * 0.84);
    m.rotation.y = Math.PI / 2 - a;
    m.name = "tri" + i; g.add(m);
  }
  return g;
}

export function update(group, t) {
  const fill = group.getObjectByName("fill");
  if (!fill) return;
  const s = Math.max(0.001, (t % CYCLE) / CYCLE);
  fill.scale.set(s, 1, s);
}
