export const meta = {
  id: "tile-doorway-exit",
  name: "Doorway exit",
  category: "tile",
  footprint: [1, 1],
  height: 1.6,
  flying: false
};

// Arch outline: a rectangle from y = base up to springY, capped by a half circle of radius hw.
function arch(p, hw, base, springY) {
  p.moveTo(-hw, base);
  p.lineTo(hw, base);
  p.lineTo(hw, springY);
  p.absarc(0, springY, hw, 0, Math.PI, false);
  p.closePath();
  return p;
}

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const stone = new THREE.MeshStandardMaterial({ color: 0x5a5862, flatShading: true, roughness: 0.8, metalness: 0 });
  const stoneLight = new THREE.MeshStandardMaterial({ color: 0x8a8794, flatShading: true, roughness: 0.8, metalness: 0 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5236, flatShading: true, roughness: 0.8, metalness: 0 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4e3423, flatShading: true, roughness: 0.8, metalness: 0 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, flatShading: true, roughness: 0.8, metalness: 0.3 });
  const magic = new THREE.MeshStandardMaterial({ color: 0x8c5be0, flatShading: true, roughness: 0.8, metalness: 0, emissive: 0x8c5be0, emissiveIntensity: 1.05 });

  // Wall segment along x: 1 tile wide, 0.4 deep (z -0.2..0.2), 1.6 tall, with the arch opening cut through.
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-0.5, 0); wallShape.lineTo(0.5, 0); wallShape.lineTo(0.5, 1.6); wallShape.lineTo(-0.5, 1.6);
  wallShape.closePath();
  wallShape.holes.push(arch(new THREE.Path(), 0.25, 0, 1.0));
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(wallShape, { depth: 0.4, bevelEnabled: false }), stone);
  wall.position.z = -0.2; wall.name = "wall"; g.add(wall);

  // Stone arch frame: light stone ring set into the front face around the opening.
  const frameShape = arch(new THREE.Shape(), 0.33, 0, 1.0);
  frameShape.holes.push(arch(new THREE.Path(), 0.25, 0, 1.0));
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.06, bevelEnabled: false }), stoneLight);
  frame.position.z = 0.15; frame.name = "frame"; g.add(frame);

  // Heavy wooden door, recessed in the opening (z -0.1..0).
  const doorShape = arch(new THREE.Shape(), 0.22, 0, 1.0);
  const door = new THREE.Mesh(new THREE.ExtrudeGeometry(doorShape, { depth: 0.1, bevelEnabled: false }), wood);
  door.position.z = -0.1; door.name = "door"; g.add(door);

  // Dark plank seams running up the door face.
  for (const x of [-0.11, 0.11]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.0, 0.008), woodDark);
    seam.position.set(x, 0.5, 0.004); seam.name = "plank"; g.add(seam);
  }

  // Metal bands across the door.
  for (const y of [0.2, 0.92]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.02), metal);
    band.position.set(0, y, 0.01); band.name = "band"; g.add(band);
  }

  // Iron ring handle.
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 10), metal);
  handle.position.set(0.14, 0.5, 0.025); handle.name = "handle"; g.add(handle);

  // Violet seal bar across the opening; the game shows it while the next floor loads.
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.05), magic);
  bar.position.set(0, 0.62, 0.03); bar.name = "lockGlow"; g.add(bar);
  g.userData.lockGlow = bar;

  return g;
}

export function update(group, t) {
  const bar = group.userData.lockGlow;
  if (bar) bar.material.emissiveIntensity = 1.05 + 0.35 * Math.sin(t * 3);
}
