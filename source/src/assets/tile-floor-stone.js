export const meta = {
  id: "tile-floor-stone",
  name: "Stone floor tile",
  category: "tile",
  footprint: [1, 1],
  height: 0.12,
  flying: false
};

export function build(THREE) {
  const g = new THREE.Group(); g.name = meta.id;
  const base = new THREE.MeshStandardMaterial({ color: 0x3b3a40, flatShading: true, roughness: 0.8, metalness: 0 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x5a5862, flatShading: true, roughness: 0.8, metalness: 0 });
  const light = new THREE.MeshStandardMaterial({ color: 0x8a8794, flatShading: true, roughness: 0.8, metalness: 0 });

  // Thin dark base slab, full tile width so neighbouring tiles butt together.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 1), base);
  slab.position.y = 0.04; slab.name = "base"; g.add(slab);

  // Four flagstones in a 2x2 grid, with a 0.04 gap between them and a 0.02 margin
  // at the tile edge. Heights vary slightly; the highest top sits at 0.12.
  const flags = [
    { x: -0.25, z: -0.25, h: 0.03, mat: stone },
    { x:  0.25, z: -0.25, h: 0.045, mat: light },
    { x: -0.25, z:  0.25, h: 0.04, mat: light },
    { x:  0.25, z:  0.25, h: 0.035, mat: stone }
  ];
  flags.forEach((f, i) => {
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.46, f.h, 0.46), f.mat);
    flag.position.set(f.x, 0.075 + f.h / 2, f.z);
    flag.name = "flag" + i; g.add(flag);
  });

  return g;
}

export function update(group, t) {}
