export const meta = {
  id: "vfx-telegraph-line",
  name: "Telegraph line",
  category: "vfx",
  footprint: [1, 3],
  height: 0.05,
  flying: false
};

// Floor warning for an enemy line attack: danger-red outline, a fill that grows
// from the -z end, and three chevrons pointing +z.
const HALF_W = 0.4;   // outline outer half-width (x)
const HALF_L = 1.45;  // outline outer half-length (z)
const FILL_L = 2.8;   // full fill length, from z = -1.4 to +1.4
const PERIOD = 1.2;   // seconds for the fill to grow, then it loops

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;

  const danger = new THREE.MeshStandardMaterial({
    color: 0xff4d3d, emissive: 0xff4d3d, emissiveIntensity: 1.0,
    flatShading: true, roughness: 0.8, metalness: 0
  });
  const bone = new THREE.MeshStandardMaterial({
    color: 0xe8dcc0, emissive: 0xe8dcc0, emissiveIntensity: 0.6,
    flatShading: true, roughness: 0.8, metalness: 0
  });
  const fillMat = new THREE.MeshStandardMaterial({
    color: 0xff4d3d, transparent: true, opacity: 0.35, depthWrite: false,
    flatShading: true, roughness: 0.8, metalness: 0
  });

  // Outline: four thin emissive boxes, 0.03 tall, edges 0.04 thick.
  const edgeT = 0.04, edgeH = 0.03, edgeY = 0.035;  // spans y 0.02 to 0.05 = meta.height
  const sides = [
    { name: "edgeL", size: [edgeT, edgeH, 2 * HALF_L], pos: [-(HALF_W - edgeT / 2), edgeY, 0] },
    { name: "edgeR", size: [edgeT, edgeH, 2 * HALF_L], pos: [ (HALF_W - edgeT / 2), edgeY, 0] },
    { name: "edgeNear", size: [2 * HALF_W, edgeH, edgeT], pos: [0, edgeY, -(HALF_L - edgeT / 2)] },
    { name: "edgeFar", size: [2 * HALF_W, edgeH, edgeT], pos: [0,  edgeY,  (HALF_L - edgeT / 2)] }
  ];
  for (const s of sides) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(s.size[0], s.size[1], s.size[2]), danger);
    m.position.set(s.pos[0], s.pos[1], s.pos[2]); m.name = s.name; g.add(m);
  }

  // Fill: geometry runs from local z = 0 to FILL_L so scaling z grows it from the -z end.
  const fillGeo = new THREE.BoxGeometry(2 * (HALF_W - edgeT), 0.01, FILL_L);
  fillGeo.translate(0, 0, FILL_L / 2);
  const fill = new THREE.Mesh(fillGeo, fillMat);
  fill.position.set(0, 0.012, -(FILL_L / 2));
  fill.scale.z = 0.001;
  fill.name = "fill"; g.add(fill);
  g.userData.fill = fill;

  // Chevrons: each is two thin bone arms meeting at a tip that points +z.
  const armLen = 0.23, armH = 0.012, armW = 0.04, armY = 0.025;
  const tipsZ = [-0.5, 0.2, 0.9];
  const armX = 0.08, armZ = -0.08;           // arm midpoint offset from the tip
  for (let i = 0; i < tipsZ.length; i++) {
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, armLen), bone);
      arm.position.set(s * armX, armY, tipsZ[i] + armZ);
      arm.rotation.y = s > 0 ? 3 * Math.PI / 4 : -3 * Math.PI / 4;
      arm.name = "chevron" + i + (s > 0 ? "R" : "L");
      g.add(arm);
    }
  }
  return g;
}

export function update(group, t) {
  const fill = group.userData.fill;
  const p = (t % PERIOD) / PERIOD;
  fill.scale.z = p < 0.001 ? 0.001 : p;
}
