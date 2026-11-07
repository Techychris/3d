export const meta = {
  id: "vfx-telegraph-cone",
  name: "Cone attack telegraph",
  category: "vfx",
  footprint: [2.6, 2],
  height: 0.05,
  flying: false
};

// 90 degree wedge on the floor, apex at (0, y, -0.9), opening toward +z, reaching radius 1.8.
const R = 1.8;            // reach
const HALF = Math.PI / 4; // half of the 90 degree spread
const APEX_Z = -0.9;      // apex sits at the back so the wedge is centred on the origin
const EDGE_W = 0.04;      // outline thickness
const EDGE_H = 0.035;     // outline height (gives the telegraph real height)
const ARC_SEGS = 12;

// Point on the arc at angle phi (0 = straight toward +z, positive toward +x).
function px(phi) { return R * Math.sin(phi); }
function pz(phi) { return APEX_Z + R * Math.cos(phi); }

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 1.0,
    flatShading: true, roughness: 0.8, metalness: 0
  });
  const fillMat = new THREE.MeshStandardMaterial({
    color: 0xff4d3d, flatShading: true, roughness: 0.8, metalness: 0,
    transparent: true, opacity: 0.35, depthWrite: false
  });

  // Two straight edges running from the apex out to the arc ends.
  for (const s of [-1, 1]) {
    const phi = s * HALF;
    const dx = Math.sin(phi), dz = Math.cos(phi);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(EDGE_W, EDGE_H, R), edgeMat);
    edge.position.set(dx * R / 2, EDGE_H / 2, APEX_Z + dz * R / 2);
    edge.rotation.y = Math.atan2(dx, dz);
    edge.name = "edge"; g.add(edge);
  }

  // Curved edge built from short straight segments along the arc.
  const dphi = (2 * HALF) / ARC_SEGS;
  for (let i = 0; i < ARC_SEGS; i++) {
    const a = -HALF + i * dphi, b = a + dphi;
    const ax = px(a), az = pz(a), bx = px(b), bz = pz(b);
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    // Push the midpoint back out onto the arc radius.
    const ox = cx, oz = cz - APEX_Z;
    const k = R / Math.hypot(ox, oz);
    const mx = ox * k, mz = APEX_Z + oz * k;
    const chord = Math.hypot(bx - ax, bz - az);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(EDGE_W, EDGE_H, chord * 1.06), edgeMat);
    seg.position.set(mx, EDGE_H / 2, mz);
    seg.rotation.y = Math.atan2(bx - ax, bz - az);
    seg.name = "edge"; g.add(seg);
  }

  // Semi-transparent fill. Cylinder axis passes through the apex, so scaling grows it outward from the apex.
  const fill = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, 0.02, 16, 1, false, -HALF, 2 * HALF),
    fillMat
  );
  fill.position.set(0, 0.01, APEX_Z);
  fill.name = "fill"; g.add(fill);
  g.userData.fill = fill;

  return g;
}

export function update(group, t) {
  const fill = group.userData.fill;
  if (!fill) return;
  const p = Math.max(0.02, (t % 1.2) / 1.2); // grow over 1.2 s, then loop
  fill.scale.set(p, 1, p);
}
